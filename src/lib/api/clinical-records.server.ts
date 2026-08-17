import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocEncounters, sugbodocClinicalRecords, sugbodocAppointments } from "@/db/schema";

export const recordTypes = [
  "soapNotes",
  "diagnoses",
  "prescriptions",
  "medications",
  "vitals",
  "laboratoryResults",
  "imaging",
  "bills",
  "payments",
  "pharmacyOrders",
  "insurance",
  "claims",
  "billing",
] as const;
export type RecordType = (typeof recordTypes)[number];

export const encounterSchema = z.object({
  id: z.string().min(1),
  encounterReference: z.string().min(1),
  appointmentId: z.string().nullable().optional(),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  encounterDate: z.string().min(1),
  date: z.string().min(1),
  doctorId: z.string().optional(),
  doctor: z.string().min(1),
  specialty: z.string().default(""),
  clinic: z.string().default(""),
  chiefComplaint: z.string().default(""),
  appointmentDetails: z.record(z.string(), z.unknown()).default({}),
  clinicalSummary: z.string().default(""),
  billing: z.record(z.string(), z.unknown()).default({}),
  soapNotes: z.array(z.unknown()).default([]),
  diagnoses: z.array(z.unknown()).default([]),
  prescriptions: z.array(z.unknown()).default([]),
  medications: z.array(z.unknown()).default([]),
  pharmacyOrders: z.array(z.unknown()).default([]),
  vitals: z.array(z.unknown()).default([]),
  laboratoryResults: z.array(z.unknown()).default([]),
  imaging: z.array(z.unknown()).default([]),
  bills: z.array(z.unknown()).default([]),
  payments: z.array(z.unknown()).default([]),
  insurance: z.unknown().nullable().default(null),
  claims: z.array(z.unknown()).default([]),
});

function isRecordType(value: string): value is RecordType {
  return (recordTypes as readonly string[]).includes(value);
}

