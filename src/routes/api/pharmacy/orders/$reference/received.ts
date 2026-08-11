import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyOrders, sugbodocPharmacyPayments } from "@/db/schema";
import { errorJson, json } from "@/lib/api/http.server";
import { getUserFromRequest } from "@/lib/api/sugbodoc-auth.server";
import { updateEncounterOrder, type PharmacyOrderRow } from "@/lib/api/pharmacy.server";

export const Route = createFileRoute("/api/pharmacy/orders/$reference/received")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return errorJson("Not signed in.", 401);

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

        if (current.status === "Received" || current.received_at) {
          return errorJson("This pharmacy order has already been marked as received.", 409);
        }
        if (!["Delivered", "Ready for Pickup"].includes(current.status)) {
          return errorJson("Receipt can only be confirmed after delivery or when the order is ready for pickup.", 409);
        }

        const receivedAt = new Date();
        const updatedOrder = { ...(current.data ?? {}), status: "Received", receivedAt: receivedAt.toISOString() };

        const changed = await db
          .update(sugbodocPharmacyOrders)
          .set({ status: "Received", receivedAt, data: updatedOrder, updatedAt: receivedAt })
          .where(and(eq(sugbodocPharmacyOrders.reference, params.reference), eq(sugbodocPharmacyOrders.status, current.status)))
          .returning();

        if (!changed || !changed.length) {
          return errorJson("This pharmacy order has already been marked as received.", 409);
        }

        await db
          .update(sugbodocPharmacyPayments)
          .set({ fulfillmentStatus: "Received", updatedAt: receivedAt })
          .where(eq(sugbodocPharmacyPayments.orderReference, current.reference));

        await updateEncounterOrder({ ...updatedOrder, reference: current.reference, encounterId: current.encounter_id });

        return json({ order: { ...updatedOrder, reference: current.reference, status: "Received", receivedAt: receivedAt.toISOString() } });
      },
    },
  },
});
