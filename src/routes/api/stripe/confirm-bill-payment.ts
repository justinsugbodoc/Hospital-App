import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocClinicalRecords } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest } from "@/lib/api/sugbodoc-auth.server";
import { paymentReference } from "@/lib/api/pharmacy.server";
import { getStripeSecretKey, retrieveCheckoutSession } from "@/lib/api/stripe.server";

const confirmPaymentSchema = z.object({
  sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/),
});

async function getPatientBillRecords(patientId: string) {
  const records = await db
    .select()
    .from(sugbodocClinicalRecords)
    .where(and(eq(sugbodocClinicalRecords.patientId, patientId), eq(sugbodocClinicalRecords.recordType, "bills")));
  return records;
}

export const Route = createFileRoute("/api/stripe/confirm-bill-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        const parsed = confirmPaymentSchema.safeParse(await readJson(request));
        if (!parsed.success) return errorJson("A valid Stripe checkout session is required.", 400);

        const secretKey = getStripeSecretKey();
        if (!secretKey) return errorJson("Payments are not configured yet. Add a Stripe secret key to enable checkout.", 503);

        try {
          const session = await retrieveCheckoutSession(secretKey, parsed.data.sessionId);
          if (session.payment_status !== "paid") {
            return errorJson("Payment has not been confirmed by Stripe.", 400);
          }
          if (session.metadata?.patientId && session.metadata.patientId !== user.id) {
            return errorJson("This payment session does not belong to the signed-in patient.", 403);
          }

          const metadataIds = (session.metadata?.billIds as string | undefined)?.split(",").filter(Boolean) ?? [];
          const requestedIds = metadataIds.length
            ? metadataIds
            : [session.metadata?.billId ?? session.client_reference_id ?? ""].filter(Boolean);
          const records = await getPatientBillRecords(user.id);
          const selected = records.filter((record) => requestedIds.includes(String((record.data as any).id)));
          if (!selected.length) {
            const alreadyPaid = records
              .filter((record) => requestedIds.includes(String((record.data as any).id)) && (record.data as any).status === "Paid")
              .map((record) => record.data as Record<string, any>);
            if (alreadyPaid.length) {
              return json({
                bills: alreadyPaid,
                payments: [],
                receiptId: paymentReference(parsed.data.sessionId),
                status: "Paid",
              });
            }
            return errorJson("The paid bills could not be found for this patient.", 404);
          }

          const receipt = paymentReference(parsed.data.sessionId);
          const paidAt = new Date().toISOString();
          const paidBills: Record<string, any>[] = [];
          const payments: Record<string, any>[] = [];

          for (const record of selected) {
            const bill = record.data as Record<string, any>;
            const paidBill = { ...bill, status: "Paid", receiptId: receipt, paidAt };
            await db
              .update(sugbodocClinicalRecords)
              .set({ data: paidBill, updatedAt: new Date() })
              .where(eq(sugbodocClinicalRecords.id, record.id));

            const payment = {
              id: `${String(bill.id)}_payment`,
              billId: bill.id,
              encounterId: record.encounterId,
              amount: selected.length === 1 ? (session.amount_total ?? Math.round(Number(bill.amount ?? 0) * 100)) / 100 : Number(bill.amount ?? 0),
              status: "Paid",
              reference: receipt,
              date: paidAt.slice(0, 10),
              description: bill.description ?? "SugboDoc bill payment",
              stripeSessionId: parsed.data.sessionId,
            };

            const paymentRecordId = `cr_${record.encounterId}_payments_${String(bill.id)}_payment`.replace(/[^a-zA-Z0-9_-]/g, "_");

            await db
              .insert(sugbodocClinicalRecords)
              .values({
                id: paymentRecordId,
                patientId: user.id,
                encounterId: record.encounterId,
                recordType: "payments",
                data: payment,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: sugbodocClinicalRecords.id,
                set: {
                  data: payment,
                  updatedAt: new Date(),
                },
              });

            const billingRows = await db
              .select()
              .from(sugbodocClinicalRecords)
              .where(
                and(
                  eq(sugbodocClinicalRecords.patientId, user.id),
                  eq(sugbodocClinicalRecords.encounterId, record.encounterId),
                  eq(sugbodocClinicalRecords.recordType, "billing")
                )
              );

            const billingRow = billingRows[0];
            const billingData = (billingRow?.data ?? {}) as Record<string, any>;
            const existingPayments = Array.isArray(billingData.payments) ? billingData.payments : [];
            const nextBilling = {
              ...billingData,
              relatedBillIds: Array.from(new Set([...(billingData.relatedBillIds ?? []), bill.id])),
              payments: [...existingPayments.filter((item: any) => item.id !== payment.id), payment],
            };

            if (billingRow) {
              await db
                .update(sugbodocClinicalRecords)
                .set({ data: nextBilling, updatedAt: new Date() })
                .where(eq(sugbodocClinicalRecords.id, billingRow.id));
            } else {
              const billingRecordId = `cr_${record.encounterId}_billing`.replace(/[^a-zA-Z0-9_-]/g, "_");
              await db
                .insert(sugbodocClinicalRecords)
                .values({
                  id: billingRecordId,
                  patientId: user.id,
                  encounterId: record.encounterId,
                  recordType: "billing",
                  data: nextBilling,
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: sugbodocClinicalRecords.id,
                  set: {
                    data: nextBilling,
                    updatedAt: new Date(),
                  },
                });
            }
            paidBills.push(paidBill);
            payments.push(payment);
          }

          return json({ bills: paidBills, payments, receiptId: receipt, status: "Paid" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to confirm bill payment";
          return errorJson(message, 502);
        }
      },
    },
  },
});
