import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocMessages, sugbodocUsers, sugbodocMessageConversations } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, newId } from "@/lib/api/sugbodoc-auth.server";
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

        const rowsData = await db
          .select()
          .from(sugbodocMessages)
          .where(eq(sugbodocMessages.conversationId, conversation.id))
          .orderBy(asc(sugbodocMessages.createdAt));

        const rows: MessageRow[] = rowsData.map((m) => ({
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

        const patient = patientRows[0];

        return json({
          conversation: {
            id: conversation.id,
            type: conversation.type,
            patientId: patient?.id ?? conversation.patient_id,
            patientName: patient?.name ?? "Patient",
            patientInitials: patient?.initials ?? "PT",
            patientEmail: patient?.email ?? "",
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

        try {
          const [messageData] = await db
            .insert(sugbodocMessages)
            .values({
              id: `message_${newId()}`,
              conversationId: conversation.id,
              senderId: user.id,
              body: parsed.data.body,
            })
            .returning();

          if (!messageData) return errorJson("Unable to send message.", 500);

          await db
            .update(sugbodocMessageConversations)
            .set({ updatedAt: new Date() })
            .where(eq(sugbodocMessageConversations.id, conversation.id));

          const messageRow: MessageRow = {
            id: messageData.id,
            conversation_id: messageData.conversationId,
            sender_id: messageData.senderId,
            body: messageData.body,
            read_at: messageData.readAt ? messageData.readAt.toISOString() : null,
            created_at: messageData.createdAt.toISOString(),
          };

          return json({ message: publicMessage(messageRow, user) }, 201);
        } catch (error) {
          console.error("[messages POST]", error);
          return errorJson("Unable to send message.", 500);
        }
      },
    },
  },
});
