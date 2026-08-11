import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers, sugbodocMessageConversations, sugbodocMessages } from "@/db/schema";
import { json } from "@/lib/api/http.server";
import {
  assignedAppointments,
  dateKey,
  loadPatientEncounters,
  requireDoctor,
  toAppointment,
  type PatientRow,
} from "@/lib/api/doctor.server";

export const Route = createFileRoute("/api/doctor/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireDoctor(request);
        if ("error" in auth) return auth.error;
        const doctor = auth.user;

        const appointments = await assignedAppointments(doctor.providerId!);

        const patientRowsData = await db
          .select()
          .from(sugbodocUsers)
          .where(eq(sugbodocUsers.role, "Patient"));

        const patients: PatientRow[] = patientRowsData.map((p) => ({
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
        }));

        const assignedPatients = patients.filter((patient) => appointments.some((appointment) => appointment.user_id === patient.id));
        const encounters = await Promise.all(assignedPatients.map((patient) => loadPatientEncounters(patient.id)));
        const assignedPatientIds = new Set(assignedPatients.map((patient) => patient.id));

        const conversationRowsData = await db.select().from(sugbodocMessageConversations);
        const conversations = conversationRowsData.map((c) => ({ id: c.id, patient_id: c.patientId }));
        const assignedConversationIds = new Set(
          conversations.filter((conversation) => assignedPatientIds.has(conversation.patient_id)).map((conversation) => conversation.id),
        );

        const messageRowsData = await db.select().from(sugbodocMessages);
        const messages = messageRowsData.map((m) => ({
          conversation_id: m.conversationId,
          read_at: m.readAt ? m.readAt.toISOString() : null,
          sender_id: m.senderId,
        }));

        const unreadMessages = messages.filter(
          (message) => assignedConversationIds.has(message.conversation_id) && !message.read_at && message.sender_id !== doctor.id,
        ).length;

        return json({
          doctor: { id: doctor.id, providerId: doctor.providerId, name: doctor.name, initials: doctor.initials, specialty: doctor.specialty, clinic: doctor.clinic },
          appointments: appointments.map((row) => {
            const patient = assignedPatients.find((item) => item.id === row.user_id);
            return toAppointment(row, patient ? { name: patient.name, initials: patient.initials, email: patient.email } : undefined);
          }),
          patients: assignedPatients.map((patient) => ({
            id: patient.id, name: patient.name, initials: patient.initials, email: patient.email,
            allergies: patient.allergies ?? [], bloodType: patient.blood_type, insurance: patient.insurance_data,
            appointments: appointments.filter((appointment) => appointment.user_id === patient.id).map((row) => toAppointment(row, {
              name: patient.name,
              initials: patient.initials,
              email: patient.email,
            })),
            encounters: encounters[assignedPatients.indexOf(patient)],
          })),
          stats: {
            todayAppointments: appointments.filter((appointment) => appointment.date === dateKey() || appointment.date === new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })).length,
            pendingSoapNotes: appointments.filter((appointment) => appointment.status === "Completed").filter((appointment) => !encounters.flat().some((encounter) => (encounter as any).appointmentId === appointment.id && (((encounter as any).soapNotes?.length ?? 0) > 0))).length,
            followUps: appointments.filter((appointment) => String((appointment.data as any)?.visitType ?? "").toLowerCase().includes("follow")).length,
            unreadMessages,
          },
        });
      },
    },
  },
});
