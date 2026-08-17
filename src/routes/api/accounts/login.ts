import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { createSession, ensureDemoAdmin, ensureAllDemoDoctors, loginUser } from "@/lib/api/sugbodoc-auth.server";

const loginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  identifier: z.string().optional(),
  password: z.string().min(1),
}).refine((data) => Boolean(data.email || data.username || data.identifier), {
  message: "Username or email is required.",
});

export const Route = createFileRoute("/api/accounts/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
          return errorJson("Username/email and password are required.", 400);
        }
        const identifier = parsed.data.identifier || parsed.data.username || parsed.data.email || "";
        try {
          await ensureDemoAdmin();
          await ensureAllDemoDoctors();
          const user = await loginUser(identifier, parsed.data.password);
          if (!user) return errorJson("Invalid username/email or password.", 401);
          return json(await createSession(user));
        } catch (error) {
          console.error("[accounts/login]", error);
          return errorJson("Unable to sign in right now.", 500);
        }
      },
    },
  },
});

