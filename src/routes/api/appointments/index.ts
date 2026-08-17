import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocAppointments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, newId } from "@/lib/api/sugbodoc-auth.server";
import { connectAppointmentMessageThread } from "@/lib/api/messages.server";

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

declare global {
  var _memoryAppointments: Map<string, AppointmentRow> | undefined;
}

const memoryAppointments = (globalThis._memoryAppointments = globalThis._memoryAppointments || new Map<string, AppointmentRow>());

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

        let rows: AppointmentRow[] = [];
        try {
          const appointmentsData = await db
            .select()
            .from(sugbodocAppointments)
            .where(eq(sugbodocAppointments.userId, user.id))
            .orderBy(desc(sugbodocAppointments.createdAt));

          rows = appointmentsData.map((a) => ({
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
        } catch (error) {
          console.warn("[appointments GET] SQL query fallback:", error);
        }

        // Merge in-memory appointments
        const memAppts = Array.from(memoryAppointments.values()).filter((a) => a.user_id === user.id);
        for (const ma of memAppts) {
          if (!rows.some((r) => r.id === ma.id)) {
            rows.push(ma);
          }
        }

        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return json({ appointments: rows.map(toAppointment) });
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
        const doctorObj = (parsed.data.doctor || {}) as Record<string, any>;
        const doctorId = String(doctorObj.providerId || doctorObj.id || "dr_1").replace("doctor_", "");
        const doctorName = String(doctorObj.name || `Dr. ${doctorId}`);
        const doctorSpecialty = String(doctorObj.specialty || "Clinical Specialist");
        const doctorClinic = String(doctorObj.clinic || "SugboDoc Health");

        let row: AppointmentRow;
        const nowIso = new Date().toISOString();

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

          if (created) {
            row = {
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
          } else {
            row = {
              id,
              user_id: user.id,
              reference: appointmentReference,
              date: parsed.data.date,
              time: parsed.data.time,
              status: "Pending",
              data: {
                doctor: parsed.data.doctor,
                billing: parsed.data.billing,
                emailStatus: "pending",
              },
              created_at: nowIso,
              updated_at: nowIso,
            };
          }
        } catch (error) {
          console.warn("[appointments POST] DB insert fallback to memory:", error);
          row = {
            id,
            user_id: user.id,
            reference: appointmentReference,
            date: parsed.data.date,
            time: parsed.data.time,
            status: "Pending",
            data: {
              doctor: parsed.data.doctor,
              billing: parsed.data.billing,
              emailStatus: "pending",
            },
            created_at: nowIso,
            updated_at: nowIso,
          };
        }

        // Store in memory
        memoryAppointments.set(row.id, row);

        // Automatically connect or create message thread between patient and doctor
        try {
          await connectAppointmentMessageThread({
            patientId: user.id,
            patientName: user.name,
            doctorId,
            doctorName,
            specialty: doctorSpecialty,
            clinic: doctorClinic,
            appointmentReference,
            appointmentDate: parsed.data.date,
            appointmentTime: parsed.data.time,
          });
        } catch (msgError) {
          console.warn("[appointments POST] Failed connecting message thread:", msgError);
        }

        return json({ appointment: toAppointment(row) }, 201);
      },
    },
  },
});
