import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { medicationCatalog } from "@/lib/api/pharmacy.server";
import { createCheckoutSession, getStripeSecretKey } from "@/lib/api/stripe.server";

const medicationItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive().max(100),
});

const medicationCheckoutSchema = z.object({
  cartItems: z.array(medicationItemSchema).min(1).max(50),
  insuranceCoverageAmount: z.number().finite().min(0).optional().default(0),
  fulfillmentDetails: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("delivery"),
      recipientName: z.string().trim().min(1).max(120),
      phone: z.string().trim().min(5).max(30),
      address: z.string().trim().min(10).max(500),
    }),
    z.object({
      mode: z.literal("pickup"),
      location: z.string().trim().min(1).max(160),
    }),
  ]),
  patientEmail: z.string().email().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const Route = createFileRoute("/api/stripe/create-medication-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = medicationCheckoutSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return json({ error: "Invalid medication checkout request", details: parsed.error.flatten() }, 400);
        }

        const secretKey = getStripeSecretKey();
        if (!secretKey) return errorJson("Payments are not configured yet. Add a Stripe secret key to enable checkout.", 503);

        try {
          const data = parsed.data;
          const catalogById = new Map<string, (typeof medicationCatalog)[number]>(
            medicationCatalog.map((medication) => [medication.id as string, medication]),
          );
          const items = data.cartItems.map((cartItem) => {
            const medication = catalogById.get(cartItem.id);
            if (!medication) throw new Error(`Medication ${cartItem.id} is unavailable`);
            if (cartItem.quantity > medication.stock) throw new Error(`${medication.name} does not have enough stock`);
            return { ...medication, quantity: cartItem.quantity };
          });
          const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const insuranceCoverageAmount = Math.min(subtotal, Math.max(0, data.insuranceCoverageAmount));
          const patientMedicationBalance = subtotal - insuranceCoverageAmount;
          const deliveryFee = data.fulfillmentDetails.mode === "delivery" ? 99 : 0;
          const total = patientMedicationBalance + deliveryFee;

          const MINIMUM_ORDER_PHP = 50;
          if (total < MINIMUM_ORDER_PHP) {
            return errorJson(`Minimum order amount is ₱${MINIMUM_ORDER_PHP.toFixed(2)}. Your total is ₱${total.toFixed(2)}.`, 400);
          }

          const orderId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          const session = await createCheckoutSession(secretKey, {
            mode: "payment",
            line_items: [
              ...(patientMedicationBalance > 0
                ? [{
                    price_data: {
                      currency: "php",
                      product_data: { name: "Pharmacy balance after estimated insurance" },
                      unit_amount: Math.round(patientMedicationBalance * 100),
                    },
                    quantity: 1,
                  }]
                : []),
              ...(deliveryFee > 0
                ? [{
                    price_data: {
                      currency: "php",
                      product_data: { name: "Pharmacy delivery fee" },
                      unit_amount: deliveryFee * 100,
                    },
                    quantity: 1,
                  }]
                : []),
            ],
            customer_email: data.patientEmail,
            client_reference_id: orderId,
            metadata: {
              orderType: "pharmacy",
              medicationOrderId: orderId,
              fulfillmentMode: data.fulfillmentDetails.mode,
              subtotal: subtotal.toFixed(2),
              insuranceCoverageAmount: insuranceCoverageAmount.toFixed(2),
              patientMedicationBalance: patientMedicationBalance.toFixed(2),
              deliveryFee: deliveryFee.toFixed(2),
              total: total.toFixed(2),
            },
            success_url: data.successUrl,
            cancel_url: data.cancelUrl,
          });

          if (!session.url) {
            return errorJson("Stripe did not return a checkout URL", 502);
          }

          return json({ checkoutUrl: session.url, sessionId: session.id, orderId, total });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to create medication checkout session";
          return errorJson(message, 400);
        }
      },
    },
  },
});
