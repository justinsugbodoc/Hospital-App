import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyMedications } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { medicationSchema, publicMedication } from "@/lib/api/pharmacy.server";

export const Route = createFileRoute("/api/pharmacy/catalog/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) {
          return errorJson("Authorized pharmacy staff are required to update inventory.", 403);
        }
        const body = await readJson(request);
        const parsed = medicationSchema.safeParse({ ...body, id: params.id });
        if (!parsed.success) {
          return json({ error: "Invalid medication inventory record.", details: parsed.error.flatten() }, 400);
        }
        const item = parsed.data;

        try {
          const [saved] = await db
            .insert(sugbodocPharmacyMedications)
            .values({
              id: item.id,
              name: item.name,
              description: item.description,
              genericName: item.genericName,
              dosage: item.dosage,
              dosageForm: item.dosageForm,
              form: item.form,
              category: item.category,
              price: item.price.toFixed(2),
              stock: item.stock,
              enabled: item.enabled ? "true" : "false",
              partnerLocations: item.partnerLocations,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: sugbodocPharmacyMedications.id,
              set: {
                name: item.name,
                description: item.description,
                genericName: item.genericName,
                dosage: item.dosage,
                dosageForm: item.dosageForm,
                form: item.form,
                category: item.category,
                price: item.price.toFixed(2),
                stock: item.stock,
                enabled: item.enabled ? "true" : "false",
                partnerLocations: item.partnerLocations,
                updatedAt: new Date(),
              },
            })
            .returning();

          if (!saved) {
            return errorJson("Unable to save the medication.", 500);
          }

          const pub = {
            id: saved.id,
            name: saved.name,
            description: saved.description,
            generic_name: saved.genericName,
            dosage: saved.dosage,
            dosage_form: saved.dosageForm,
            form: saved.form,
            category: saved.category,
            price: saved.price,
            stock: saved.stock,
            enabled: saved.enabled,
            partner_locations: saved.partnerLocations as string[] | null,
            created_at: saved.createdAt.toISOString(),
            updated_at: saved.updatedAt.toISOString(),
          };

          return json({ medication: publicMedication(pub as any) });
        } catch (error) {
          console.error("[pharmacy/catalog/$id PUT]", error);
          return errorJson("Unable to save the medication.", 500);
        }
      },
      DELETE: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) {
          return errorJson("Authorized pharmacy staff are required to remove inventory.", 403);
        }
        const deleted = await db
          .delete(sugbodocPharmacyMedications)
          .where(eq(sugbodocPharmacyMedications.id, params.id))
          .returning({ id: sugbodocPharmacyMedications.id });

        if (!deleted || !deleted.length) {
          return errorJson("Medication not found.", 404);
        }
        return json({ deleted: true });
      },
    },
  },
});
