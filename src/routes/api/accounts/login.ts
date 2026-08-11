import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { createSession, ensureDemoAdmin, ensureDemoDoctor, loginUser } from "@/lib/api/sugbodoc-auth.server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const Route = createFileRoute("/api/accounts/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = loginSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return errorJson("Email and password are required.", 400);
        }
        try {
          await ensureDemoAdmin();
          await ensureDemoDoctor();
          const user = await loginUser(parsed.data.email, parsed.data.password);
          if (!user) return errorJson("Invalid email or password.", 401);
          return json(await createSession(user));
        } catch (error) {
          console.error("[accounts/login]", error);
          return errorJson("Unable to sign in right now.", 500);
        }
      },
    },
  },
});
