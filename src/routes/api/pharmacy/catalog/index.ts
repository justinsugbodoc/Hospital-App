import { createFileRoute } from "@tanstack/react-router";
import { errorJson, json } from "@/lib/api/http.server";
import { ensureCatalog, publicMedication } from "@/lib/api/pharmacy.server";

export const Route = createFileRoute("/api/pharmacy/catalog/")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const catalog = await ensureCatalog();
          return json({ medications: catalog.map(publicMedication) });
        } catch (error) {
          console.error("[pharmacy/catalog GET]", error);
          return errorJson("Unable to load the pharmacy catalog.", 500);
        }
      },
    },
  },
});
