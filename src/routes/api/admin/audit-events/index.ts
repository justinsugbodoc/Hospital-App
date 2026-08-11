import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocAuditEvents } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { newId } from "@/lib/api/sugbodoc-auth.server";
import { requireAdmin, toPublicAuditEvent, type AuditEventRow } from "@/lib/api/admin-operations.server";

const auditEventSchema = z.object({
  action: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(300),
});

export const Route = createFileRoute("/api/admin/audit-events/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await requireAdmin(request);
        if (user instanceof Response) return user;

        const eventsData = await db
          .select()
          .from(sugbodocAuditEvents)
          .orderBy(desc(sugbodocAuditEvents.timestamp))
          .limit(100);

        const events: AuditEventRow[] = eventsData.map((e) => ({
          id: e.id,
          actor: e.actor,
          action: e.action,
          target: e.target,
          timestamp: e.timestamp.toISOString(),
        }));

        return json({ events: events.map(toPublicAuditEvent) });
      },
      POST: async ({ request }) => {
        const user = await requireAdmin(request);
        if (user instanceof Response) return user;

        const parsed = auditEventSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return errorJson("Invalid audit event.", 400);
        }

        try {
          const [event] = await db
            .insert(sugbodocAuditEvents)
            .values({
              id: `audit_${newId()}`,
              actor: user.name,
              action: parsed.data.action,
              target: parsed.data.target,
            })
            .returning();

          if (!event) return errorJson("Unable to record audit event.", 500);

          const row: AuditEventRow = {
            id: event.id,
            actor: event.actor,
            action: event.action,
            target: event.target,
            timestamp: event.timestamp.toISOString(),
          };

          return json({ event: toPublicAuditEvent(row) }, 201);
        } catch (error) {
          console.error("[admin/audit-events POST]", error);
          return errorJson("Unable to record audit event.", 500);
        }
      },
    },
  },
});
