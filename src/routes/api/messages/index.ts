import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers, sugbodocMessages } from "@/db/schema";
import { errorJson, json } from "@/lib/api/http.server";
import { doctorCanAccessPatient, getUserFromRequest, isAdminUser, isDoctorUser } from "@/lib/api/sugbodoc-auth.server";
import { ensureConversation, publicMessage, type MessageRow } from "@/lib/api/messages.server";

export const Route = createFileRoute("/api/messages/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const conversations = [];

        if (isAdminUser(user)) {
          const allPatientsData = await db
            .select({
              id: sugbodocUsers.id,
              name: sugbodocUsers.name,
              initials: sugbodocUsers.initials,
              email: sugbodocUsers.email,
            })
            .from(sugbodocUsers)
            .where(eq(sugbodocUsers.role, "Patient"));

          for (const patient of allPatientsData) {
            const conversation = await ensureConversation(patient.id, "admin");
            conversations.push({ conversation, patient });
          }
        } else if (isDoctorUser(user)) {
          const allPatientsData = await db
            .select({
              id: sugbodocUsers.id,
              name: sugbodocUsers.name,
              initials: sugbodocUsers.initials,
              email: sugbodocUsers.email,
            })
            .from(sugbodocUsers)
            .where(eq(sugbodocUsers.role, "Patient"));

          const filtered = await Promise.all(
            allPatientsData.map(async (patient) => ((await doctorCanAccessPatient(user, patient.id)) ? patient : null)),
          );
          const assignedPatients = filtered.filter((p): p is typeof allPatientsData[number] => Boolean(p));

          for (const patient of assignedPatients) {
            const conversation = await ensureConversation(patient.id, "doctor");
            conversations.push({ conversation, patient });
          }
        } else {
          // Patient user
          const adminConv = await ensureConversation(user.id, "admin");
          conversations.push({
            conversation: adminConv,
            patient: { id: user.id, name: user.name, initials: user.initials, email: user.email },
          });

          const doctorConv = await ensureConversation(user.id, "doctor");
          conversations.push({
            conversation: doctorConv,
            patient: { id: user.id, name: user.name, initials: user.initials, email: user.email },
          });
        }

        const allMessagesData = await db
          .select()
          .from(sugbodocMessages)
          .orderBy(desc(sugbodocMessages.createdAt));

        const allMessages: MessageRow[] = allMessagesData.map((m) => ({
          id: m.id,
          conversation_id: m.conversationId,
          sender_id: m.senderId,
          body: m.body,
          read_at: m.readAt ? m.readAt.toISOString() : null,
          created_at: m.createdAt.toISOString(),
        }));

        const sendersData = await db
          .select({
            id: sugbodocUsers.id,
            name: sugbodocUsers.name,
            initials: sugbodocUsers.initials,
            role: sugbodocUsers.role,
          })
          .from(sugbodocUsers);

        const senderMap = new Map(sendersData.map((sender) => [sender.id, sender]));

        const result = conversations
          .map(({ conversation, patient }) => {
            const threadMessages = allMessages.filter((message) => message.conversation_id === conversation.id);
            const latest = threadMessages[0];
            return {
              id: conversation.id,
              type: conversation.type,
              patientId: patient.id,
              patientName: patient.name,
              patientInitials: patient.initials,
              patientEmail: patient.email,
              updatedAt: latest?.created_at ?? conversation.updated_at,
              unreadCount: threadMessages.filter((message) => message.sender_id !== user.id && !message.read_at).length,
              lastMessage: latest ? publicMessage(latest, senderMap.get(latest.sender_id)) : null,
            };
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return json({ conversations: result });
      },
    },
  },
});
