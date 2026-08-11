import { createFileRoute } from "@tanstack/react-router";
import { errorJson, json } from "@/lib/api/http.server";
import { patientSummary, recordAudit, requireDoctor } from "@/lib/api/doctor.server";

export const Route = createFileRoute("/api/doctor/patients/$patientId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireDoctor(request);
        if ("error" in auth) return auth.error;
        const doctor = auth.user;

        const patient = await patientSummary(params.patientId, doctor.providerId!);
        if (!patient) {
          return errorJson("Patient is not assigned to this doctor.", 404);
        }
        await recordAudit(doctor.name, "Viewed patient record", `${patient.name} (${patient.id})`);
        return json({ patient });
      },
    },
  },
});
