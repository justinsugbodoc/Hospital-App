import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers, sugbodocMessages, sugbodocAppointments, sugbodocEncounters } from "@/db/schema";
import { errorJson, json } from "@/lib/api/http.server";
import { doctorCanAccessPatient, getUserFromRequest, isAdminUser, isDoctorUser, MOCK_DOCTORS, ensureAllDemoDoctors, ensureDemoPatient, ensureDemoAdmin } from "@/lib/api/sugbodoc-auth.server";
import { ensureConversation, publicMessage, seedDemoMessageThreads, type MessageRow } from "@/lib/api/messages.server";

export const Route = createFileRoute("/api/messages/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        await ensureDemoAdmin();
        await ensureAllDemoDoctors();
        await ensureDemoPatient();
        await seedDemoMessageThreads();

        // Load all doctors map
        const doctorMap = new Map<string, { id: string; providerId: string; name: string; initials: string; specialty: string; clinic: string }>();
        for (const doc of MOCK_DOCTORS) {
          doctorMap.set(doc.providerId, {
            id: doc.id,
            providerId: doc.providerId,
            name: doc.name,
            initials: doc.initials,
            specialty: doc.specialty,
            clinic: doc.clinic,
          });
        }

        // Fetch all appointments for reference linking
        let allAppointments: Array<{ id: string; userId: string; reference: string; date: string; time: string; status: string; data: Record<string, any> }> = [];
        try {
          const apptRows = await db.select().from(sugbodocAppointments).orderBy(desc(sugbodocAppointments.createdAt));
          allAppointments = apptRows.map((a) => ({
            id: a.id,
            userId: a.userId,
            reference: a.reference,
            date: a.date,
            time: a.time,
            status: a.status,
            data: (a.data as Record<string, any>) ?? {},
          }));
        } catch (e) {
          console.warn("[messages/index] DB appointments fetch fallback:", e);
        }

        // Merge in-memory appointments
        const memAppts = Array.from(globalThis._memoryAppointments?.values() || []);
        for (const m of memAppts) {
          if (!allAppointments.some((a) => a.id === m.id)) {
            allAppointments.push({
              id: m.id,
              userId: m.user_id,
              reference: m.reference,
              date: m.date,
              time: m.time,
              status: m.status,
              data: (m.data as Record<string, any>) ?? {},
            });
          }
        }

        // Fetch all encounters for reference linking
        let allEncounters: Array<{ id: string; patientId: string; reference: string; appointmentId: string | null; data: Record<string, any> }> = [];
        try {
          const encRows = await db.select().from(sugbodocEncounters);
          allEncounters = encRows.map((e) => ({
            id: e.id,
            patientId: e.patientId,
            reference: e.reference,
            appointmentId: e.appointmentId,
            data: (e.data as Record<string, any>) ?? {},
          }));
        } catch (e) {
          // ignore
        }

        const conversations: Array<{
          conversation: { id: string; patient_id: string; type: "admin" | "doctor"; updated_at: string };
          patient: { id: string; name: string; initials: string; email: string };
          doctor?: { providerId: string; name: string; initials: string; specialty: string; clinic: string };
          appointment?: { id: string; reference: string; date: string; time: string; status: string };
          encounter?: { id: string; reference: string };
        }> = [];

        if (isAdminUser(user)) {
          let allPatientsData: Array<{ id: string; name: string; initials: string; email: string }> = [];
          try {
            allPatientsData = await db
              .select({
                id: sugbodocUsers.id,
                name: sugbodocUsers.name,
                initials: sugbodocUsers.initials,
                email: sugbodocUsers.email,
              })
              .from(sugbodocUsers)
              .where(eq(sugbodocUsers.role, "Patient"));
          } catch (e) {
            allPatientsData = [{ id: "pt_123", name: "Juan dela Cruz", initials: "JD", email: "juan@example.com" }];
          }

          for (const patient of allPatientsData) {
            const conversation = await ensureConversation(patient.id, "admin");
            conversations.push({ conversation, patient });
          }
        } else if (isDoctorUser(user)) {
          const doctorProviderId = user.providerId!;
          const currentDoctor = doctorMap.get(doctorProviderId) ?? {
            id: user.id,
            providerId: doctorProviderId,
            name: user.name,
            initials: user.initials,
            specialty: user.specialty,
            clinic: user.clinic,
          };

          // Find appointments assigned to this doctor
          const normDoctorProviderId = doctorProviderId.replace("doctor_", "");
          const doctorAppts = allAppointments.filter((a) => {
            const doc = a.data?.doctor;
            const dId = String(doc?.providerId || doc?.id || (a.data as any)?.doctorId || "").replace("doctor_", "");
            return dId === normDoctorProviderId;
          });

          const assignedPatientIds = new Set<string>();
          for (const appt of doctorAppts) {
            assignedPatientIds.add(appt.userId);
          }

          // Fallback demo patient assignment if none yet
          if (assignedPatientIds.size === 0) {
            assignedPatientIds.add("pt_123");
          }

          let patientsData: Array<{ id: string; name: string; initials: string; email: string }> = [];
          try {
            patientsData = await db
              .select({
                id: sugbodocUsers.id,
                name: sugbodocUsers.name,
                initials: sugbodocUsers.initials,
                email: sugbodocUsers.email,
              })
              .from(sugbodocUsers)
              .where(eq(sugbodocUsers.role, "Patient"));
          } catch (e) {
            patientsData = [{ id: "pt_123", name: "Juan dela Cruz", initials: "JD", email: "juan@example.com" }];
          }

          for (const patientId of Array.from(assignedPatientIds)) {
            const patient = patientsData.find((p) => p.id === patientId) ?? {
              id: patientId,
              name: "Juan dela Cruz",
              initials: "JD",
              email: "juan@example.com",
            };

            const conversation = await ensureConversation(patient.id, "doctor", normDoctorProviderId);
            const latestAppt = doctorAppts.find((a) => a.userId === patient.id);
            const latestEnc = allEncounters.find((e) => e.patientId === patient.id && (String(e.data?.doctorId || "").replace("doctor_", "") === normDoctorProviderId || e.appointmentId === latestAppt?.id));

            conversations.push({
              conversation,
              patient,
              doctor: currentDoctor,
              appointment: latestAppt ? { id: latestAppt.id, reference: latestAppt.reference, date: latestAppt.date, time: latestAppt.time, status: latestAppt.status } : undefined,
              encounter: latestEnc ? { id: latestEnc.id, reference: latestEnc.reference } : undefined,
            });
          }
        } else {
          // Patient user
          const patient = { id: user.id, name: user.name, initials: user.initials, email: user.email };

          // 1. Admin thread
          const adminConv = await ensureConversation(user.id, "admin");
          conversations.push({ conversation: adminConv, patient });

          // 2. Doctor threads for all booked appointments
          const patientAppts = allAppointments.filter((a) => a.userId === user.id);
          const bookedDoctorIds = new Set<string>();
          for (const appt of patientAppts) {
            const doc = appt.data?.doctor;
            const docId = doc?.providerId || doc?.id || (appt.data as any)?.doctorId;
            if (docId) {
              const cleanId = String(docId).replace("doctor_", "");
              bookedDoctorIds.add(cleanId);
              if (!doctorMap.has(cleanId) && doc?.name) {
                doctorMap.set(cleanId, {
                  id: `doctor_${cleanId}`,
                  providerId: cleanId,
                  name: doc.name,
                  initials: doc.initials || doc.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
                  specialty: doc.specialty || "Specialist",
                  clinic: doc.clinic || "Clinic",
                });
              }
            }
          }

          // Always ensure the mock doctors are available for patient messaging if demo patient
          if (bookedDoctorIds.size === 0 || user.id === "pt_123" || user.email === "juan@example.com") {
            bookedDoctorIds.add("dr_2"); // Dr. Jose Reyes
            bookedDoctorIds.add("dr_1"); // Dr. Maria Santos
            bookedDoctorIds.add("dr_3"); // Dr. Ana Villanueva
          }

          for (const docId of Array.from(bookedDoctorIds)) {
            const docInfo = doctorMap.get(docId) ?? {
              id: `doctor_${docId}`,
              providerId: docId,
              name: docId === "dr_1" ? "Dr. Maria Santos" : docId === "dr_2" ? "Dr. Jose Reyes" : docId === "dr_3" ? "Dr. Ana Villanueva" : docId === "dr_4" ? "Dr. Carlo Mendoza" : docId === "dr_5" ? "Dr. Lea Fernandez" : "Doctor",
              initials: docId === "dr_1" ? "MS" : docId === "dr_2" ? "JR" : docId === "dr_3" ? "AV" : docId === "dr_4" ? "CM" : docId === "dr_5" ? "LF" : "DR",
              specialty: docId === "dr_1" ? "Internal Medicine" : docId === "dr_2" ? "Cardiology" : docId === "dr_3" ? "OB-GYN" : docId === "dr_4" ? "Dermatology" : docId === "dr_5" ? "Pediatrics" : "Specialist",
              clinic: docId === "dr_1" ? "Cebu Doctors' University Hospital" : docId === "dr_2" ? "Chong Hua Hospital" : docId === "dr_3" ? "Perpetual Succour Hospital" : docId === "dr_4" ? "Vicente Sotto Memorial Medical Center" : docId === "dr_5" ? "Cebu Doctors' University Hospital" : "Clinic",
            };

            const docConv = await ensureConversation(user.id, "doctor", docId);
            const latestAppt = patientAppts.find((a) => {
              const d = a.data?.doctor;
              const dId = String(d?.providerId || d?.id || (a.data as any)?.doctorId || "").replace("doctor_", "");
              return dId === docId;
            });
            const latestEnc = allEncounters.find((e) => e.patientId === user.id && (String(e.data?.doctorId || "").replace("doctor_", "") === docId || e.appointmentId === latestAppt?.id));

            conversations.push({
              conversation: docConv,
              patient,
              doctor: docInfo,
              appointment: latestAppt ? { id: latestAppt.id, reference: latestAppt.reference, date: latestAppt.date, time: latestAppt.time, status: latestAppt.status } : undefined,
              encounter: latestEnc ? { id: latestEnc.id, reference: latestEnc.reference } : undefined,
            });
          }
        }

        let allMessages: MessageRow[] = [];
        try {
          const allMessagesData = await db
            .select()
            .from(sugbodocMessages)
            .orderBy(desc(sugbodocMessages.createdAt));

          allMessages = allMessagesData.map((m) => ({
            id: m.id,
            conversation_id: m.conversationId,
            sender_id: m.senderId,
            body: m.body,
            read_at: m.readAt ? m.readAt.toISOString() : null,
            created_at: m.createdAt.toISOString(),
          }));
        } catch (e) {
          console.warn("[messages/index] DB messages fetch fallback:", e);
        }

        // Merge in-memory messages
        const memMsgs = Array.from(globalThis._memoryMessages?.values() || []);
        for (const m of memMsgs) {
          if (!allMessages.some((msg) => msg.id === m.id)) {
            allMessages.push(m);
          }
        }

        let sendersData: Array<{ id: string; name: string; initials: string; role: string }> = [];
        try {
          sendersData = await db
            .select({
              id: sugbodocUsers.id,
              name: sugbodocUsers.name,
              initials: sugbodocUsers.initials,
              role: sugbodocUsers.role,
            })
            .from(sugbodocUsers);
        } catch (e) {
          // ignore
        }

        const senderMap = new Map(sendersData.map((sender) => [sender.id, sender]));
        // Fallbacks for known seed senders
        senderMap.set("doctor_dr_2", { id: "doctor_dr_2", name: "Dr. Jose Reyes", initials: "JR", role: "Doctor" });
        senderMap.set("doctor_dr_1", { id: "doctor_dr_1", name: "Dr. Maria Santos", initials: "MS", role: "Doctor" });
        senderMap.set("doctor_dr_3", { id: "doctor_dr_3", name: "Dr. Ana Villanueva", initials: "AV", role: "Doctor" });
        senderMap.set("doctor_dr_4", { id: "doctor_dr_4", name: "Dr. Carlo Mendoza", initials: "CM", role: "Doctor" });
        senderMap.set("doctor_dr_5", { id: "doctor_dr_5", name: "Dr. Lea Fernandez", initials: "LF", role: "Doctor" });
        senderMap.set("usr_admin_default", { id: "usr_admin_default", name: "SugboDoc Administrator", initials: "SA", role: "Admin" });
        senderMap.set("pt_123", { id: "pt_123", name: "Juan dela Cruz", initials: "JD", role: "Patient" });

        const result = conversations
          .map(({ conversation, patient, doctor, appointment, encounter }) => {
            const threadMessages = allMessages.filter((message) => message.conversation_id === conversation.id);
            const latest = threadMessages[0];
            return {
              id: conversation.id,
              type: conversation.type,
              patientId: patient.id,
              patientName: patient.name,
              patientInitials: patient.initials,
              patientEmail: patient.email,
              doctorId: doctor?.providerId,
              doctorName: doctor?.name,
              doctorSpecialty: doctor?.specialty,
              doctorClinic: doctor?.clinic,
              doctorInitials: doctor?.initials,
              appointmentId: appointment?.id,
              appointmentReference: appointment?.reference,
              appointmentDate: appointment?.date,
              appointmentTime: appointment?.time,
              appointmentStatus: appointment?.status,
              encounterId: encounter?.id,
              encounterReference: encounter?.reference,
              updatedAt: latest?.created_at ?? conversation.updated_at,
              unreadCount: threadMessages.filter((message) => message.sender_id !== user.id && !message.read_at).length,
              lastMessage: latest ? publicMessage(latest, senderMap.get(latest.sender_id)) : null,
            };
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return json({ conversations: result });
      },
    },
  },
});

