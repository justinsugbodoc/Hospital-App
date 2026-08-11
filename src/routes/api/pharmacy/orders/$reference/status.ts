import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocPharmacyOrders, sugbodocPharmacyPayments } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser } from "@/lib/api/sugbodoc-auth.server";
import { statusSchema, updateEncounterOrder, type PharmacyOrderRow } from "@/lib/api/pharmacy.server";

export const Route = createFileRoute("/api/pharmacy/orders/$reference/status")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!isAdminUser(user)) {
          return errorJson("Authorized pharmacy staff are required to update order status.", 403);
        }

        const body = await readJson<{ status?: unknown }>(request);
        const parsed = statusSchema.safeParse(body.status);
        if (!parsed.success) {
          return errorJson("Invalid pharmacy order status.", 400);
        }

        const currentRows = await db
          .select()
          .from(sugbodocPharmacyOrders)
          .where(eq(sugbodocPharmacyOrders.reference, params.reference))
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

        if (parsed.data === "Received") {
          return errorJson("Patients must confirm receipt from the Patient portal after delivery or pickup readiness.", 400);
        }

        const updatedOrder = { ...(current.data ?? {}), status: parsed.data, updatedAt: new Date().toISOString() };

        await db
          .update(sugbodocPharmacyOrders)
          .set({ status: parsed.data, data: updatedOrder, updatedAt: new Date() })
          .where(eq(sugbodocPharmacyOrders.reference, params.reference));

        await updateEncounterOrder({ ...updatedOrder, reference: current.reference, encounterId: current.encounter_id });

        await db
          .update(sugbodocPharmacyPayments)
          .set({ fulfillmentStatus: parsed.data, updatedAt: new Date() })
          .where(eq(sugbodocPharmacyPayments.orderReference, current.reference));

        return json({ order: { ...updatedOrder, reference: current.reference, status: parsed.data, receivedAt: current.received_at } });
      },
    },
  },
});
