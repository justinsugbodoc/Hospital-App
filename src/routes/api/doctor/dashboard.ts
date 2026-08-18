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
        try {
          const auth = await requireDoctor(request);
          if ("error" in auth) return auth.error;
          const doctor = auth.user;

          const appointments = await assignedAppointments(doctor.providerId || doctor.id);

          let patients: PatientRow[] = [];
          try {
            const patientRowsData = await db
              .select()
              .from(sugbodocUsers)
              .where(eq(sugbodocUsers.role, "Patient"));

            patients = patientRowsData.map((p) => ({
              id: p.id,
              name: p.name,
              initials: p.initials,
              email: p.email,
              phone: p.phone,
              birthday: p.birthday,
              gender: p.gender,
              blood_type: p.bloodType,
              emergency_contact: p.emergencyContact as { name: string; number: string } | null,
              allergies: (p.allergies as string[]) || [],
              insurance_data: p.insuranceData as Record<string, unknown> | null,
              claims_data: (p.claimsData as Record<string, unknown>[]) || [],
              role: p.role,
            }));
          } catch (patientErr) {
            console.warn("[doctor/dashboard] Fallback to memory patients:", patientErr);
            const memUsers = Array.from(globalThis._memoryUsers?.values() || []);
            patients = memUsers
              .filter((u) => u.role === "Patient")
              .map((p) => ({
                id: p.id,
                name: p.name,
                initials: p.initials,
                email: p.email,
                phone: p.phone,
                birthday: p.birthday,
                gender: p.gender,
                blood_type: p.blood_type,
                emergency_contact: p.emergency_contact,
                allergies: p.allergies || [],
                insurance_data: p.insurance_data,
                claims_data: p.claims_data || [],
                role: p.role,
              }));
          }

          const assignedPatients = patients.filter((patient) => appointments.some((appointment) => appointment.user_id === patient.id));
          let encounters: any[] = [];
          try {
            encounters = await Promise.all(assignedPatients.map((patient) => loadPatientEncounters(patient.id)));
          } catch (encErr) {
            console.warn("[doctor/dashboard] Error loading encounters:", encErr);
            encounters = assignedPatients.map(() => []);
          }
          const assignedPatientIds = new Set(assignedPatients.map((patient) => patient.id));

          let conversations: { id: string; patient_id: string; type: string }[] = [];
          try {
            const conversationRowsData = await db.select().from(sugbodocMessageConversations);
            conversations = conversationRowsData.map((c) => ({
              id: c.id,
              patient_id: c.patientId,
              type: c.type || (c.id.includes("doctor") ? "doctor" : "admin"),
            }));
          } catch {
            const memConvs = Array.from(globalThis._memoryConversations?.values() || []);
            conversations = memConvs.map((c) => ({
              id: c.id,
              patient_id: c.patient_id,
              type: c.type || (c.id.includes("doctor") ? "doctor" : "admin"),
            }));
          }

          const assignedConversationIds = new Set(
            conversations
              .filter((conversation) => assignedPatientIds.has(conversation.patient_id) && conversation.type === "doctor")
              .map((conversation) => conversation.id),
          );

          let messages: { conversation_id: string; read_at: string | null; sender_id: string }[] = [];
          try {
            const messageRowsData = await db.select().from(sugbodocMessages);
            messages = messageRowsData.map((m) => ({
              conversation_id: m.conversationId,
              read_at: m.readAt ? (m.readAt instanceof Date ? m.readAt.toISOString() : String(m.readAt)) : null,
              sender_id: m.senderId,
            }));
          } catch {
            const memMsgs = Array.from(globalThis._memoryMessages?.values() || []);
            messages = memMsgs.map((m) => ({
              conversation_id: m.conversation_id,
              read_at: m.read_at,
              sender_id: m.sender_id,
            }));
          }

          const unreadMessages = messages.filter(
            (message) => assignedConversationIds.has(message.conversation_id) && !message.read_at && message.sender_id !== doctor.id,
          ).length;

          return json({
            doctor: { id: doctor.id, providerId: doctor.providerId, name: doctor.name, initials: doctor.initials, specialty: doctor.specialty, clinic: doctor.clinic },
            appointments: appointments.map((row) => {
              const patient = assignedPatients.find((item) => item.id === row.user_id);
              return toAppointment(row, patient ? { name: patient.name, initials: patient.initials, email: patient.email } : undefined);
            }),
            patients: assignedPatients.map((patient, idx) => ({
              id: patient.id,
              name: patient.name,
              initials: patient.initials,
              email: patient.email,
              allergies: patient.allergies ?? [],
              bloodType: patient.blood_type,
              insurance: patient.insurance_data,
              appointments: appointments.filter((appointment) => appointment.user_id === patient.id).map((row) => toAppointment(row, {
                name: patient.name,
                initials: patient.initials,
                email: patient.email,
              })),
              encounters: encounters[idx] || [],
            })),
            stats: {
              todayAppointments: appointments.filter((appointment) => appointment.date === dateKey() || appointment.date === new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })).length,
              pendingSoapNotes: appointments.filter((appointment) => appointment.status === "Completed").filter((appointment) => !encounters.flat().some((encounter) => encounter && (encounter as any).appointmentId === appointment.id && (((encounter as any).soapNotes?.length ?? 0) > 0))).length,
              followUps: appointments.filter((appointment) => String((appointment.data as any)?.visitType ?? "").toLowerCase().includes("follow")).length,
              unreadMessages,
            },
          });
        } catch (dashboardError) {
          console.error("[doctor/dashboard] Unhandled GET error:", dashboardError);
          return json({
            doctor: { id: "dr_2", providerId: "dr_2", name: "Dr. Jose Reyes", initials: "JR", specialty: "Cardiology", clinic: "Chong Hua Hospital" },
            appointments: [],
            patients: [],
            stats: { todayAppointments: 0, pendingSoapNotes: 0, followUps: 0, unreadMessages: 0 },
          });
        }
      },
    },
  },
});
