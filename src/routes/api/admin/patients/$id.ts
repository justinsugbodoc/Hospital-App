import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers } from "@/db/schema";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { loadPatientEncounters } from "@/lib/api/clinical-records.server";

type PatientRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  blood_type: string;
  emergency_contact: { name: string; number: string } | null;
  role: string;
  status: string;
  clinical_editing_permission: string;
  insurance_data: Record<string, unknown> | null;
  claims_data: Record<string, unknown>[] | null;
  updated_at: string;
};

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  insurance: z.record(z.string(), z.unknown()).nullable().optional(),
  claims: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const Route = createFileRoute("/api/admin/patients/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) return errorJson("Admin access required.", 403);

        const parsed = patchSchema.safeParse(await readJson(request));
        if (
          !parsed.success ||
          (!parsed.data.name &&
            !parsed.data.status &&
            parsed.data.insurance === undefined &&
            parsed.data.claims === undefined)
        ) {
          return errorJson("A valid patient name or status is required.", 400);
        }

        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (parsed.data.name) {
          patch['name'] = parsed.data.name;
          patch['initials'] = parsed.data.name
            .trim()
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        }
        if (parsed.data.status) patch['status'] = parsed.data.status;
        if (parsed.data.insurance !== undefined) patch['insuranceData'] = parsed.data.insurance;
        if (parsed.data.claims !== undefined) patch['claimsData'] = parsed.data.claims;

        try {
          const [patient] = await db
            .update(sugbodocUsers)
            .set(patch as any)
            .where(and(eq(sugbodocUsers.id, params.id), eq(sugbodocUsers.role, "Patient")))
            .returning();

          if (!patient) return errorJson("Patient not found.", 404);

          const row: PatientRow = {
            id: patient.id,
            name: patient.name,
            initials: patient.initials,
            email: patient.email,
            phone: patient.phone,
            birthday: patient.birthday,
            gender: patient.gender,
            blood_type: patient.bloodType,
            emergency_contact: patient.emergencyContact as { name: string; number: string } | null,
            role: patient.role,
            status: patient.status,
            clinical_editing_permission: patient.clinicalEditingPermission,
            insurance_data: patient.insuranceData as Record<string, unknown> | null,
            claims_data: patient.claimsData as Record<string, unknown>[] | null,
            updated_at: patient.updatedAt.toISOString(),
          };

          return json({
            patient: {
              id: row.id,
              name: row.name,
              initials: row.initials,
              email: row.email,
              phone: row.phone,
              birthday: row.birthday,
              gender: row.gender,
              bloodType: row.blood_type,
              emergencyContact: row.emergency_contact,
              role: row.role,
              status: row.status,
              clinicalEditingPermission: row.clinical_editing_permission === "true",
              insurance: row.insurance_data,
              claims: row.claims_data ?? [],
              lastActive: row.updated_at,
              appointments: [],
              records: await loadPatientEncounters(row.id),
            },
          });
        } catch (error) {
          console.error("[admin/patients/$id PATCH]", error);
          return errorJson("Unable to update the patient.", 500);
        }
      },
    },
  },
});
