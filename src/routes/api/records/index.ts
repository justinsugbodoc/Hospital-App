import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers } from "@/db/schema";
import { errorJson, json, readJson, searchParams } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { encounterSchema, loadPatientEncounters, upsertEncounter } from "@/lib/api/clinical-records.server";

export const Route = createFileRoute("/api/records/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestedPatientId = searchParams(request).get("patientId") ?? undefined;
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);
        if (!isAdminUser(user) && requestedPatientId && requestedPatientId !== user.id) {
          return errorJson("You are not authorized to access another patient's records.", 403);
        }
        const patientId = isAdminUser(user) ? requestedPatientId : user.id;
        if (!patientId) return errorJson("A patientId is required for admin requests.", 400);

        const patientRows = await db
          .select({ id: sugbodocUsers.id })
          .from(sugbodocUsers)
          .where(eq(sugbodocUsers.id, patientId))
          .limit(1);

        if (!patientRows[0]) return errorJson("Patient not found.", 404);

        return json({ patientId, encounters: await loadPatientEncounters(patientId) });
      },
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) {
          return errorJson("Authorized clinical staff are required to create clinical records.", 403);
        }
        const parsed = encounterSchema.safeParse(await readJson(request));
        if (!parsed.success) return errorJson("Invalid encounter record.", 400);

        const created = await upsertEncounter(parsed.data.patientId, parsed.data);
        if (!created) {
          return errorJson("Encounter already belongs to another patient or could not be created.", 409);
        }
        const encounters = await loadPatientEncounters(parsed.data.patientId);
        return json({ encounter: encounters.find((item) => item.id === parsed.data.id) }, 201);
      },
    },
  },
});
