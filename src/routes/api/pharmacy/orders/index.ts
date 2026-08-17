import { createFileRoute } from "@tanstack/react-router";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyOrders, sugbodocUsers, sugbodocPharmacyPayments, sugbodocPharmacyBills } from "@/db/schema";
import { errorJson, json } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { ensureFinancialRecordsForPaidOrders, ensureOrdersFromClinicalRecords, memoryPharmacyOrders } from "@/lib/api/pharmacy.server";

export const Route = createFileRoute("/api/pharmacy/orders/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getUserFromRequest(request);
          if (!user) return errorJson("Not signed in.", 401);

          try {
            await ensureOrdersFromClinicalRecords();
            await ensureFinancialRecordsForPaidOrders();
          } catch (err) {
            console.warn("[/api/pharmacy/orders] Sync helper non-fatal warning:", err);
          }

          let ordersData: any[] = [];
          let usersData: any[] = [];
          let paymentRows: any[] = [];
          let billRows: any[] = [];

          try {
            ordersData = isAdminUser(user)
              ? await db.select().from(sugbodocPharmacyOrders)
              : await db.select().from(sugbodocPharmacyOrders).where(eq(sugbodocPharmacyOrders.patientId, user.id));

            const patientIds = Array.from(new Set(ordersData.map((order) => order.patientId)));
            usersData = patientIds.length > 0
              ? await db.select({ id: sugbodocUsers.id, name: sugbodocUsers.name }).from(sugbodocUsers).where(inArray(sugbodocUsers.id, patientIds))
              : [];

            paymentRows = await db.select().from(sugbodocPharmacyPayments);
            billRows = await db.select().from(sugbodocPharmacyBills);
          } catch (err) {
            console.warn("[/api/pharmacy/orders] SQL query failed, falling back to in-memory orders:", err);
          }

          if (ordersData.length === 0) {
            const memOrders = Array.from(memoryPharmacyOrders.values()).filter((o) =>
              isAdminUser(user) ? true : o.patient_id === user.id
            );
            ordersData = memOrders.map((o) => ({
              reference: o.reference,
              patientId: o.patient_id,
              encounterId: o.encounter_id,
              billId: o.bill_id,
              status: o.status,
              paymentStatus: o.payment_status,
              data: o.data,
              receivedAt: o.received_at ? new Date(o.received_at) : null,
              createdAt: new Date(o.created_at),
              updatedAt: new Date(o.updated_at),
            }));
          }

          const userNameById = new Map(usersData.map((u) => [u.id, u.name]));

          return json({
            orders: ordersData.map((order) => {
              const payment = paymentRows.find((item) => item.orderReference === order.reference);
              const bill = billRows.find((item) => item.orderReference === order.reference);
              const data = (order.data ?? {}) as any;
              return {
                ...data,
                reference: order.reference,
                patientId: order.patientId,
                patientName: userNameById.get(order.patientId) ?? data.patientName,
                encounterId: order.encounterId,
                billId: order.billId ?? bill?.id ?? data.billId,
                status: order.status,
                paymentStatus: order.paymentStatus,
                receivedAt: order.receivedAt ? (typeof order.receivedAt === "string" ? order.receivedAt : order.receivedAt.toISOString()) : data.receivedAt,
                createdAt: typeof order.createdAt === "string" ? order.createdAt : order.createdAt.toISOString(),
                updatedAt: typeof order.updatedAt === "string" ? order.updatedAt : order.updatedAt.toISOString(),
                billReference: bill?.id,
                billStatus: bill?.status,
                paymentAmount: payment ? Number(payment.amount) : undefined,
                paymentDate: payment?.paymentDate ? payment.paymentDate.toISOString() : undefined,
                paymentReference: payment?.reference,
                stripeSessionId: payment?.stripeSessionId,
                fulfillmentStatus: payment?.fulfillmentStatus ?? order.status,
              };
            }),
          });
        } catch (error) {
          console.error("[/api/pharmacy/orders] Fatal GET error:", error);
          return json({ orders: [] });
        }
      },
    },
  },
});
