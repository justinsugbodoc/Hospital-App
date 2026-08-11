import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocClinicalRecords } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest } from "@/lib/api/sugbodoc-auth.server";
import { createCheckoutSession, getStripeSecretKey } from "@/lib/api/stripe.server";

const checkoutSchema = z.object({
  billId: z.string().min(1),
  billIds: z.array(z.string().min(1)).min(1).max(100).optional(),
  description: z.string().min(1).max(200),
  amount: z.number().finite().positive().max(1_000_000),
  insuranceCoverageAmount: z.number().finite().min(0).optional().default(0),
  patientEmail: z.string().email().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

async function getPatientBillRecords(patientId: string) {
  const records = await db
    .select()
    .from(sugbodocClinicalRecords)
    .where(and(eq(sugbodocClinicalRecords.patientId, patientId), eq(sugbodocClinicalRecords.recordType, "bills")));
  return records;
}

export const Route = createFileRoute("/api/stripe/create-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = checkoutSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return json({ error: "Invalid checkout request", details: parsed.error.flatten() }, 400);
        }

        const secretKey = getStripeSecretKey();
        if (!secretKey) return errorJson("Payments are not configured yet. Add a Stripe secret key to enable checkout.", 503);

        try {
          const data = parsed.data;
          const requestedBillIds = data.billIds ?? (data.billId === "all-bills" ? [] : [data.billId]);
          const billRecords = await getPatientBillRecords(user.id);
          const patientBills = billRecords.map((record) => record.data as Record<string, any>);
          const billIds = requestedBillIds.length
            ? requestedBillIds
            : patientBills.filter((bill) => bill.status !== "Paid").map((bill) => String(bill.id));
          const ownedBills = patientBills.filter((bill) => billIds.includes(String(bill.id)) && bill.status !== "Paid");
          if (!ownedBills.length) {
            return errorJson("No unpaid database bills were found for this patient.", 404);
          }

          const session = await createCheckoutSession(secretKey, {
            mode: "payment",
            line_items: [
              {
                price_data: {
                  currency: "php",
                  product_data: { name: data.description },
                  unit_amount: Math.round(data.amount * 100),
                },
                quantity: 1,
              },
            ],
            customer_email: user.email,
            client_reference_id: billIds.length === 1 ? billIds[0] : "all-bills",
            metadata: {
              billId: billIds.length === 1 ? billIds[0] : "all-bills",
              billIds: billIds.join(","),
              patientId: user.id,
              insuranceCoverageAmount: data.insuranceCoverageAmount.toFixed(2),
            },
            success_url: data.successUrl,
            cancel_url: data.cancelUrl,
          });

          if (!session.url) {
            return errorJson("Stripe did not return a checkout URL", 502);
          }

          return json({ checkoutUrl: session.url, sessionId: session.id });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to create checkout session";
          return errorJson(message, 502);
        }
      },
    },
  },
});
