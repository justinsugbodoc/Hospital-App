import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocEncounters, sugbodocClinicalRecords } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { loadPatientEncounters, upsertEncounter } from "@/lib/api/clinical-records.server";

const patchSchema = z.object({
  pharmacyOrders: z.array(z.unknown()).optional(),
  bills: z.array(z.unknown()).optional(),
  payments: z.array(z.unknown()).optional(),
  billing: z.record(z.string(), z.unknown()).optional(),
  claims: z.array(z.unknown()).optional(),
});

export const Route = createFileRoute("/api/records/$encounterId/patient-data")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const encounterId = params.encounterId;
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = patchSchema.safeParse(await readJson(request));
        if (!parsed.success) return errorJson("Invalid patient record update.", 400);

        const existingRows = await db
          .select()
          .from(sugbodocEncounters)
          .where(eq(sugbodocEncounters.id, encounterId))
          .limit(1);

        const existing = existingRows[0];
        if (!existing) return errorJson("Encounter not found.", 404);

        if (!isAdminUser(user) && existing.patientId !== user.id) {
          return errorJson("You are not authorized to update this patient's records.", 403);
        }

        const current = (await loadPatientEncounters(existing.patientId))
          .find((item) => item.id === encounterId);
        if (!current) return errorJson("Encounter not found.", 404);

        const currentRecord = current as Record<string, any>;
        const updated = {
          ...currentRecord,
          ...parsed.data,
          pharmacyOrders: parsed.data.pharmacyOrders ?? currentRecord.pharmacyOrders ?? [],
          bills: parsed.data.bills ?? currentRecord.bills ?? [],
          payments: parsed.data.payments ?? currentRecord.billing?.payments ?? [],
          claims: parsed.data.claims ?? currentRecord.claims ?? [],
          billing: { ...(currentRecord.billing ?? {}), ...(parsed.data.billing ?? {}) },
        };

        await db.delete(sugbodocClinicalRecords).where(eq(sugbodocClinicalRecords.encounterId, encounterId));
        await upsertEncounter(existing.patientId, updated);

        const encounters = await loadPatientEncounters(existing.patientId);
        return json({ encounter: encounters.find((item) => item.id === encounterId) });
      },
    },
  },
});
