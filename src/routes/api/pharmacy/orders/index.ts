import { createFileRoute } from "@tanstack/react-router";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyOrders, sugbodocUsers, sugbodocPharmacyPayments, sugbodocPharmacyBills } from "@/db/schema";
import { errorJson, json } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { ensureFinancialRecordsForPaidOrders, ensureOrdersFromClinicalRecords } from "@/lib/api/pharmacy.server";

export const Route = createFileRoute("/api/pharmacy/orders/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

        await ensureOrdersFromClinicalRecords();
        await ensureFinancialRecordsForPaidOrders();

        const ordersData = isAdminUser(user)
          ? await db.select().from(sugbodocPharmacyOrders)
          : await db.select().from(sugbodocPharmacyOrders).where(eq(sugbodocPharmacyOrders.patientId, user.id));

        const patientIds = Array.from(new Set(ordersData.map((order) => order.patientId)));
        const usersData = patientIds.length > 0
          ? await db.select({ id: sugbodocUsers.id, name: sugbodocUsers.name }).from(sugbodocUsers).where(inArray(sugbodocUsers.id, patientIds))
          : [];

        const userNameById = new Map(usersData.map((u) => [u.id, u.name]));

        const paymentRows = await db.select().from(sugbodocPharmacyPayments);
        const billRows = await db.select().from(sugbodocPharmacyBills);

        return json({
          orders: ordersData.map((order) => {
            const payment = paymentRows.find((item) => item.orderReference === order.reference);
            const bill = billRows.find((item) => item.orderReference === order.reference);
            const data = (order.data ?? {}) as any;
            return {
              ...data,
              reference: order.reference,
              patientId: order.patientId,
              patientName: userNameById.get(order.patientId),
              encounterId: order.encounterId,
              billId: order.billId ?? bill?.id ?? data.billId,
              status: order.status,
              paymentStatus: order.paymentStatus,
              receivedAt: order.receivedAt ? order.receivedAt.toISOString() : data.receivedAt,
              createdAt: order.createdAt.toISOString(),
              updatedAt: order.updatedAt.toISOString(),
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
      },
    },
  },
});
