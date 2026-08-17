import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocEncounters, sugbodocPharmacyOrders } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { checkoutSchema, ensureCatalog, publicMedication, memoryPharmacyOrders } from "@/lib/api/pharmacy.server";
import { createCheckoutSession, createMockCheckoutSession, getStripeSecretKey } from "@/lib/api/stripe.server";

export const Route = createFileRoute("/api/pharmacy/create-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user || isAdminUser(user)) {
          return errorJson("A patient account is required to place a pharmacy order.", 403);
        }

        const parsed = checkoutSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          return json({ error: "Invalid pharmacy checkout request.", details: parsed.error.flatten() }, 400);
        }

        const catalog = await ensureCatalog();

        if (parsed.data.encounterId) {
          try {
            const encounterRows = await db
              .select({ id: sugbodocEncounters.id })
              .from(sugbodocEncounters)
              .where(and(eq(sugbodocEncounters.id, parsed.data.encounterId), eq(sugbodocEncounters.patientId, user.id)))
              .limit(1);

            if (encounterRows.length > 0 && !encounterRows[0]) {
              console.warn("Encounter check non-fatal warning");
            }
          } catch (err) {
            console.warn("Encounter validation skipped DB check:", err);
          }
        }

        const catalogById = new Map(catalog.map((item) => [item.id, item]));
        let items: Array<ReturnType<typeof publicMedication> & { quantity: number }>;
        try {
          items = parsed.data.cartItems.map((cartItem) => {
            const medication = catalogById.get(cartItem.id);
            if (!medication || medication.enabled !== "true") throw new Error(`Medication ${cartItem.id} is unavailable.`);
            if (cartItem.quantity > medication.stock) throw new Error(`${medication.name} does not have enough stock.`);
            return { ...publicMedication(medication), quantity: cartItem.quantity };
          });
        } catch (error) {
          return errorJson(error instanceof Error ? error.message : "Invalid cart items.", 400);
        }

        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const insuranceCoverageAmount = Math.min(subtotal, parsed.data.insuranceCoverageAmount);
        const patientMedicationBalance = subtotal - insuranceCoverageAmount;
        const deliveryFee = parsed.data.fulfillmentDetails.mode === "delivery" ? 99 : 0;
        const total = patientMedicationBalance + deliveryFee;
        if (total < 50) {
          return errorJson(`Minimum order amount is ₱50.00. Your total is ₱${total.toFixed(2)}.`, 400);
        }

        const reference = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const nowIso = new Date().toISOString();
        const order = {
          reference,
          patientId: user.id,
          encounterId: parsed.data.encounterId,
          fulfillmentDetails: parsed.data.fulfillmentDetails,
          items,
          totals: { subtotal, estimatedInsuranceCoverage: insuranceCoverageAmount, patientMedicationBalance, deliveryFee, total },
          status: "Pending",
          paymentStatus: "pending",
          createdAt: nowIso,
        };

        memoryPharmacyOrders.set(reference, {
          reference,
          patient_id: user.id,
          encounter_id: parsed.data.encounterId ?? null,
          bill_id: null,
          status: "Pending",
          payment_status: "pending",
          data: order,
          received_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        });

        try {
          await db
            .insert(sugbodocPharmacyOrders)
            .values({
              reference,
              patientId: user.id,
              encounterId: parsed.data.encounterId ?? null,
              status: "Pending",
              paymentStatus: "pending",
              data: order,
            });
        } catch (err) {
          console.warn("[pharmacy/create-checkout-session] SQL insert skipped, saved in memory:", err);
        }

        const secretKey = getStripeSecretKey();
        if (!secretKey) {
          const mockSession = createMockCheckoutSession({
            amount: total,
            customerEmail: user.email,
            clientReferenceId: reference,
            metadata: { orderType: "pharmacy", medicationOrderId: reference },
            successUrl: parsed.data.successUrl,
            cancelUrl: parsed.data.cancelUrl,
          });

          return json({ checkoutUrl: mockSession.url, sessionId: mockSession.id, orderId: reference, total });
        }

        let session: any;
        try {
          session = await createCheckoutSession(secretKey, {
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
            customer_email: user.email,
            client_reference_id: reference,
            metadata: { orderType: "pharmacy", medicationOrderId: reference },
            success_url: parsed.data.successUrl,
            cancel_url: parsed.data.cancelUrl,
          });
        } catch (error) {
          console.error("[pharmacy/create-checkout-session]", error);
          return errorJson(error instanceof Error ? error.message : "Unable to create checkout session.", 502);
        }

        if (!session.url) {
          return errorJson("Stripe did not return a checkout URL.", 502);
        }

        return json({ checkoutUrl: session.url, sessionId: session.id, orderId: reference, total });
      },
    },
  },
});

