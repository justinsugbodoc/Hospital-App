import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { createSession, registerUser } from "@/lib/api/sugbodoc-auth.server";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(1),
  birthday: z.string().min(1),
  gender: z.string().min(1),
  password: z.string().min(8),
});

export const Route = createFileRoute("/api/accounts/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = registrationSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return json({ error: "Invalid registration details", details: parsed.error.flatten() }, 400);
        }
        try {
          const user = await registerUser({ ...parsed.data, name: parsed.data.fullName });
          return json(await createSession(user), 201);
        } catch (error: any) {
          if (error?.code === "23505" || error?.code === "23505" || String(error?.message ?? "").includes("duplicate key")) {
            return errorJson("An account with this email already exists.", 409);
          }
          console.error("[accounts/register]", error);
          return errorJson("Unable to create the account.", 500);
        }
      },
    },
  },
});
