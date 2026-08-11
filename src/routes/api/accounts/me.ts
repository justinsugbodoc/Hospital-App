import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, toPublicUser, type UserRow } from "@/lib/api/sugbodoc-auth.server";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).optional(),
  birthday: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  insurance: z.record(z.string(), z.unknown()).nullable().optional(),
  claims: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const Route = createFileRoute("/api/accounts/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getUserFromRequest(request);
          if (!user) return errorJson("Not signed in.", 401);
          return json({ user });
        } catch (error) {
          console.error("[accounts/me GET]", error);
          return errorJson("Unable to load the account.", 500);
        }
      },
      PATCH: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = patchSchema.safeParse(await readJson(request));
        if (!parsed.success) return errorJson("Invalid profile details.", 400);

        const input = parsed.data;
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name) {
          patch['name'] = input.name;
          patch['initials'] = input.name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        }
        if (input.email) patch['email'] = input.email.trim().toLowerCase();
        if (input.phone) patch['phone'] = input.phone;
        if (input.birthday) patch['birthday'] = input.birthday;
        if (input.gender) patch['gender'] = input.gender;
        if (input.insurance !== undefined) patch['insuranceData'] = input.insurance;
        if (input.claims) patch['claimsData'] = input.claims;

        try {
          const [updated] = await db
            .update(sugbodocUsers)
            .set(patch as any)
            .where(eq(sugbodocUsers.id, user.id))
            .returning();

          if (!updated) return errorJson("User not found.", 404);

          const row: UserRow = {
            id: updated.id,
            name: updated.name,
            initials: updated.initials,
            email: updated.email,
            password_hash: updated.passwordHash,
            phone: updated.phone,
            birthday: updated.birthday,
            gender: updated.gender,
            blood_type: updated.bloodType,
            emergency_contact: updated.emergencyContact as { name: string; number: string } | null,
            role: updated.role,
            provider_id: updated.providerId,
            specialty: updated.specialty,
            clinic: updated.clinic,
            allergies: updated.allergies as string[] | null,
            status: updated.status,
            clinical_editing_permission: updated.clinicalEditingPermission,
            insurance_data: updated.insuranceData as Record<string, unknown> | null,
            claims_data: updated.claimsData as Record<string, unknown>[] | null,
            created_at: updated.createdAt.toISOString(),
            updated_at: updated.updatedAt.toISOString(),
          };

          return json({ user: toPublicUser(row) });
        } catch (error: any) {
          if (error?.code === "23505") return errorJson("That email address is already in use.", 409);
          console.error("[accounts/me PATCH]", error);
          return errorJson("Unable to update the profile.", 500);
        }
      },
    },
  },
});
