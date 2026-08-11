import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { loadPatientEncounters, upsertEncounter } from "@/lib/api/clinical-records.server";

const migrateSchema = z.object({
  patientId: z.string().min(1),
  encounters: z.array(z.unknown()).max(100),
});

export const Route = createFileRoute("/api/records/migrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = migrateSchema.safeParse(await readJson(request));
        if (!parsed.success) return errorJson("Invalid records migration payload.", 400);

        if (!isAdminUser(user) && parsed.data.patientId !== user.id) {
          return errorJson("You are not authorized to migrate this patient.", 403);
        }

        for (const encounter of parsed.data.encounters) {
          await upsertEncounter(parsed.data.patientId, encounter);
        }
        return json(
          { patientId: parsed.data.patientId, encounters: await loadPatientEncounters(parsed.data.patientId) },
          201,
        );
      },
    },
  },
});
