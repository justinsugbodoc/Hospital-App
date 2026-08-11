import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyOrders, sugbodocPharmacyMedications, sugbodocPharmacyPayments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest } from "@/lib/api/sugbodoc-auth.server";
import { ensurePharmacyFinancialRecords, paymentReference, updateEncounterOrder, type PharmacyOrderRow } from "@/lib/api/pharmacy.server";
import { getStripeSecretKey, retrieveCheckoutSession } from "@/lib/api/stripe.server";

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
        if (!secretKey) return errorJson("Payments are not configured yet. Add a Stripe secret key to enable checkout.", 503);

        let session: any;
        try {
          session = await retrieveCheckoutSession(secretKey, sessionId.data);
        } catch (error) {
          console.error("[pharmacy/orders/$reference/confirm-payment]", error);
          return errorJson(error instanceof Error ? error.message : "Unable to retrieve checkout session.", 502);
        }

        if (session.payment_status !== "paid" || session.metadata?.medicationOrderId !== params.reference) {
          return errorJson("Payment has not been confirmed for this pharmacy order.", 400);
        }

        const currentRows = await db
          .select()
          .from(sugbodocPharmacyOrders)
          .where(and(eq(sugbodocPharmacyOrders.reference, params.reference), eq(sugbodocPharmacyOrders.patientId, user.id)))
          .limit(1);

        const row = currentRows[0];
        if (!row) return errorJson("Pharmacy order not found.", 404);

        const current: PharmacyOrderRow = {
          reference: row.reference,
          patient_id: row.patientId,
          encounter_id: row.encounterId,
          bill_id: row.billId,
          status: row.status,
          payment_status: row.paymentStatus,
          data: row.data as Record<string, any>,
          received_at: row.receivedAt ? row.receivedAt.toISOString() : null,
          created_at: row.createdAt.toISOString(),
          updated_at: row.updatedAt.toISOString(),
        };

        if (current.payment_status !== "paid") {
          const orderData = (current.data ?? {}) as any;
          const items = Array.isArray(orderData.items) ? orderData.items : [];
          for (const item of items) {
            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) || quantity <= 0) {
              return errorJson(`Unable to reserve stock for ${String(item.name ?? item.id)}`, 400);
            }
            const medRows = await db
              .select({ id: sugbodocPharmacyMedications.id, stock: sugbodocPharmacyMedications.stock })
              .from(sugbodocPharmacyMedications)
              .where(eq(sugbodocPharmacyMedications.id, String(item.id)))
              .limit(1);

            const medRow = medRows[0];
            if (!medRow || medRow.stock < quantity) {
              return errorJson(`Unable to reserve stock for ${String(item.name ?? item.id)}`, 400);
            }
            await db
              .update(sugbodocPharmacyMedications)
              .set({ stock: medRow.stock - quantity })
              .where(eq(sugbodocPharmacyMedications.id, String(item.id)));
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
          await db
            .update(sugbodocPharmacyOrders)
            .set({
              status: updatedData.status,
              paymentStatus: "paid",
              data: updatedData,
              updatedAt: paidAt,
            })
            .where(eq(sugbodocPharmacyOrders.reference, current.reference));
        } else if (!current.bill_id) {
          const data = (current.data ?? {}) as any;
          await ensurePharmacyFinancialRecords(current, {
            amount: Number(data.paidAmount ?? data.totals?.total ?? 0),
            paidAt: new Date(data.paymentDate ?? current.updated_at),
            stripeSessionId: String(data.paymentSessionId ?? session.id),
            reference: String(data.paymentReference ?? paymentReference(session.id)),
          });
        }

        const latestRows = await db
          .select()
          .from(sugbodocPharmacyOrders)
          .where(and(eq(sugbodocPharmacyOrders.reference, current.reference), eq(sugbodocPharmacyOrders.patientId, user.id)))
          .limit(1);

        const latestRow = latestRows[0];
        const latest: PharmacyOrderRow = latestRow ? {
          reference: latestRow.reference,
          patient_id: latestRow.patientId,
          encounter_id: latestRow.encounterId,
          bill_id: latestRow.billId,
          status: latestRow.status,
          payment_status: latestRow.paymentStatus,
          data: latestRow.data as Record<string, any>,
          received_at: latestRow.receivedAt ? latestRow.receivedAt.toISOString() : null,
          created_at: latestRow.createdAt.toISOString(),
          updated_at: latestRow.updatedAt.toISOString(),
        } : current;

        const orderData = (latest.data ?? {}) as any;
        const updatedOrder = {
          ...orderData,
          reference: latest.reference,
          patientId: latest.patient_id,
          encounterId: latest.encounter_id,
          status: latest.status,
          paymentStatus: latest.payment_status,
        };

        await db
          .update(sugbodocPharmacyPayments)
          .set({ fulfillmentStatus: latest.status, updatedAt: new Date() })
          .where(eq(sugbodocPharmacyPayments.orderReference, latest.reference));

        await updateEncounterOrder(updatedOrder);

        return json({ order: updatedOrder });
      },
    },
  },
});
