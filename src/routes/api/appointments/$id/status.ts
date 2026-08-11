import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocAppointments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { toAppointment } from "../index";

type AppointmentRow = Parameters<typeof toAppointment>[0];

const statusSchema = z.object({
  status: z.enum(["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled"]),
});

export const Route = createFileRoute("/api/appointments/$id/status")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = statusSchema.safeParse(await readJson(request));
        if (!parsed.success) return errorJson("Invalid appointment status.", 400);

        try {
          const existingRows = await db
            .select()
            .from(sugbodocAppointments)
            .where(eq(sugbodocAppointments.id, params.id))
            .limit(1);

          const existing = existingRows[0];
          if (!existing || (!isAdminUser(user) && existing.userId !== user.id)) {
            return errorJson("Appointment not found.", 404);
          }

          const whereClause = isAdminUser(user)
            ? eq(sugbodocAppointments.id, params.id)
            : and(eq(sugbodocAppointments.id, params.id), eq(sugbodocAppointments.userId, user.id));

          const [updated] = await db
            .update(sugbodocAppointments)
            .set({ status: parsed.data.status, updatedAt: new Date() })
            .where(whereClause)
            .returning();

          if (!updated) return errorJson("Unable to update the appointment.", 500);

          const row: AppointmentRow = {
            id: updated.id,
            user_id: updated.userId,
            reference: updated.reference,
            date: updated.date,
            time: updated.time,
            status: updated.status,
            data: updated.data as Record<string, unknown>,
            created_at: updated.createdAt.toISOString(),
            updated_at: updated.updatedAt.toISOString(),
          };

          return json({ appointment: toAppointment(row) });
        } catch (error) {
          console.error("[appointments status PATCH]", error);
          return errorJson("Unable to update the appointment.", 500);
        }
      },
    },
  },
});
