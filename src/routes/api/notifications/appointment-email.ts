import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { buildAppointmentEmailHtml, sendAppointmentEmail } from "@/lib/api/email.server";

const appointmentEmailSchema = z.object({
  appointmentReference: z.string().min(1),
  patientName: z.string().min(1),
  email: z.string().email(),
  doctorName: z.string().min(1),
  specialty: z.string().min(1),
  clinicName: z.string().min(1),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
  status: z.string().min(1),
});

export const Route = createFileRoute("/api/notifications/appointment-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = appointmentEmailSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
        }

        const data = parsed.data;
        const html = buildAppointmentEmailHtml(data);

        const result = await sendAppointmentEmail({
          to: data.email,
          patientName: data.patientName,
          appointmentReference: data.appointmentReference,
          doctorName: data.doctorName,
          specialty: data.specialty,
          clinicName: data.clinicName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          status: data.status,
          htmlBody: html,
        });

        if (result.success) {
          return json({ sent: true, messageId: result.messageId }, 200);
        }
        // Return 207 so the frontend knows the appointment is fine but email failed
        return json({ sent: false, error: result.error }, 207);
      },
    },
  },
});
