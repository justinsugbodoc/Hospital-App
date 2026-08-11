import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers, sugbodocSessions, sugbodocAppointments } from "@/db/schema";

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

export type UserRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  password_hash: string;
  phone: string;
  birthday: string;
  gender: string;
  blood_type: string;
  emergency_contact: { name: string; number: string } | null;
  role: string;
  provider_id: string | null;
  specialty: string;
  clinic: string;
  allergies: string[] | null;
  status: string;
  clinical_editing_permission: string;
  insurance_data: Record<string, unknown> | null;
  claims_data: Record<string, unknown>[] | null;
  created_at: string;
  updated_at: string;
};

export type AuthUser = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  bloodType: string;
  emergencyContact: { name: string; number: string } | null;
  role: string;
  providerId: string | null;
  specialty: string;
  clinic: string;
  allergies: string[];
  status: string;
  clinicalEditingPermission: boolean;
  insurance: Record<string, unknown> | null;
  claims: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
};

export function toPublicUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday,
    gender: user.gender,
    bloodType: user.blood_type,
    emergencyContact: user.emergency_contact,
    role: user.role,
    providerId: user.provider_id,
    specialty: user.specialty,
    clinic: user.clinic,
    allergies: user.allergies ?? [],
    status: user.status,
    clinicalEditingPermission: user.clinical_editing_permission === "true",
    insurance: user.insurance_data,
    claims: user.claims_data ?? [],
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
    : name.trim().slice(0, 2).toUpperCase();
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

export function randomToken(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  let binary = "";
  array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}${id}` : id;
}

export async function hashPassword(password: string, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-512" },
    key,
    512,
  );
  return `${salt}:${toHex(derived)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const salt = encoded.split(":")[0];
  if (!salt) return false;
  return (await hashPassword(password, salt)) === encoded;
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

function rowToUserRow(row: typeof sugbodocUsers.$inferSelect): UserRow {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    email: row.email,
    password_hash: row.passwordHash,
    phone: row.phone,
    birthday: row.birthday,
    gender: row.gender,
    blood_type: row.bloodType,
    emergency_contact: row.emergencyContact as { name: string; number: string } | null,
    role: row.role,
    provider_id: row.providerId,
    specialty: row.specialty,
    clinic: row.clinic,
    allergies: row.allergies as string[] | null,
    status: row.status,
    clinical_editing_permission: row.clinicalEditingPermission,
    insurance_data: row.insuranceData as Record<string, unknown> | null,
    claims_data: row.claimsData as Record<string, unknown>[] | null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function createSession(user: UserRow) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const tokenHash = await hashToken(token);
  await db.insert(sugbodocSessions).values({
    id: newId(),
    userId: user.id,
    tokenHash: tokenHash,
    expiresAt: expiresAt,
  });
  return { token, user: toPublicUser(user) };
}

export async function getUserRowFromRequest(request: Request): Promise<UserRow | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const sessions = await db
    .select({ userId: sugbodocSessions.userId })
    .from(sugbodocSessions)
    .where(and(eq(sugbodocSessions.tokenHash, tokenHash), gt(sugbodocSessions.expiresAt, new Date())))
    .limit(1);

  if (sessions.length === 0 || !sessions[0]) return null;

  const users = await db
    .select()
    .from(sugbodocUsers)
    .where(eq(sugbodocUsers.id, sessions[0].userId))
    .limit(1);

  if (users.length === 0 || !users[0]) return null;
  return rowToUserRow(users[0]);
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  const row = await getUserRowFromRequest(request);
  return row ? toPublicUser(row) : null;
}

export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  password: string;
}) {
  const [row] = await db
    .insert(sugbodocUsers)
    .values({
      id: `usr_${crypto.randomUUID()}`,
      name: input.name.trim(),
      initials: getInitials(input.name),
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      phone: input.phone.trim(),
      birthday: input.birthday,
      gender: input.gender,
      bloodType: "",
      role: "Patient",
      status: "Active",
      clinicalEditingPermission: "false",
    })
    .returning();
  if (!row) throw new Error("Failed to register user");
  return rowToUserRow(row);
}

