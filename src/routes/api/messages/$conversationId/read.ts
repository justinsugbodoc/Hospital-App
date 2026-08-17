import { createFileRoute } from "@tanstack/react-router";
import { eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocMessages } from "@/db/schema";
import { errorJson, json } from "@/lib/api/http.server";
import { getUserFromRequest } from "@/lib/api/sugbodoc-auth.server";
import { canAccessConversation } from "@/lib/api/messages.server";

export const Route = createFileRoute("/api/messages/$conversationId/read")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);
        const conversation = await canAccessConversation(user, params.conversationId);
        if (!conversation) return errorJson("Conversation not found.", 404);

        const now = new Date();

        // Update in-memory messages
        if (globalThis._memoryMessages) {
          for (const [id, msg] of globalThis._memoryMessages.entries()) {
            if (msg.conversation_id === conversation.id && msg.sender_id !== user.id && !msg.read_at) {
              globalThis._memoryMessages.set(id, { ...msg, read_at: now.toISOString() });
            }
          }
        }

        try {
          await db
            .update(sugbodocMessages)
            .set({ readAt: now })
            .where(and(eq(sugbodocMessages.conversationId, conversation.id), ne(sugbodocMessages.senderId, user.id)));
        } catch (e) {
          // ignore
        }

        return json({ success: true });
      },
    },
  },
});

