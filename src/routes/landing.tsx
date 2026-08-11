import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import SugboDocApp from "@/components/sugbodoc-app";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "SugboDoc — Your Lifelong Digital Health Record" },
      {
        name: "description",
        content:
          "SugboDoc brings appointments, medical records, pharmacy orders, billing and insurance claims into one secure health record for patients and clinics in Cebu.",
      },
      { property: "og:title", content: "SugboDoc — Your Lifelong Digital Health Record" },
      {
        property: "og:description",
        content:
          "Book appointments, keep every medical record, pay bills, order medicine and file insurance claims in one secure portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingRoute,
});

function LandingRoute() {
  return (
    <ClientOnly>
      <SugboDocApp />
    </ClientOnly>
  );
}
