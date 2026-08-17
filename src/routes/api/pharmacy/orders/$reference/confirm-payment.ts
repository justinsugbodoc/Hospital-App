import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyOrders, sugbodocPharmacyMedications, sugbodocPharmacyPayments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest } from "@/lib/api/sugbodoc-auth.server";
import {
  ensurePharmacyFinancialRecords,
  paymentReference,
  updateEncounterOrder,
  memoryPharmacyOrders,
  memoryPharmacyMedications,
  type PharmacyOrderRow,
} from "@/lib/api/pharmacy.server";
import { getStripeSecretKey, retrieveCheckoutSessionOrMock } from "@/lib/api/stripe.server";

const sessionIdSchema = z.string().regex(/^cs_[A-Za-z0-9_]+$/);

export const Route = createFileRoute("/api/pharmacy/orders/$reference/confirm-payment")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const body = await readJson<{ sessionId?: string }>(request);
        const sessionId = sessionIdSchema.safeParse(body?.sessionId);
        if (!sessionId.success) {
          return errorJson("A valid Stripe checkout session is required.", 400);
        }

        const secretKey = getStripeSecretKey();

        let session: any;
        try {
          session = await retrieveCheckoutSessionOrMock(secretKey, sessionId.data);
        } catch (error) {
          console.error("[pharmacy/orders/$reference/confirm-payment]", error);
          return errorJson(error instanceof Error ? error.message : "Unable to retrieve checkout session.", 502);
        }

        if (session.payment_status !== "paid" || (session.metadata?.medicationOrderId && session.metadata?.medicationOrderId !== params.reference)) {
          return errorJson("Payment has not been confirmed for this pharmacy order.", 400);
        }

        let row: PharmacyOrderRow | null = null;
        try {
          const currentRows = await db
            .select()
            .from(sugbodocPharmacyOrders)
            .where(and(eq(sugbodocPharmacyOrders.reference, params.reference), eq(sugbodocPharmacyOrders.patientId, user.id)))
            .limit(1);
          const r = currentRows[0];
          if (r) {
            row = {
              reference: r.reference,
              patient_id: r.patientId,
              encounter_id: r.encounterId,
              bill_id: r.billId,
              status: r.status,
              payment_status: r.paymentStatus,
              data: r.data as Record<string, any>,
              received_at: r.receivedAt ? r.receivedAt.toISOString() : null,
              created_at: r.createdAt.toISOString(),
              updated_at: r.updatedAt.toISOString(),
            };
          }
        } catch (err) {
          console.warn("[pharmacy/orders/confirm-payment] SQL select fallback to memory:", err);
        }

        if (!row) {
          row = memoryPharmacyOrders.get(params.reference) ?? null;
        }

        if (!row) {
          // Generate fallback order row
          const nowIso = new Date().toISOString();
          row = {
            reference: params.reference,
            patient_id: user.id,
            encounter_id: null,
            bill_id: null,
            status: "Processing",
            payment_status: "paid",
            data: {
              reference: params.reference,
              patientId: user.id,
              status: "Processing",
              paymentStatus: "paid",
              items: [],
              totals: { total: (session.amount_total ?? 0) / 100 },
            },
            received_at: null,
            created_at: nowIso,
            updated_at: nowIso,
          };
          memoryPharmacyOrders.set(params.reference, row);
        }

        const current = row;

        if (current.payment_status !== "paid") {
          const orderData = (current.data ?? {}) as any;
          const items = Array.isArray(orderData.items) ? orderData.items : [];
          for (const item of items) {
            const quantity = Number(item.quantity);
            if (Number.isInteger(quantity) && quantity > 0) {
              const memMed = memoryPharmacyMedications.get(String(item.id));
              if (memMed) {
                memMed.stock = Math.max(0, memMed.stock - quantity);
                memMed.enabled = memMed.stock > 0 ? "true" : "false";
              }
              try {
                const medRows = await db
                  .select({ id: sugbodocPharmacyMedications.id, stock: sugbodocPharmacyMedications.stock })
                  .from(sugbodocPharmacyMedications)
                  .where(eq(sugbodocPharmacyMedications.id, String(item.id)))
                  .limit(1);

                const medRow = medRows[0];
                if (medRow) {
                  await db
                    .update(sugbodocPharmacyMedications)
                    .set({ stock: Math.max(0, medRow.stock - quantity) })
                    .where(eq(sugbodocPharmacyMedications.id, String(item.id)));
                }
              } catch (err) {
                console.warn("[confirm-payment] stock update SQL fallback:", err);
              }
            }
          }

          const paidAt = new Date();
          await ensurePharmacyFinancialRecords(current, {
            amount: (session.amount_total ?? 0) / 100,
            paidAt,
            stripeSessionId: session.id,
            reference: paymentReference(session.id),
          });

          const updatedData = {
            ...orderData,
            status: current.status === "Pending" ? "Processing" : current.status,
            paymentStatus: "paid",
            paidAmount: (session.amount_total ?? 0) / 100,
            paymentSessionId: session.id,
            paymentReference: paymentReference(session.id),
            paymentDate: paidAt.toISOString(),
          };

          current.status = updatedData.status;
          current.payment_status = "paid";
          current.data = updatedData;
          current.updated_at = paidAt.toISOString();
          memoryPharmacyOrders.set(current.reference, current);

          try {
            await db
              .update(sugbodocPharmacyOrders)
              .set({
                status: updatedData.status,
                paymentStatus: "paid",
                data: updatedData,
                updatedAt: paidAt,
              })
              .where(eq(sugbodocPharmacyOrders.reference, current.reference));
          } catch (err) {
            console.warn("[confirm-payment] SQL order update skipped:", err);
          }
        } else if (!current.bill_id) {
          const data = (current.data ?? {}) as any;
          await ensurePharmacyFinancialRecords(current, {
            amount: Number(data.paidAmount ?? data.totals?.total ?? 0),
            paidAt: new Date(data.paymentDate ?? current.updated_at),
            stripeSessionId: String(data.paymentSessionId ?? session.id),
            reference: String(data.paymentReference ?? paymentReference(session.id)),
          });
        }

        const orderData = (current.data ?? {}) as any;
        const updatedOrder = {
          ...orderData,
          reference: current.reference,
          patientId: current.patient_id,
          encounterId: current.encounter_id,
          status: current.status,
          paymentStatus: current.payment_status,
        };

        try {
          await db
            .update(sugbodocPharmacyPayments)
            .set({ fulfillmentStatus: current.status, updatedAt: new Date() })
            .where(eq(sugbodocPharmacyPayments.orderReference, current.reference));
        } catch (err) {
          console.warn("[confirm-payment] payments update SQL fallback:", err);
        }

        try {
          await updateEncounterOrder(updatedOrder);
        } catch (err) {
          console.warn("[confirm-payment] encounter update fallback:", err);
        }

        return json({ order: updatedOrder });
      },
    },
  },
});

