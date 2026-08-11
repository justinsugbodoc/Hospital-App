import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocEncounters, sugbodocClinicalRecords } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { encounterSchema, loadPatientEncounters, upsertEncounter } from "@/lib/api/clinical-records.server";

export const Route = createFileRoute("/api/records/$encounterId/")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const encounterId = params.encounterId;
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) {
          return errorJson("Authorized clinical staff are required to update clinical records.", 403);
        }

        const parsed = encounterSchema.safeParse(await readJson(request));
        if (!parsed.success || parsed.data.id !== encounterId) {
          return errorJson("Invalid encounter record.", 400);
        }

        const existingRows = await db
          .select()
          .from(sugbodocEncounters)
          .where(eq(sugbodocEncounters.id, encounterId))
          .limit(1);

        const existing = existingRows[0];
        if (!existing || existing.patientId !== parsed.data.patientId) {
          return errorJson("Encounter not found.", 404);
        }

        await db.delete(sugbodocClinicalRecords).where(eq(sugbodocClinicalRecords.encounterId, encounterId));
        await upsertEncounter(parsed.data.patientId, parsed.data);

        const encounters = await loadPatientEncounters(parsed.data.patientId);
        return json({ encounter: encounters.find((item) => item.id === encounterId) });
      },
    },
  },
});
