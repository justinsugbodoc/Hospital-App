import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import SugboDocApp from "@/components/sugbodoc-app";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: "SugboDoc Patient Portal | Health Records & Appointments" },
      {
        name: "description",
        content:
          "Sign in to SugboDoc to manage appointments, health records, bills, prescriptions and messages with your doctor.",
      },
      { property: "og:title", content: "SugboDoc Patient Portal" },
      {
        property: "og:description",
        content:
          "Manage appointments, health records, bills and prescriptions in the SugboDoc patient portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SplatPage,
});

function SplatPage() {
  return (
    <ClientOnly>
      <SugboDocApp />
    </ClientOnly>
  );
}
