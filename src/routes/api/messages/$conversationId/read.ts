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

        await db
          .update(sugbodocMessages)
          .set({ readAt: new Date() })
          .where(and(eq(sugbodocMessages.conversationId, conversation.id), ne(sugbodocMessages.senderId, user.id)));

        return json({ success: true });
      },
    },
  },
});
