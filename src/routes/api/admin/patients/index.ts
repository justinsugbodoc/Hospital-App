import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers, sugbodocAppointments } from "@/db/schema";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { errorJson, json } from "@/lib/api/http.server";
import { loadPatientEncounters } from "@/lib/api/clinical-records.server";
import { toAppointment } from "../../appointments/index";

type AppointmentRow = Parameters<typeof toAppointment>[0] & { user_id: string; created_at: string };

type PatientRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  blood_type: string;
  emergency_contact: { name: string; number: string } | null;
  role: string;
  status: string;
  clinical_editing_permission: string;
  insurance_data: Record<string, unknown> | null;
  claims_data: Record<string, unknown>[] | null;
  updated_at: string;
};

export const Route = createFileRoute("/api/admin/patients/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) return errorJson("Admin access required.", 403);

        try {
          const patientsData = await db
            .select()
            .from(sugbodocUsers)
            .where(eq(sugbodocUsers.role, "Patient"));

          const appointmentsData = await db
            .select()
            .from(sugbodocAppointments)
            .orderBy(desc(sugbodocAppointments.createdAt));

          const patients: PatientRow[] = patientsData.map((p) => ({
            id: p.id,
            name: p.name,
            initials: p.initials,
            email: p.email,
            phone: p.phone,
            birthday: p.birthday,
            gender: p.gender,
            blood_type: p.bloodType,
            emergency_contact: p.emergencyContact as { name: string; number: string } | null,
            role: p.role,
            status: p.status,
            clinical_editing_permission: p.clinicalEditingPermission,
            insurance_data: p.insuranceData as Record<string, unknown> | null,
            claims_data: p.claimsData as Record<string, unknown>[] | null,
            updated_at: p.updatedAt.toISOString(),
          }));

          const appointments: AppointmentRow[] = appointmentsData.map((a) => ({
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

          const appointmentsByUser = new Map<string, AppointmentRow[]>();
          for (const appointment of appointments) {
            const current = appointmentsByUser.get(appointment.user_id) ?? [];
            current.push(appointment);
            appointmentsByUser.set(appointment.user_id, current);
          }

          const patientRecords = await Promise.all(
            patients.map(async (patient) => ({
              id: patient.id,
              name: patient.name,
              initials: patient.initials,
              email: patient.email,
              phone: patient.phone,
              birthday: patient.birthday,
              gender: patient.gender,
              bloodType: patient.blood_type,
              emergencyContact: patient.emergency_contact,
              role: patient.role,
              status: patient.status,
              clinicalEditingPermission: patient.clinical_editing_permission === "true",
              insurance: patient.insurance_data,
              claims: patient.claims_data ?? [],
              lastActive: patient.updated_at,
              appointments: (appointmentsByUser.get(patient.id) ?? []).map(toAppointment),
              records: await loadPatientEncounters(patient.id),
            })),
          );
          return json({ patients: patientRecords });
        } catch (error) {
          console.error("[admin/patients GET]", error);
          return errorJson("Unable to load patients.", 500);
        }
      },
    },
  },
});
