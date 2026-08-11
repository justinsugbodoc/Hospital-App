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

  let row: EncounterRow | null = null;
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
  return row;
}

export async function loadPatientEncounters(patientId: string) {
  const encountersData = await db
    .select()
    .from(sugbodocEncounters)
    .where(eq(sugbodocEncounters.patientId, patientId))
    .orderBy(desc(sugbodocEncounters.encounterDate), desc(sugbodocEncounters.createdAt));

  const recordsData = await db
    .select()
    .from(sugbodocClinicalRecords)
    .where(eq(sugbodocClinicalRecords.patientId, patientId))
    .orderBy(asc(sugbodocClinicalRecords.createdAt));

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
      insurance: null, billing: {},
    };
    for (const record of byEncounter.get(row.id) ?? []) {
      if (record.record_type === "insurance" || record.record_type === "billing") {
        grouped[record.record_type] = record.data;
      } else if (isRecordType(record.record_type)) {
        (grouped[record.record_type] as unknown[]).push(record.data);
      }
    }
    return {
      ...(row.data as Record<string, unknown>),
      ...grouped,
      id: row.id,
      patientId: row.patientId,
      appointmentId: row.appointmentId,
      encounterReference: row.reference,
      encounterDate: row.encounterDate,
    };
  });
}
