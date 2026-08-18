import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocEncounters, sugbodocAppointments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { doctorCanAccessPatient } from "@/lib/api/sugbodoc-auth.server";
import {
  deleteEncounterClinicalRecords,
  encounterSchema,
  loadPatientEncounters,
  recordAudit,
  requireDoctor,
  toAppointment,
  toIsoString,
  upsertEncounter,
  type AppointmentRow,
  type EncounterRow,
} from "@/lib/api/doctor.server";

export const Route = createFileRoute("/api/doctor/encounters/$encounterId")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const auth = await requireDoctor(request);
        if ("error" in auth) return auth.error;
        const doctor = auth.user;

        const parsed = encounterSchema.safeParse(await readJson(request));
        if (!parsed.success || parsed.data.id !== params.encounterId) {
          return json({ error: "Complete encounter details are required.", details: parsed.success ? undefined : parsed.error.flatten() }, 400);
        }
        if (parsed.data.doctorId !== doctor.providerId || !(await doctorCanAccessPatient(doctor, parsed.data.patientId))) {
          return errorJson("You are not authorized to edit this encounter.", 403);
        }

        const existingRows = await db
          .select()
          .from(sugbodocEncounters)
          .where(and(eq(sugbodocEncounters.id, parsed.data.id), eq(sugbodocEncounters.patientId, parsed.data.patientId)))
          .limit(1);

        const existingRow = existingRows[0];
        if (!existingRow) {
          return errorJson("Encounter not found.", 404);
        }

        const appointmentId = parsed.data.appointmentId || existingRow.appointmentId;
        let appointment: AppointmentRow | undefined;
        if (appointmentId) {
          const apptRows = await db
            .select()
            .from(sugbodocAppointments)
            .where(and(eq(sugbodocAppointments.id, appointmentId), eq(sugbodocAppointments.userId, parsed.data.patientId)))
            .limit(1);

          const a = apptRows[0];
          if (a) {
            appointment = {
              id: a.id,
              user_id: a.userId,
              reference: a.reference,
              date: a.date,
              time: a.time,
              status: a.status,
              data: a.data as Record<string, any>,
              created_at: toIsoString(a.createdAt),
              updated_at: toIsoString(a.updatedAt),
            };
          }
        }
        if (appointmentId && (!appointment || (appointment.data as Record<string, any>)?.doctor?.id !== doctor.providerId)) {
          return errorJson("You are not authorized to update this appointment.", 403);
        }

        const savedAppointment = appointment;
        const syncedEncounter = { ...parsed.data, appointmentId: savedAppointment?.id ?? null };
        await deleteEncounterClinicalRecords(parsed.data.id);
        await upsertEncounter(parsed.data.patientId, syncedEncounter);

        let updatedAppointment: AppointmentRow | null = null;
        if (savedAppointment) {
          const nextStatus = ["Completed", "No Show", "Cancelled"].includes(savedAppointment.status)
            ? savedAppointment.status
            : "In Progress";

          const [updatedRow] = await db
            .update(sugbodocAppointments)
            .set({
              status: nextStatus,
              updatedAt: new Date(),
              data: {
                ...(savedAppointment.data as Record<string, unknown>),
                clinicalEncounterId: parsed.data.id,
                clinicalRecordsSavedAt: new Date().toISOString(),
              },
            })
            .where(eq(sugbodocAppointments.id, savedAppointment.id))
            .returning();

          if (updatedRow) {
            updatedAppointment = {
              id: updatedRow.id,
              user_id: updatedRow.userId,
              reference: updatedRow.reference,
              date: updatedRow.date,
              time: updatedRow.time,
              status: updatedRow.status,
              data: updatedRow.data as Record<string, any>,
              created_at: toIsoString(updatedRow.createdAt),
              updated_at: toIsoString(updatedRow.updatedAt),
            };
          }
        }

        const encounter = (await loadPatientEncounters(parsed.data.patientId)).find((item) => item.id === parsed.data.id);
        await recordAudit(doctor.name, "Updated clinical encounter", parsed.data.encounterReference);
        return json({ encounter, appointment: updatedAppointment ? toAppointment(updatedAppointment) : null });
      },
    },
  },
});
