import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  sugbodocUsers,
  sugbodocAppointments,
  sugbodocEncounters,
  sugbodocClinicalRecords,
  sugbodocAuditEvents,
} from "@/db/schema";
import {
  doctorCanAccessPatient,
  getUserFromRequest,
  isDoctorUser,
  type AuthUser,
} from "@/lib/api/sugbodoc-auth.server";

export type AppointmentRow = {
  id: string;
  user_id: string;
  reference: string;
  date: string;
  time: string;
  status: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type PatientRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  blood_type: string;
  emergency_contact: { name: string; number: string } | null;
  allergies: string[] | null;
  insurance_data: Record<string, unknown> | null;
  claims_data: Record<string, unknown>[] | null;
  role: string;
};

export type EncounterRow = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  reference: string;
  encounter_date: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type ClinicalRecordRow = {
  id: string;
  patient_id: string;
  encounter_id: string;
  appointment_id: string | null;
  record_type: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function requireDoctor(request: Request): Promise<{ error: Response } | { user: AuthUser }> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } }) };
  }
  if (!isDoctorUser(user)) {
    return { error: new Response(JSON.stringify({ error: "Doctor access required." }), { status: 403, headers: { "Content-Type": "application/json" } }) };
  }
  return { user };
}

export async function assignedAppointments(doctorId: string): Promise<AppointmentRow[]> {
  const appointmentsData = await db
    .select()
    .from(sugbodocAppointments)
    .orderBy(desc(sugbodocAppointments.date), desc(sugbodocAppointments.time));

  const rows: AppointmentRow[] = appointmentsData.map((a) => ({
    id: a.id,
    user_id: a.userId,
    reference: a.reference,
    date: a.date,
    time: a.time,
    status: a.status,
    data: a.data as Record<string, any>,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  }));

  return rows.filter((row) => (row.data as Record<string, any>)?.doctor?.id === doctorId);
}

export function toAppointment(row: AppointmentRow, patient?: { name: string; initials: string; email: string }) {
  return {
    ...(row.data as Record<string, unknown>),
    id: row.id,
    reference: row.reference,
    date: row.date,
    time: row.time,
    status: row.status,
    ...(patient ? { patientName: patient.name, patientInitials: patient.initials, patientEmail: patient.email } : {}),
  };
}

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
}

export async function recordAudit(actor: string, action: string, target: string) {
  await db.insert(sugbodocAuditEvents).values({
    id: `audit_${crypto.randomUUID()}`,
    actor,
    action,
    target,
  });
}

