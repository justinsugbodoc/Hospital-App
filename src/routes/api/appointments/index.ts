import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocAppointments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, newId } from "@/lib/api/sugbodoc-auth.server";

type AppointmentRow = {
  id: string;
  user_id: string;
  reference: string;
  date: string;
  time: string;
  status: string;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const appointmentSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  doctor: z.record(z.string(), z.unknown()),
  billing: z.record(z.string(), z.unknown()).optional(),
});

export function toAppointment(row: AppointmentRow) {
  return {
    ...((row.data as Record<string, unknown>) ?? {}),
    id: row.id,
    reference: row.reference,
    date: row.date,
    time: row.time,
    status: row.status,
  };
}

function reference() {
  return `APT-${Math.floor(10000 + Math.random() * 90000)}`;
}

export const Route = createFileRoute("/api/appointments/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        try {
          const appointmentsData = await db
            .select()
            .from(sugbodocAppointments)
            .where(eq(sugbodocAppointments.userId, user.id))
            .orderBy(desc(sugbodocAppointments.createdAt));

          const rows: AppointmentRow[] = appointmentsData.map((a) => ({
            id: a.id,
            user_id: a.userId,
            reference: a.reference,
            date: a.date,
            time: a.time,
            status: a.status,
            data: a.data as Record<string, unknown>,
            created_at: a.createdAt.toISOString(),
            updated_at: a.updatedAt.toISOString(),
          }));

          return json({ appointments: rows.map(toAppointment) });
        } catch (error) {
          console.error("[appointments GET]", error);
          return errorJson("Unable to load appointments.", 500);
        }
      },
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = appointmentSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return json({ error: "Invalid appointment details", details: parsed.error.flatten() }, 400);
        }

        const id = newId("apt_");
        const appointmentReference = reference();
        try {
          const [created] = await db
            .insert(sugbodocAppointments)
            .values({
              id,
              userId: user.id,
              reference: appointmentReference,
              date: parsed.data.date,
              time: parsed.data.time,
              status: "Pending",
              data: {
                doctor: parsed.data.doctor,
                billing: parsed.data.billing,
                emailStatus: "pending",
              },
            })
            .returning();

          if (!created) return errorJson("Unable to create the appointment.", 500);

          const row: AppointmentRow = {
            id: created.id,
            user_id: created.userId,
            reference: created.reference,
            date: created.date,
            time: created.time,
            status: created.status,
            data: created.data as Record<string, unknown>,
            created_at: created.createdAt.toISOString(),
            updated_at: created.updatedAt.toISOString(),
          };

          return json({ appointment: toAppointment(row) }, 201);
        } catch (error) {
          console.error("[appointments POST]", error);
          return errorJson("Unable to create the appointment.", 500);
        }
      },
    },
  },
});
