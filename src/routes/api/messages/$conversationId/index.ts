import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocMessages, sugbodocUsers, sugbodocMessageConversations, sugbodocAppointments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, newId, MOCK_DOCTORS } from "@/lib/api/sugbodoc-auth.server";
import { canAccessConversation, publicMessage, type MessageRow } from "@/lib/api/messages.server";

const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const Route = createFileRoute("/api/messages/$conversationId/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);
        const conversation = await canAccessConversation(user, params.conversationId);
        if (!conversation) return errorJson("Conversation not found.", 404);

        let rows: MessageRow[] = [];
        try {
          const rowsData = await db
            .select()
            .from(sugbodocMessages)
            .where(eq(sugbodocMessages.conversationId, conversation.id))
            .orderBy(asc(sugbodocMessages.createdAt));

          rows = rowsData.map((m) => ({
            id: m.id,
            conversation_id: m.conversationId,
            sender_id: m.senderId,
            body: m.body,
            read_at: m.readAt ? m.readAt.toISOString() : null,
            created_at: m.createdAt.toISOString(),
          }));
        } catch (e) {
          console.warn("[messages GET] DB fetch fallback:", e);
        }

        // Merge in-memory messages
        const memMsgs = Array.from(globalThis._memoryMessages?.values() || [])
          .filter((m) => m.conversation_id === conversation.id);
        for (const m of memMsgs) {
          if (!rows.some((existing) => existing.id === m.id)) {
            rows.push(m);
          }
        }
        rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        let sendersData: Array<{ id: string; name: string; initials: string; role: string }> = [];
        try {
          sendersData = await db
            .select({
              id: sugbodocUsers.id,
              name: sugbodocUsers.name,
              initials: sugbodocUsers.initials,
              role: sugbodocUsers.role,
            })
            .from(sugbodocUsers);
        } catch (e) {
          // ignore
        }

        const senderMap = new Map(sendersData.map((sender) => [sender.id, sender]));
        senderMap.set("doctor_dr_2", { id: "doctor_dr_2", name: "Dr. Jose Reyes", initials: "JR", role: "Doctor" });
        senderMap.set("doctor_dr_1", { id: "doctor_dr_1", name: "Dr. Maria Santos", initials: "MS", role: "Doctor" });
        senderMap.set("doctor_dr_3", { id: "doctor_dr_3", name: "Dr. Ana Villanueva", initials: "AV", role: "Doctor" });
        senderMap.set("doctor_dr_4", { id: "doctor_dr_4", name: "Dr. Carlo Mendoza", initials: "CM", role: "Doctor" });
        senderMap.set("doctor_dr_5", { id: "doctor_dr_5", name: "Dr. Lea Fernandez", initials: "LF", role: "Doctor" });
        senderMap.set("usr_admin_default", { id: "usr_admin_default", name: "SugboDoc Administrator", initials: "SA", role: "Admin" });
        senderMap.set("pt_123", { id: "pt_123", name: "Juan dela Cruz", initials: "JD", role: "Patient" });

        let patient: { id: string; name: string; initials: string; email: string } | null = null;
        try {
          const patientRows = await db
            .select({
              id: sugbodocUsers.id,
              name: sugbodocUsers.name,
              initials: sugbodocUsers.initials,
              email: sugbodocUsers.email,
            })
            .from(sugbodocUsers)
            .where(eq(sugbodocUsers.id, conversation.patient_id))
            .limit(1);
          patient = patientRows[0] || null;
        } catch (e) {
          // ignore
        }

        if (!patient) {
          patient = {
            id: conversation.patient_id,
            name: "Juan dela Cruz",
            initials: "JD",
            email: "juan@example.com",
          };
        }

        // Determine doctor details if conversation is doctor-typed
        let doctorInfo: { doctorId?: string; doctorName?: string; doctorSpecialty?: string; doctorClinic?: string; doctorInitials?: string } = {};
        for (const doc of MOCK_DOCTORS) {
          if (conversation.id.includes(`_${doc.providerId}_`) || (conversation.id.includes("doctor") && user.providerId === doc.providerId)) {
            doctorInfo = {
              doctorId: doc.providerId,
              doctorName: doc.name,
              doctorSpecialty: doc.specialty,
              doctorClinic: doc.clinic,
              doctorInitials: doc.initials,
            };
            break;
          }
        }

        return json({
          conversation: {
            id: conversation.id,
            type: conversation.type,
            patientId: patient.id,
            patientName: patient.name,
            patientInitials: patient.initials,
            patientEmail: patient.email,
            ...doctorInfo,
          },
          messages: rows.map((message) => publicMessage(message, senderMap.get(message.sender_id))),
        });
      },
      POST: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);
        const conversation = await canAccessConversation(user, params.conversationId);
        if (!conversation) return errorJson("Conversation not found.", 404);

        const parsed = messageSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return errorJson("Message text is required and must be 4,000 characters or fewer.", 400);
        }

        const msgId = `message_${newId()}`;
        const now = new Date();

        const messageRow: MessageRow = {
          id: msgId,
          conversation_id: conversation.id,
          sender_id: user.id,
          body: parsed.data.body,
          read_at: null,
          created_at: now.toISOString(),
        };

        // Write to memory store
        globalThis._memoryMessages?.set(msgId, messageRow);

        try {
          await db
            .insert(sugbodocMessages)
            .values({
              id: msgId,
              conversationId: conversation.id,
              senderId: user.id,
              body: parsed.data.body,
            });

          await db
            .update(sugbodocMessageConversations)
            .set({ updatedAt: now })
            .where(eq(sugbodocMessageConversations.id, conversation.id));
        } catch (error) {
          console.warn("[messages POST] DB insert fallback to memory:", error);
        }

        return json({ message: publicMessage(messageRow, user) }, 201);
      },
    },
  },
});

