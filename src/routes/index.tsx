import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import SugboDocApp from "@/components/sugbodoc-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SugboDoc Patient Portal | Health Records & Appointments" },
      {
        name: "description",
        content:
          "Access your health records, appointments, bills, prescriptions and lab results with SugboDoc, the patient portal for clinics in Cebu, Philippines.",
      },
      { property: "og:title", content: "SugboDoc Patient Portal" },
      {
        property: "og:description",
        content:
          "Health records, appointments, bills and prescriptions in one patient portal for the Philippines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <ClientOnly>
      <SugboDocApp />
    </ClientOnly>
  );
}
