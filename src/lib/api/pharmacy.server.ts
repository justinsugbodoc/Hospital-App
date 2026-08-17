import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  sugbodocPharmacyMedications,
  sugbodocPharmacyBills,
  sugbodocPharmacyPayments,
  sugbodocPharmacyOrders,
  sugbodocClinicalRecords,
} from "@/db/schema";

export const medicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  description: z.string().max(500).default(""),
  genericName: z.string().max(200).default(""),
  dosage: z.string().max(100).default(""),
  dosageForm: z.string().max(100).default(""),
  form: z.string().max(100).default(""),
  category: z.string().max(100).default(""),
  price: z.number().finite().nonnegative(),
  stock: z.number().int().nonnegative(),
  enabled: z.boolean().default(true),
  partnerLocations: z.array(z.string().max(160)).default([]),
});

export const statuses = ["Pending", "Processing", "Ready for Pickup", "Out for Delivery", "Delivered", "Received", "Cancelled"] as const;
export const statusSchema = z.enum(statuses);

export const checkoutSchema = z.object({
  cartItems: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().positive().max(100) })).min(1).max(50),
  encounterId: z.string().min(1).optional(),
  insuranceCoverageAmount: z.number().finite().min(0).default(0),
  fulfillmentDetails: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("delivery"),
      recipientName: z.string().trim().min(1).max(120),
      phone: z.string().trim().min(5).max(30),
      address: z.string().trim().min(10).max(500),
    }),
    z.object({ mode: z.literal("pickup"), location: z.string().trim().min(1).max(160) }),
  ]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const defaultCatalog = [
  ["med-001", "Biogesic", "Paracetamol for pain and fever relief.", "Paracetamol", "500mg", "Tablet", "Pain Relief", 7.5, 150],
  ["med-002", "Neozep Forte", "Multi-symptom cold and flu relief.", "Phenylephrine HCl + Chlorphenamine Maleate + Paracetamol", "10mg/2mg/500mg", "Tablet", "Cold & Flu", 8.25, 200],
  ["med-003", "Alaxan FR", "Combination analgesic for muscle pain.", "Ibuprofen + Paracetamol", "200mg/325mg", "Capsule", "Pain Relief", 12, 85],
  ["med-004", "Solmux", "Mucolytic for productive cough.", "Carbocisteine", "500mg", "Capsule", "Cough", 15.5, 120],
  ["med-005", "Amoxil", "Prescription antibiotic.", "Amoxicillin", "500mg", "Capsule", "Antibiotics", 22, 40],
  ["med-006", "Diatabs", "Relief for occasional diarrhea.", "Loperamide", "2mg", "Capsule", "Digestion", 10, 0],
  ["med-007", "Kremil-S", "Antacid for heartburn and indigestion.", "Aluminum Hydroxide + Magnesium Hydroxide + Simeticone", "178mg/233mg/30mg", "Tablet", "Digestion", 11.5, 95],
  ["med-008", "Ascorbic Acid", "Vitamin C supplement.", "Vitamin C", "500mg", "Tablet", "Vitamins", 5, 500],
  ["med-009", "Losartan", "Maintenance medicine for blood pressure.", "Losartan Potassium", "50mg", "Tablet", "Heart Health", 18, 65],
  ["sup-001", "Disposable Syringes", "Sterile single-use syringes.", "Medical supply", "5mL", "Supply", "Syringes", 12, 240],
  ["sup-002", "Sterile Gauze Pads", "Soft sterile gauze pads.", "Medical supply", "4x4 in", "Supply", "Wound Care", 35, 90],
  ["sup-003", "Nitrile Examination Gloves", "Powder-free disposable gloves.", "Medical supply", "Medium, 100 pcs", "Box", "Protective Equipment", 320, 45],
  ["sup-004", "Surgical Face Masks", "Disposable 3-ply masks.", "Medical supply", "50 pcs", "Box", "Protective Equipment", 180, 75],
  ["sup-005", "70% Isopropyl Alcohol", "Antiseptic alcohol.", "Medical supply", "500mL", "Bottle", "First Aid", 95, 65],
  ["sup-006", "Adhesive Bandages", "Flexible adhesive strips.", "Medical supply", "25 pcs", "Box", "Wound Care", 85, 110],
] as const;

export const medicationCatalog = defaultCatalog.map(([id, name, , , dosage, form, , price, stock]) => ({
  id,
  name,
  dosage,
  form,
  price,
  stock,
}));

export type PharmacyMedicationRow = {
  id: string;
  name: string;
  description: string;
  generic_name: string;
  dosage: string;
  dosage_form: string;
  form: string;
  category: string;
  price: string;
  stock: number;
  enabled: string;
  partner_locations: string[];
  updated_at?: string;
};

declare global {
  var _memoryPharmacyMedications: Map<string, PharmacyMedicationRow> | undefined;
  var _memoryPharmacyOrders: Map<string, PharmacyOrderRow> | undefined;
}

export const memoryPharmacyMedications = (globalThis._memoryPharmacyMedications =
  globalThis._memoryPharmacyMedications || new Map<string, PharmacyMedicationRow>());