const recordTypes = [
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
type RecordType = (typeof recordTypes)[number];

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

export async function upsertEncounter(patientId: string, raw: unknown): Promise<EncounterRow | null> {
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

  const existing = existingRows[0];
  if (existing && existing.patientId !== patientId) return null;

  let appointmentId: string | null = null;
  if (encounter.appointmentId) {
    const apptRows = await db
      .select({ id: sugbodocAppointments.id })
      .from(sugbodocAppointments)
      .where(and(eq(sugbodocAppointments.id, encounter.appointmentId), eq(sugbodocAppointments.userId, patientId)))
      .limit(1);
    appointmentId = apptRows[0]?.id ?? null;
  }

  let row: EncounterRow | null = null;
  if (existing) {
    const [updated] = await db
      .update(sugbodocEncounters)
      .set({
        patientId: patientId,
        appointmentId: appointmentId,
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
        data: updated.data as Record<string, any>,
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
        appointmentId: appointmentId,
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
        data: created.data as Record<string, any>,
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
      const recordData = (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>;
      await db
        .insert(sugbodocClinicalRecords)
        .values({
          id,
          patientId: patientId,
          encounterId: encounter.id,
          appointmentId: appointmentId,
          recordType: type,
          data: recordData,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: sugbodocClinicalRecords.id,
          set: {
            patientId: patientId,
            encounterId: encounter.id,
            appointmentId: appointmentId,
            recordType: type,
            data: recordData,
            updatedAt: new Date(),
          },
        });
    }
  }
  return row;
}

export async function loadPatientEncounters(patientId: string) {
  const encounterRows = await db
    .select()
    .from(sugbodocEncounters)
    .where(eq(sugbodocEncounters.patientId, patientId))
    .orderBy(desc(sugbodocEncounters.encounterDate), desc(sugbodocEncounters.createdAt));

  const recordRows = await db
    .select()
    .from(sugbodocClinicalRecords)
    .where(eq(sugbodocClinicalRecords.patientId, patientId))
    .orderBy(asc(sugbodocClinicalRecords.createdAt));

  const records: ClinicalRecordRow[] = recordRows.map((r) => ({
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

  return encounterRows.map((row) => {
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
    } as Record<string, any>;
  });
}

export async function deleteEncounterClinicalRecords(encounterId: string) {
  await db.delete(sugbodocClinicalRecords).where(eq(sugbodocClinicalRecords.encounterId, encounterId));
}

export async function ensureAppointmentEncounter(
  appointment: AppointmentRow,
  patient: PatientRow,
  doctor: AuthUser,
  status: string,
) {
  const existingRows = await db
    .select()
    .from(sugbodocEncounters)
    .where(and(eq(sugbodocEncounters.appointmentId, appointment.id), eq(sugbodocEncounters.patientId, patient.id)))
    .limit(1);

  const existing = existingRows[0];

  const appointmentDetails = {
    ...((existing?.data as Record<string, unknown> | undefined)?.appointmentDetails as Record<string, unknown> | undefined),
    date: appointment.date,
    time: appointment.time,
    status,
    reference: appointment.reference,
  };

  if (existing) {
    await db
      .update(sugbodocEncounters)
      .set({
        data: {
          ...(existing.data as Record<string, unknown>),
          patientName: patient.name,
          date: appointment.date,
          doctorId: doctor.providerId,
          doctor: doctor.name,
          specialty: doctor.specialty,
          clinic: doctor.clinic,
          appointmentDetails,
        },
        updatedAt: new Date(),
      })
      .where(eq(sugbodocEncounters.id, existing.id));

    return (await loadPatientEncounters(patient.id)).find((item) => item.id === existing.id) ?? null;
  }

  const id = `enc_${appointment.id}`;
  const created = await upsertEncounter(patient.id, {
    id,
    encounterReference: `ENC-${appointment.reference}`,
    appointmentId: appointment.id,
    patientId: patient.id,
    patientName: patient.name,
    encounterDate: new Date().toISOString(),
    date: appointment.date,
    doctorId: doctor.providerId,
    doctor: doctor.name,
    specialty: doctor.specialty,
    clinic: doctor.clinic,
    chiefComplaint: (appointment.data as Record<string, any>).reason ?? "Consultation",
    appointmentDetails,
    clinicalSummary: "",
    billing: {
      consultationFee: Number((appointment.data as Record<string, any>).billing?.originalAmount ?? 0),
      laboratoryCharges: 0,
      imagingCharges: 0,
      pharmacyCharges: 0,
      insuranceCoverage: Number((appointment.data as Record<string, any>).billing?.estimatedInsuranceCoverage ?? 0),
      payments: [],
      relatedBillIds: [],
    },
    soapNotes: [],
    diagnoses: [],
    prescriptions: [],
    medications: [],
    pharmacyOrders: [],
    vitals: [],
    laboratoryResults: [],
    imaging: [],
    bills: [],
    payments: [],
    insurance: patient.insurance_data,
    claims: patient.claims_data ?? [],
  });
  return created ? (await loadPatientEncounters(patient.id)).find((item) => item.id === id) ?? null : null;
}

export function appointmentBill(appointment: AppointmentRow, encounter: Record<string, any>) {
  const appointmentData = appointment.data as Record<string, any>;
  const billing = encounter.billing as Record<string, any> | undefined;
  const configuredAmount = Number(appointmentData.billing?.originalAmount ?? 0);
  const recordedCharges = [
    billing?.consultationFee,
    billing?.laboratoryCharges,
    billing?.imagingCharges,
    billing?.procedureCharges,
    billing?.pharmacyCharges,
  ].reduce((total: number, value) => total + Number(value ?? 0), 0);
  const amount = recordedCharges > 0 ? recordedCharges : configuredAmount;
  const billId = `bill_${appointment.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    id: billId,
    appointmentId: appointment.id,
    encounterId: encounter.id,
    encounterReference: encounter.encounterReference,
    billReference: `BILL-${appointment.reference}`,
    description: `${appointmentData.visitType ?? "Consultation"} - ${appointmentData.doctor?.name ?? "SugboDoc"}`,
    date: appointment.date,
    amount,
    status: "Pending",
    insuranceCoverage: Number(appointmentData.billing?.estimatedInsuranceCoverage ?? billing?.insuranceCoverage ?? 0),
  };
}

export async function ensureCompletedAppointmentBill(
  appointment: AppointmentRow,
  patient: PatientRow,
  encounter: Record<string, any>,
) {
  const bills = Array.isArray(encounter.bills) ? encounter.bills : [];
  const existingBill = bills.find((bill: any) =>
    bill.appointmentId === appointment.id || bill.id === `bill_${appointment.id}`,
  );
  const bill = appointmentBill(appointment, encounter);
  if (existingBill?.status === "Paid") return encounter;
  const nextBills = existingBill
    ? bills.map((item: any) => item.id === existingBill.id ? { ...item, ...bill, status: item.status ?? "Pending" } : item)
    : [...bills, bill];
  const billing = encounter.billing ?? {};
  await deleteEncounterClinicalRecords(encounter.id);
  await upsertEncounter(patient.id, {
    ...encounter,
    bills: nextBills,
    billing: {
      ...billing,
      relatedBillIds: [...new Set([...(billing.relatedBillIds ?? []), existingBill?.id ?? bill.id])],
    },
  });
  return (await loadPatientEncounters(patient.id)).find((item) => item.id === encounter.id) ?? encounter;
}

export async function patientSummary(patientId: string, doctorId: string) {
  const patientRows = await db
    .select()
    .from(sugbodocUsers)
    .where(and(eq(sugbodocUsers.id, patientId), eq(sugbodocUsers.role, "Patient")))
    .limit(1);

  const p = patientRows[0];
  if (!p || !(await doctorCanAccessPatient({ role: "Doctor", providerId: doctorId } as AuthUser, patientId))) return null;

  const patient: PatientRow = {
    id: p.id,
    name: p.name,
    initials: p.initials,
    email: p.email,
    phone: p.phone,
    birthday: p.birthday,
    gender: p.gender,
    blood_type: p.bloodType,
    emergency_contact: p.emergencyContact as { name: string; number: string } | null,
    allergies: p.allergies as string[] | null,
    insurance_data: p.insuranceData as Record<string, unknown> | null,
    claims_data: p.claimsData as Record<string, unknown>[] | null,
    role: p.role,
  };

  const appointments = (await assignedAppointments(doctorId)).filter((row) => row.user_id === patientId);
  const encounters = await loadPatientEncounters(patientId);
  return {
    id: patient.id,
    name: patient.name,
    initials: patient.initials,
    email: patient.email,
    phone: patient.phone,
    birthday: patient.birthday,
    gender: patient.gender,
    bloodType: patient.blood_type,
    allergies: patient.allergies ?? [],
    emergencyContact: patient.emergency_contact,
    insurance: patient.insurance_data,
    appointments: appointments.map((row) => toAppointment(row, { name: patient.name, initials: patient.initials, email: patient.email })),
    encounters,
  };
}