function recordId(encounterId: string, type: string, value: unknown, index: number) {
  const id = typeof value === "object" && value !== null && "id" in value
    ? String((value as { id?: unknown }).id ?? index)
    : index;
  return `cr_${encounterId}_${type}_${id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

type EncounterRow = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  reference: string;
  encounter_date: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ClinicalRecordRow = {
  id: string;
  patient_id: string;
  encounter_id: string;
  appointment_id: string | null;
  record_type: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

declare global {
  var _memoryEncounters: Map<string, EncounterRow> | undefined;
  var _memoryClinicalRecords: Map<string, ClinicalRecordRow> | undefined;
}

export const memoryEncounters = (globalThis._memoryEncounters = globalThis._memoryEncounters || new Map<string, EncounterRow>());
export const memoryClinicalRecords = (globalThis._memoryClinicalRecords = globalThis._memoryClinicalRecords || new Map<string, ClinicalRecordRow>());

function seedDefaultEncountersForPatient(patientId: string, patientName = "Juan dela Cruz") {
  const enc1Id = `enc_apt_10_${patientId}`;
  const enc2Id = `enc_apt_11_${patientId}`;

  const enc1: EncounterRow = {
    id: enc1Id,
    patient_id: patientId,
    appointment_id: "apt_10",
    reference: `ENC-APT10-${patientId.toUpperCase()}`,
    encounter_date: "2024-06-10T11:00:00.000Z",
    data: {
      patientName,
      date: "Jun 10, 2024",
      doctorId: "dr_1",
      doctor: "Dr. Maria Santos",
      specialty: "Internal Medicine",
      clinic: "Cebu Doctors' University Hospital",
      chiefComplaint: "Follow-up of hypertension and mild hyperlipidemia",
      appointmentDetails: { date: "Jun 10, 2024", time: "11:00 AM", status: "Completed", reference: "APT-10" },
      clinicalSummary: "Patient is compliant with medication. Blood pressure is well-controlled. Continue current regimen.",
    },
    created_at: "2024-06-10T11:00:00.000Z",
    updated_at: "2024-06-10T11:00:00.000Z",
  };

  const enc2: EncounterRow = {
    id: enc2Id,
    patient_id: patientId,
    appointment_id: "apt_11",
    reference: `ENC-APT11-${patientId.toUpperCase()}`,
    encounter_date: "2024-05-05T15:00:00.000Z",
    data: {
      patientName,
      date: "May 05, 2024",
      doctorId: "dr_2",
      doctor: "Dr. Jose Reyes",
      specialty: "Cardiology",
      clinic: "Chong Hua Hospital",
      chiefComplaint: "Cardiovascular evaluation and routine consultation",
      appointmentDetails: { date: "May 05, 2024", time: "3:00 PM", status: "Completed", reference: "APT-11" },
      clinicalSummary: "Normal cardiovascular status. Advised lifestyle modifications.",
    },
    created_at: "2024-05-05T15:00:00.000Z",
    updated_at: "2024-05-05T15:00:00.000Z",
  };

  memoryEncounters.set(enc1Id, enc1);
  memoryEncounters.set(enc2Id, enc2);

  // Seed clinical records for bills & payments
  const crBills = [
    {
      id: `cr_${enc1Id}_bills_bill_1`,
      patient_id: patientId,
      encounter_id: enc1Id,
      appointment_id: "apt_10",
      record_type: "bills",
      data: { id: "bill_1", description: "Consultation - Dr. Maria Santos", date: "Jul 30, 2024", amount: 800, status: "Pending" },
      created_at: "2024-06-10T11:00:00.000Z",
      updated_at: "2024-06-10T11:00:00.000Z",
    },
    {
      id: `cr_${enc1Id}_bills_bill_2`,
      patient_id: patientId,
      encounter_id: enc1Id,
      appointment_id: "apt_10",
      record_type: "bills",
      data: { id: "bill_2", description: "Comprehensive Lipid Panel", date: "Jun 05, 2024", amount: 3700, status: "Pending" },
      created_at: "2024-06-10T11:00:00.000Z",
      updated_at: "2024-06-10T11:00:00.000Z",
    },
    {
      id: `cr_${enc2Id}_bills_bill_3`,
      patient_id: patientId,
      encounter_id: enc2Id,
      appointment_id: "apt_11",
      record_type: "bills",
      data: { id: "bill_3", description: "Consultation - Dr. Jose Reyes", date: "Feb 15, 2024", amount: 1200, status: "Paid", receiptId: "RCP-8891" },
      created_at: "2024-05-05T15:00:00.000Z",
      updated_at: "2024-05-05T15:00:00.000Z",
    },
    {
      id: `cr_${enc2Id}_bills_bill_4`,
      patient_id: patientId,
      encounter_id: enc2Id,
      appointment_id: "apt_11",
      record_type: "bills",
      data: { id: "bill_4", description: "Annual Physical Exam Package", date: "Oct 05, 2023", amount: 4500, status: "Paid", receiptId: "RCP-7742" },
      created_at: "2024-05-05T15:00:00.000Z",
      updated_at: "2024-05-05T15:00:00.000Z",
    },
    {
      id: `cr_${enc2Id}_payments_bill_3_payment`,
      patient_id: patientId,
      encounter_id: enc2Id,
      appointment_id: "apt_11",
      record_type: "payments",
      data: { id: "bill_3_payment", billId: "bill_3", description: "Consultation - Dr. Jose Reyes", date: "Feb 15, 2024", amount: 1200, status: "Paid", reference: "RCP-8891" },
      created_at: "2024-05-05T15:00:00.000Z",
      updated_at: "2024-05-05T15:00:00.000Z",
    },
    {
      id: `cr_${enc2Id}_payments_bill_4_payment`,
      patient_id: patientId,
      encounter_id: enc2Id,
      appointment_id: "apt_11",
      record_type: "payments",
      data: { id: "bill_4_payment", billId: "bill_4", description: "Annual Physical Exam Package", date: "Oct 05, 2023", amount: 4500, status: "Paid", reference: "RCP-7742" },
      created_at: "2024-05-05T15:00:00.000Z",
      updated_at: "2024-05-05T15:00:00.000Z",
    },
    {
      id: `cr_${enc1Id}_prescriptions_rx_1`,
      patient_id: patientId,
      encounter_id: enc1Id,
      appointment_id: "apt_10",
      record_type: "prescriptions",
      data: { id: "rx_1", name: "Losartan", dosage: "50mg once daily", instructions: "Take in the morning with water", doctor: "Dr. Maria Santos", date: "Jun 10, 2024" },
      created_at: "2024-06-10T11:00:00.000Z",
      updated_at: "2024-06-10T11:00:00.000Z",
    },
    {
      id: `cr_${enc1Id}_prescriptions_rx_2`,
      patient_id: patientId,
      encounter_id: enc1Id,
      appointment_id: "apt_10",
      record_type: "prescriptions",
      data: { id: "rx_2", name: "Atorvastatin", dosage: "20mg once daily at bedtime", instructions: "Take after dinner", doctor: "Dr. Maria Santos", date: "Jun 10, 2024" },
      created_at: "2024-06-10T11:00:00.000Z",
      updated_at: "2024-06-10T11:00:00.000Z",
    },
  ];

  for (const cr of crBills) {
    memoryClinicalRecords.set(cr.id, cr);
  }
}

// Initial seed
seedDefaultEncountersForPatient("pt_123", "Juan dela Cruz");

export async function upsertEncounter(patientId: string, raw: unknown) {
  const parsed = encounterSchema.safeParse(raw);
  if (!parsed.success || parsed.data.patientId !== patientId) return null;
  const encounter = parsed.data;
  const baseData = {
    patientName: encounter.patientName,
    date: encounter.date,
    doctorId: encounter.doctorId,
    doctor: encounter.doctor,
    specialty: encounter.specialty,
    clinic: encounter.clinic,
    chiefComplaint: encounter.chiefComplaint,
    appointmentDetails: encounter.appointmentDetails,
    clinicalSummary: encounter.clinicalSummary,
    source: "database",
  };

  const nowIso = new Date().toISOString();
  const memRow: EncounterRow = {
    id: encounter.id,
    patient_id: patientId,
    appointment_id: encounter.appointmentId ?? null,
    reference: encounter.encounterReference,
    encounter_date: encounter.encounterDate,
    data: baseData,
    created_at: nowIso,
    updated_at: nowIso,
  };
  memoryEncounters.set(encounter.id, memRow);

  for (const type of recordTypes) {
    const value = (encounter as Record<string, unknown>)[type];
    const values = type === "insurance" || type === "billing"
      ? [value]
      : Array.isArray(value) ? value : [];
    for (let index = 0; index < values.length; index += 1) {
      const data = values[index];
      const id = recordId(encounter.id, type, data, index);
      const payload = (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>;
      memoryClinicalRecords.set(id, {
        id,
        patient_id: patientId,
        encounter_id: encounter.id,
        appointment_id: encounter.appointmentId ?? null,
        record_type: type,
        data: payload,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  let row: EncounterRow | null = memRow;

  try {
    const existingRows = await db
      .select()
      .from(sugbodocEncounters)
      .where(eq(sugbodocEncounters.id, encounter.id))
      .limit(1);

    const existingRow = existingRows[0];
    if (existingRow && existingRow.patientId !== patientId) return null;

    let appointmentIdResolved: string | null = null;
    if (encounter.appointmentId) {
      const appointments = await db
        .select({ id: sugbodocAppointments.id })
        .from(sugbodocAppointments)
        .where(and(eq(sugbodocAppointments.id, encounter.appointmentId), eq(sugbodocAppointments.userId, patientId)))
        .limit(1);
      appointmentIdResolved = appointments[0]?.id ?? null;
    }

    if (existingRow) {
      const [updated] = await db
        .update(sugbodocEncounters)
        .set({
          patientId: patientId,
          appointmentId: appointmentIdResolved,
          reference: encounter.encounterReference,
          encounterDate: encounter.encounterDate,
          data: baseData,
          updatedAt: new Date(),
        })
        .where(eq(sugbodocEncounters.id, encounter.id))
        .returning();
      if (updated) {
        row = {
          id: updated.id,
          patient_id: updated.patientId,
          appointment_id: updated.appointmentId,
          reference: updated.reference,
          encounter_date: updated.encounterDate,
          data: updated.data as Record<string, unknown>,
          created_at: updated.createdAt.toISOString(),
          updated_at: updated.updatedAt.toISOString(),
        };
      }
    } else {
      const [created] = await db
        .insert(sugbodocEncounters)
        .values({
          id: encounter.id,
          patientId: patientId,
          appointmentId: appointmentIdResolved,
          reference: encounter.encounterReference,
          encounterDate: encounter.encounterDate,
          data: baseData,
        })
        .returning();
      if (created) {
        row = {
          id: created.id,
          patient_id: created.patientId,
          appointment_id: created.appointmentId,
          reference: created.reference,
          encounter_date: created.encounterDate,
          data: created.data as Record<string, unknown>,
          created_at: created.createdAt.toISOString(),
          updated_at: created.updatedAt.toISOString(),
        };
      }
    }

    for (const type of recordTypes) {
      const value = (encounter as Record<string, unknown>)[type];
      const values = type === "insurance" || type === "billing"
        ? [value]
        : Array.isArray(value) ? value : [];
      for (let index = 0; index < values.length; index += 1) {
        const data = values[index];
        const id = recordId(encounter.id, type, data, index);
        const payload = (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>;
        await db
          .insert(sugbodocClinicalRecords)
          .values({
            id,
            patientId: patientId,
            encounterId: encounter.id,
            appointmentId: appointmentIdResolved,
            recordType: type,
            data: payload,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: sugbodocClinicalRecords.id,
            set: {
              patientId: patientId,
              encounterId: encounter.id,
              appointmentId: appointmentIdResolved,
              recordType: type,
              data: payload,
              updatedAt: new Date(),
            },
          });
      }
    }
  } catch (err) {
    console.warn("[upsertEncounter] SQL sync skipped, using memory store:", err);
  }

  return row;
}

export async function getPatientBillRecords(patientId: string): Promise<ClinicalRecordRow[]> {
  try {
    const recordsData = await db
      .select()
      .from(sugbodocClinicalRecords)
      .where(and(eq(sugbodocClinicalRecords.patientId, patientId), eq(sugbodocClinicalRecords.recordType, "bills")));
    if (recordsData.length > 0) {
      return recordsData.map((r) => ({
        id: r.id,
        patient_id: r.patientId,
        encounter_id: r.encounterId,
        appointment_id: r.appointmentId,
        record_type: r.recordType,
        data: r.data as Record<string, unknown>,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      }));
    }
  } catch (err) {
    console.warn("[getPatientBillRecords] SQL fallback to memory:", err);
  }

  // Fallback memory
  const memBills = Array.from(memoryClinicalRecords.values()).filter(
    (r) => r.patient_id === patientId && r.record_type === "bills",
  );
  if (memBills.length > 0) return memBills;

  seedDefaultEncountersForPatient(patientId);
  return Array.from(memoryClinicalRecords.values()).filter(
    (r) => r.patient_id === patientId && r.record_type === "bills",
  );
}

export async function updatePatientBillStatus(recordId: string, updatedData: Record<string, unknown>) {
  const mem = memoryClinicalRecords.get(recordId);
  if (mem) {
    mem.data = { ...mem.data, ...updatedData };
    mem.updated_at = new Date().toISOString();
  }
  try {
    await db
      .update(sugbodocClinicalRecords)
      .set({ data: updatedData, updatedAt: new Date() })
      .where(eq(sugbodocClinicalRecords.id, recordId));
  } catch (err) {
    console.warn("[updatePatientBillStatus] SQL fallback to memory:", err);
  }
}

export async function insertPatientPaymentRecord(paymentRecord: {
  id: string;
  patientId: string;
  encounterId: string;
  data: Record<string, unknown>;
}) {
  const nowIso = new Date().toISOString();
  memoryClinicalRecords.set(paymentRecord.id, {
    id: paymentRecord.id,
    patient_id: paymentRecord.patientId,
    encounter_id: paymentRecord.encounterId,
    appointment_id: null,
    record_type: "payments",
    data: paymentRecord.data,
    created_at: nowIso,
    updated_at: nowIso,
  });

  try {
    await db
      .insert(sugbodocClinicalRecords)
      .values({
        id: paymentRecord.id,
        patientId: paymentRecord.patientId,
        encounterId: paymentRecord.encounterId,
        recordType: "payments",
        data: paymentRecord.data,
      })
      .onConflictDoUpdate({
        target: sugbodocClinicalRecords.id,
        set: {
          data: paymentRecord.data,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn("[insertPatientPaymentRecord] SQL fallback to memory:", err);
  }
}

export async function loadPatientEncounters(patientId: string) {
  let encountersData: any[] = [];
  let recordsData: any[] = [];

  try {
    encountersData = await db
      .select()
      .from(sugbodocEncounters)
      .where(eq(sugbodocEncounters.patientId, patientId))
      .orderBy(desc(sugbodocEncounters.encounterDate), desc(sugbodocEncounters.createdAt));

    recordsData = await db
      .select()
      .from(sugbodocClinicalRecords)
      .where(eq(sugbodocClinicalRecords.patientId, patientId))
      .orderBy(asc(sugbodocClinicalRecords.createdAt));
  } catch (err) {
    console.warn("[loadPatientEncounters] SQL query fallback to memory:", err);
  }

  if (encountersData.length === 0) {
    const memEncounters = Array.from(memoryEncounters.values()).filter((e) => e.patient_id === patientId);
    if (memEncounters.length === 0) {
      seedDefaultEncountersForPatient(patientId);
    }
    const fallbackEncounters = Array.from(memoryEncounters.values()).filter((e) => e.patient_id === patientId);
    const fallbackRecords = Array.from(memoryClinicalRecords.values()).filter((r) => r.patient_id === patientId);

    const byEncounter = new Map<string, ClinicalRecordRow[]>();
    for (const record of fallbackRecords) {
      const current = byEncounter.get(record.encounter_id) ?? [];
      current.push(record);
      byEncounter.set(record.encounter_id, current);
    }

    return fallbackEncounters.map((row) => {
      const grouped: Record<string, unknown> = {
        soapNotes: [], diagnoses: [], prescriptions: [], medications: [], pharmacyOrders: [],
        vitals: [], laboratoryResults: [], imaging: [], bills: [], payments: [], claims: [],
        insurance: null, billing: {
          consultationFee: 0,
          laboratoryCharges: 0,
          imagingCharges: 0,
          pharmacyCharges: 0,
          insuranceCoverage: 0,
          payments: [],
          relatedBillIds: [],
        },
      };
      for (const record of byEncounter.get(row.id) ?? []) {
        if (record.record_type === "insurance") {
          grouped[record.record_type] = record.data;
        } else if (record.record_type === "billing") {
          grouped.billing = {
            ...(grouped.billing as Record<string, unknown>),
            ...(record.data as Record<string, unknown>),
          };
        } else if (isRecordType(record.record_type)) {
          (grouped[record.record_type] as unknown[]).push(record.data);
        }
      }
      const rowData = (row.data as Record<string, unknown>) || {};
      return {
        ...rowData,
        ...grouped,
        appointmentDetails: (rowData.appointmentDetails as Record<string, unknown>) || {
          date: row.encounter_date || (rowData.date as string) || "Recent consultation",
          time: "Scheduled visit",
          status: "Completed",
        },
        id: row.id,
        patientId: row.patient_id,
        appointmentId: row.appointment_id,
        encounterReference: row.reference,
        encounterDate: row.encounter_date,
      };
    });
  }

  const records: ClinicalRecordRow[] = recordsData.map((r) => ({
    id: r.id,
    patient_id: r.patientId,
    encounter_id: r.encounterId,
    appointment_id: r.appointmentId,
    record_type: r.recordType,
    data: r.data as Record<string, unknown>,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }));

  const byEncounter = new Map<string, ClinicalRecordRow[]>();
  for (const record of records) {
    const current = byEncounter.get(record.encounter_id) ?? [];
    current.push(record);
    byEncounter.set(record.encounter_id, current);
  }

  return encountersData.map((row) => {
    const grouped: Record<string, unknown> = {
      soapNotes: [], diagnoses: [], prescriptions: [], medications: [], pharmacyOrders: [],
      vitals: [], laboratoryResults: [], imaging: [], bills: [], payments: [], claims: [],
      insurance: null, billing: {
        consultationFee: 0,
        laboratoryCharges: 0,
        imagingCharges: 0,
        pharmacyCharges: 0,
        insuranceCoverage: 0,
        payments: [],
        relatedBillIds: [],
      },
    };
    for (const record of byEncounter.get(row.id) ?? []) {
      if (record.record_type === "insurance") {
        grouped[record.record_type] = record.data;
      } else if (record.record_type === "billing") {
        grouped.billing = {
          ...(grouped.billing as Record<string, unknown>),
          ...(record.data as Record<string, unknown>),
        };
      } else if (isRecordType(record.record_type)) {
        (grouped[record.record_type] as unknown[]).push(record.data);
      }
    }
    const rowData = (row.data as Record<string, unknown>) || {};
    return {
      ...rowData,
      ...grouped,
      appointmentDetails: (rowData.appointmentDetails as Record<string, unknown>) || {
        date: row.encounterDate || (rowData.date as string) || "Recent consultation",
        time: "Scheduled visit",
        status: "Completed",
      },
      id: row.id,
      patientId: row.patientId,
      appointmentId: row.appointmentId,
      encounterReference: row.reference,
      encounterDate: row.encounterDate,
    };
  });
}

