import { createFileRoute } from "@tanstack/react-router";
import { errorJson, json } from "@/lib/api/http.server";
import { getStripeSecretKey, retrieveCheckoutSession } from "@/lib/api/stripe.server";

export const Route = createFileRoute("/api/stripe/checkout-session/$sessionId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^cs_[A-Za-z0-9_]+$/.test(params.sessionId)) {
          return errorJson("Invalid checkout session ID", 400);
        }

        const secretKey = getStripeSecretKey();
        if (!secretKey) return errorJson("Payments are not configured yet. Add a Stripe secret key to enable checkout.", 503);

        try {
          const session = await retrieveCheckoutSession(secretKey, params.sessionId);
          return json({
            status: session.payment_status,
            billId: session.metadata?.billId ?? session.client_reference_id,
            orderType: session.metadata?.orderType,
            medicationOrderId: session.metadata?.medicationOrderId,
            amountTotal: session.amount_total,
            currency: session.currency,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to retrieve checkout session";
          return errorJson(message, 502);
        }
      },
    },
  },
});
