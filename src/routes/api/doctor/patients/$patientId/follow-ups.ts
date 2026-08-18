import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { sugbodocAppointments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { patientSummary, recordAudit, requireDoctor, toAppointment, toIsoString, type AppointmentRow } from "@/lib/api/doctor.server";

const bodySchema = z.object({ date: z.string().min(1), time: z.string().min(1), reason: z.string().trim().min(2).max(300) });

export const Route = createFileRoute("/api/doctor/patients/$patientId/follow-ups")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireDoctor(request);
        if ("error" in auth) return auth.error;
        const doctor = auth.user;

        const patient = await patientSummary(params.patientId, doctor.providerId!);
        if (!patient) {
          return errorJson("Patient is not assigned to this doctor.", 404);
        }

        const parsed = bodySchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return errorJson("Follow-up date, time, and reason are required.", 400);
        }

        const id = `apt_${crypto.randomUUID()}`;
        const reference = `APT-${Math.floor(10000 + Math.random() * 90000)}`;

        const [row] = await db
          .insert(sugbodocAppointments)
          .values({
            id,
            userId: patient.id,
            reference,
            date: parsed.data.date,
            time: parsed.data.time,
            status: "Pending",
            data: {
              doctor: { id: doctor.providerId, name: doctor.name, initials: doctor.initials, specialty: doctor.specialty, clinic: doctor.clinic },
              reason: parsed.data.reason,
              visitType: "Follow-up consultation",
              emailStatus: "pending",
              smsStatus: "mock-pending",
            },
          })
          .returning();

        if (!row) return errorJson("Unable to create follow-up appointment.", 500);

        const appointment: AppointmentRow = {
          id: row.id,
          user_id: row.userId,
          reference: row.reference,
          date: row.date,
          time: row.time,
          status: row.status,
          data: row.data as Record<string, any>,
          created_at: toIsoString(row.createdAt),
          updated_at: toIsoString(row.updatedAt),
        };

        await recordAudit(doctor.name, "Created patient follow-up appointment", `${patient.name} (${appointment.reference})`);
        return json({ appointment: toAppointment(appointment) }, 201);
      },
    },
  },
});
