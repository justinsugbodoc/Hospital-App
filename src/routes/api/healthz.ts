import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api/http.server";

export const Route = createFileRoute("/api/healthz")({
  server: {
    handlers: {
      GET: async () => {
        return json({ status: "ok" });
      },
    },
  },
});