export const memoryPharmacyOrders = (globalThis._memoryPharmacyOrders =
  globalThis._memoryPharmacyOrders || new Map<string, PharmacyOrderRow>());

function initMemoryMedications() {
  if (memoryPharmacyMedications.size > 0) return;
  for (const [id, name, description, genericName, dosage, form, category, price, stock] of defaultCatalog) {
    memoryPharmacyMedications.set(id, {
      id,
      name,
      description,
      generic_name: genericName,
      dosage,
      dosage_form: form,
      form,
      category,
      price: String(price),
      stock,
      enabled: stock > 0 ? "true" : "false",
      partner_locations: ["Sugbo Pharmacy Escario", "Chong Hua Hospital Pharmacy"],
      updated_at: new Date().toISOString(),
    });
  }
}
initMemoryMedications();

export function publicMedication(row: PharmacyMedicationRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    genericName: row.generic_name,
    dosage: row.dosage,
    dosageForm: row.dosage_form,
    form: row.form,
    category: row.category,
    price: Number(row.price),
    stock: row.stock,
    enabled: row.enabled === "true",
    partnerLocations: row.partner_locations ?? [],
    updatedAt: row.updated_at,
  };
}

export function pharmacyBillId(reference: string) {
  return `pharmacy_bill_${reference}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function pharmacyPaymentId(reference: string) {
  return `pharmacy_payment_${reference}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function paymentReference(sessionId: string) {
  return `STRIPE-${sessionId.slice(-8).toUpperCase()}`;
}

export type PharmacyOrderRow = {
  reference: string;
  patient_id: string;
  encounter_id: string | null;
  bill_id: string | null;
  status: string;
  payment_status: string;
  data: Record<string, any>;
  received_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensurePharmacyFinancialRecords(
  order: PharmacyOrderRow,
  payment: { amount: number; paidAt: Date; stripeSessionId: string | null; reference: string },
) {
  const orderData = (order.data ?? {}) as Record<string, any>;
  const billId = order.bill_id ?? pharmacyBillId(order.reference);
  const amount = Number(payment.amount.toFixed(2));

  // Update in memory
  const mem = memoryPharmacyOrders.get(order.reference);
  if (mem) {
    mem.bill_id = billId;
    mem.data = { ...mem.data, billId, paymentReference: payment.reference, paymentDate: payment.paidAt.toISOString() };
    mem.updated_at = new Date().toISOString();
  }

  try {
    await db
      .insert(sugbodocPharmacyBills)
      .values({
        id: billId,
        patientId: order.patient_id,
        orderReference: order.reference,
        description: `Pharmacy order ${order.reference}`,
        amount: amount.toFixed(2),
        status: "Paid",
        billDate: new Date(order.created_at),
        paidAt: payment.paidAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sugbodocPharmacyBills.id,
        set: {
          patientId: order.patient_id,
          orderReference: order.reference,
          description: `Pharmacy order ${order.reference}`,
          amount: amount.toFixed(2),
          status: "Paid",
          paidAt: payment.paidAt,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(sugbodocPharmacyPayments)
      .values({
        id: pharmacyPaymentId(order.reference),
        patientId: order.patient_id,
        orderReference: order.reference,
        billId: billId,
        amount: amount.toFixed(2),
        status: "Paid",
        paymentDate: payment.paidAt,
        reference: payment.reference,
        stripeSessionId: payment.stripeSessionId,
        fulfillmentStatus: order.status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sugbodocPharmacyPayments.id,
        set: {
          patientId: order.patient_id,
          orderReference: order.reference,
          billId: billId,
          amount: amount.toFixed(2),
          status: "Paid",
          paymentDate: payment.paidAt,
          reference: payment.reference,
          stripeSessionId: payment.stripeSessionId,
          fulfillmentStatus: order.status,
          updatedAt: new Date(),
        },
      });

    await db
      .update(sugbodocPharmacyOrders)
      .set({
        billId: billId,
        data: { ...orderData, billId, paymentReference: payment.reference, paymentDate: payment.paidAt.toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(sugbodocPharmacyOrders.reference, order.reference));
  } catch (err) {
    console.warn("[ensurePharmacyFinancialRecords] SQL fallback to memory:", err);
  }

  return billId;
}

export async function ensureCatalog(): Promise<PharmacyMedicationRow[]> {
  initMemoryMedications();
  try {
    const existing = await db
      .select()
      .from(sugbodocPharmacyMedications)
      .orderBy(asc(sugbodocPharmacyMedications.name));

    if (existing.length > 0) {
      const rows = existing.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        generic_name: r.genericName,
        dosage: r.dosage,
        dosage_form: r.dosageForm,
        form: r.form,
        category: r.category,
        price: r.price,
        stock: r.stock,
        enabled: r.enabled,
        partner_locations: r.partnerLocations as string[],
        updated_at: r.updatedAt.toISOString(),
      }));
      for (const row of rows) {
        memoryPharmacyMedications.set(row.id, row);
      }
      return rows;
    }

    for (const [id, name, description, genericName, dosage, form, category, price, stock] of defaultCatalog) {
      await db
        .insert(sugbodocPharmacyMedications)
        .values({
          id,
          name,
          description,
          genericName: genericName,
          dosage,
          dosageForm: form,
          form,
          category,
          price: String(price),
          stock,
          enabled: stock > 0 ? "true" : "false",
          partnerLocations: ["Sugbo Pharmacy Escario", "Chong Hua Hospital Pharmacy"],
        });
    }

    const seeded = await db
      .select()
      .from(sugbodocPharmacyMedications)
      .orderBy(asc(sugbodocPharmacyMedications.name));

    const seededRows = seeded.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      generic_name: r.genericName,
      dosage: r.dosage,
      dosage_form: r.dosageForm,
      form: r.form,
      category: r.category,
      price: r.price,
      stock: r.stock,
      enabled: r.enabled,
      partner_locations: r.partnerLocations as string[],
      updated_at: r.updatedAt.toISOString(),
    }));
    for (const row of seededRows) {
      memoryPharmacyMedications.set(row.id, row);
    }
    return seededRows;
  } catch (err) {
    console.warn("[ensureCatalog] SQL fallback to memory:", err);
    return Array.from(memoryPharmacyMedications.values());
  }
}

export async function updateEncounterOrder(order: Record<string, any>) {
  if (!order.encounterId) return;
  const records = await db
    .select()
    .from(sugbodocClinicalRecords)
    .where(eq(sugbodocClinicalRecords.encounterId, order.encounterId));

  const record = records.find(
    (item) => item.recordType === "pharmacyOrders" && (item.data as any)?.reference === order.reference,
  );

  if (record) {
    await db
      .update(sugbodocClinicalRecords)
      .set({
        data: { ...(record.data as any), ...order },
        updatedAt: new Date(),
      })
      .where(eq(sugbodocClinicalRecords.id, record.id));
  } else {
    await db
      .insert(sugbodocClinicalRecords)
      .values({
        id: `cr_${order.encounterId}_pharmacyOrders_${order.reference}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        patientId: order.patientId,
        encounterId: order.encounterId,
        recordType: "pharmacyOrders",
        data: order,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sugbodocClinicalRecords.id,
        set: {
          patientId: order.patientId,
          encounterId: order.encounterId,
          recordType: "pharmacyOrders",
          data: order,
          updatedAt: new Date(),
        },
      });
  }
}

export async function ensureOrdersFromClinicalRecords() {
  const existing = await db.select({ reference: sugbodocPharmacyOrders.reference }).from(sugbodocPharmacyOrders);
  const existingReferences = new Set(existing.map((item) => item.reference));

  const records = await db
    .select({
      patientId: sugbodocClinicalRecords.patientId,
      encounterId: sugbodocClinicalRecords.encounterId,
      data: sugbodocClinicalRecords.data,
    })
    .from(sugbodocClinicalRecords)
    .where(eq(sugbodocClinicalRecords.recordType, "pharmacyOrders"));

  for (const record of records) {
    const order = (record.data ?? {}) as Record<string, any>;
    if (!order.reference || existingReferences.has(String(order.reference))) continue;
    try {
      await db
        .insert(sugbodocPharmacyOrders)
        .values({
          reference: String(order.reference),
          patientId: record.patientId,
          encounterId: record.encounterId,
          status: String(order.status ?? "Pending"),
          paymentStatus: String(order.paymentStatus ?? "pending"),
          billId: typeof order.billId === "string" ? order.billId : null,
          data: { ...order, patientId: record.patientId, encounterId: record.encounterId },
          receivedAt: typeof order.receivedAt === "string" ? new Date(order.receivedAt) : null,
        });
    } catch {
      // ignore duplicate/conflicting backfill rows
    }
  }
}

export async function ensureFinancialRecordsForPaidOrders() {
  const paidOrders = await db
    .select()
    .from(sugbodocPharmacyOrders)
    .where(eq(sugbodocPharmacyOrders.paymentStatus, "paid"));

  for (const order of paidOrders) {
    const orderRow: PharmacyOrderRow = {
      reference: order.reference,
      patient_id: order.patientId,
      encounter_id: order.encounterId,
      bill_id: order.billId,
      status: order.status,
      payment_status: order.paymentStatus,
      data: order.data as Record<string, any>,
      received_at: order.receivedAt ? order.receivedAt.toISOString() : null,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    };

    const existing = await db
      .select({ id: sugbodocPharmacyBills.id })
      .from(sugbodocPharmacyBills)
      .where(eq(sugbodocPharmacyBills.orderReference, order.reference))
      .limit(1);

    if (existing.length > 0) continue;

    const data = (order.data ?? {}) as any;
    await ensurePharmacyFinancialRecords(orderRow, {
      amount: Number(data.paidAmount ?? data.totals?.total ?? 0),
      paidAt: new Date(data.paymentDate ?? order.updatedAt),
      stripeSessionId: data.paymentSessionId ?? null,
      reference: data.paymentReference ?? `LEGACY-${order.reference}`,
    });
  }
}
