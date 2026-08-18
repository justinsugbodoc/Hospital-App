import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocAppointments, sugbodocUsers } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import {
  ensureAppointmentEncounter,
  ensureCompletedAppointmentBill,
  recordAudit,
  requireDoctor,
  toAppointment,
  toIsoString,
  type AppointmentRow,
  type PatientRow,
} from "@/lib/api/doctor.server";

const bodySchema = z.object({ status: z.enum(["In Progress", "Completed", "No Show", "Cancelled"]) });

export const Route = createFileRoute("/api/doctor/appointments/$id/status")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const auth = await requireDoctor(request);
          if ("error" in auth) return auth.error;
          const doctor = auth.user;

          const parsed = bodySchema.safeParse(await readJson(request));
          if (!parsed.success) {
            return errorJson("Choose a valid appointment status.", 400);
          }

          const existingRows = await db
            .select()
            .from(sugbodocAppointments)
            .where(eq(sugbodocAppointments.id, params.id))
            .limit(1);

          const a = existingRows[0];
          if (!a || (a.data as Record<string, any>)?.doctor?.id !== doctor.providerId) {
            return errorJson("Assigned appointment not found.", 404);
          }

          const existing: AppointmentRow = {
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

          const patientRows = await db
            .select()
            .from(sugbodocUsers)
            .where(eq(sugbodocUsers.id, existing.user_id))
            .limit(1);

          const p = patientRows[0];
          if (!p) {
            return errorJson("Patient not found.", 404);
          }

          const patient: PatientRow = {
            id: p.id,
            name: p.name,
            initials: p.initials,
            email: p.email,
            phone: p.phone,
            birthday: p.birthday,
            gender: p.gender,
            blood_type: p.bloodType,
            emergency_contact: p.emergencyContact as { name: string; number: string } | null,
            allergies: p.allergies as string[] | null,
            insurance_data: p.insuranceData as Record<string, unknown> | null,
            claims_data: p.claimsData as Record<string, unknown>[] | null,
            role: p.role,
          };

          const [updatedRow] = await db
            .update(sugbodocAppointments)
            .set({
              status: parsed.data.status,
              updatedAt: new Date(),
              data: { ...(existing.data as Record<string, unknown>), smsStatus: "mock-pending", doctorUpdatedAt: new Date().toISOString() },
            })
            .where(eq(sugbodocAppointments.id, existing.id))
            .returning();

          if (!updatedRow) return errorJson("Unable to update appointment.", 500);

          const updated: AppointmentRow = {
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

          let encounter: Record<string, any> | null = null;
          if (parsed.data.status === "In Progress" || parsed.data.status === "Completed") {
            encounter = await ensureAppointmentEncounter(updated, patient, doctor, parsed.data.status);
            if (parsed.data.status === "Completed" && encounter) {
              encounter = await ensureCompletedAppointmentBill(updated, patient, encounter);
            }
          }
          await recordAudit(doctor.name, `Marked appointment ${parsed.data.status.toLowerCase()}`, updated.reference);
          return json({ appointment: toAppointment(updated), encounter });
        } catch (err) {
          console.error("[doctor/appointments/status] Error:", err);
          return errorJson("Unable to update appointment status.", 500);
        }
      },
    },
  },
});