export async function loginUser(email: string, password: string) {
  const users = await db
    .select()
    .from(sugbodocUsers)
    .where(eq(sugbodocUsers.email, normalizeEmail(email)))
    .limit(1);

  const userRow = users[0] ? rowToUserRow(users[0]) : null;
  if (!userRow || userRow.status === "Inactive" || !(await verifyPassword(password, userRow.password_hash))) {
    return null;
  }
  return userRow;
}

async function ensureUser(email: string, values: {
  id?: string;
  name: string;
  initials: string;
  password_hash: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  blood_type?: string;
  role?: string;
  provider_id?: string | null;
  specialty?: string;
  clinic?: string;
  allergies?: string[];
  status?: string;
  clinical_editing_permission?: string;
  insurance_data?: Record<string, unknown> | null;
  claims_data?: Record<string, unknown>[] | null;
}) {
  const existing = await db
    .select()
    .from(sugbodocUsers)
    .where(eq(sugbodocUsers.email, email))
    .limit(1);

  if (existing.length > 0 && existing[0]) return rowToUserRow(existing[0]);

  const [created] = await db
    .insert(sugbodocUsers)
    .values({
      id: values.id ?? `usr_${crypto.randomUUID()}`,
      name: values.name,
      initials: values.initials,
      email: email,
      passwordHash: values.password_hash,
      phone: values.phone ?? "",
      birthday: values.birthday ?? "",
      gender: values.gender ?? "",
      bloodType: values.blood_type ?? "",
      role: values.role ?? "Patient",
      providerId: values.provider_id ?? null,
      specialty: values.specialty ?? "",
      clinic: values.clinic ?? "",
      allergies: values.allergies ?? [],
      status: values.status ?? "Active",
      clinicalEditingPermission: values.clinical_editing_permission ?? "false",
      insuranceData: values.insurance_data ?? null,
      claimsData: values.claims_data ?? [],
    })
    .returning();

  if (!created) throw new Error("Failed to ensure user");
  return rowToUserRow(created);
}

export async function ensureDemoPatient() {
  return ensureUser("juan@example.com", {
    id: "pt_123",
    name: "Juan dela Cruz",
    initials: "JD",
    password_hash: await hashPassword("juan123"),
    phone: "+63 912 345 6789",
    birthday: "1991-03-15",
    gender: "Male",
    blood_type: "O+",
    role: "Patient",
    status: "Active",
    clinical_editing_permission: "false",
  });
}

export async function ensureDemoAdmin() {
  await ensureDemoPatient();
  return ensureUser("admin@sugbodoc.test", {
    id: `usr_${crypto.randomUUID()}`,
    name: "SugboDoc Administrator",
    initials: "SA",
    password_hash: await hashPassword("admin123"),
    phone: "+63 900 000 0000",
    birthday: "1988-01-01",
    gender: "Prefer not to say",
    blood_type: "",
    role: "Admin",
    status: "Active",
    clinical_editing_permission: "false",
    insurance_data: null,
    claims_data: [],
  });
}

export async function ensureDemoDoctor() {
  return ensureUser("doctor@sugbodoc.test", {
    id: "doctor_dr_2",
    name: "Dr. Jose Reyes",
    initials: "JR",
    password_hash: await hashPassword("doctor123"),
    phone: "+63 917 000 0002",
    birthday: "1982-06-18",
    gender: "Male",
    blood_type: "",
    role: "Doctor",
    provider_id: "dr_2",
    specialty: "Cardiology",
    clinic: "Chong Hua Hospital",
    allergies: [],
    status: "Active",
    clinical_editing_permission: "true",
    insurance_data: null,
    claims_data: [],
  });
}

export function isAdminUser(user: AuthUser | null) {
  return user?.role === "Admin" || user?.role === "Clinician";
}

export function isDoctorUser(user: AuthUser | null) {
  return user?.role === "Doctor" && Boolean(user.providerId);
}

export async function doctorCanAccessPatient(user: AuthUser | null, patientId: string) {
  if (!user || user.role !== "Doctor" || !user.providerId) return false;
  const providerId = user.providerId;
  const appointments = await db
    .select({ data: sugbodocAppointments.data })
    .from(sugbodocAppointments)
    .where(eq(sugbodocAppointments.userId, patientId));

  return appointments.some((appointment) => {
    const doctor = (appointment.data as Record<string, any>)?.doctor;
    return doctor?.id === providerId;
  });
}
