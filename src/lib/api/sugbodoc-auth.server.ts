import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocUsers, sugbodocSessions, sugbodocAppointments } from "@/db/schema";

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

// Global fallback in-memory cache to ensure published previews always allow login/signup even if SQL is unreachable or unconfigured
declare global {
  var _memoryUsers: Map<string, UserRow> | undefined;
  var _memorySessions: Map<string, { id: string; userId: string; tokenHash: string; expiresAt: Date }> | undefined;
}

const memoryUsers = (globalThis._memoryUsers = globalThis._memoryUsers || new Map<string, UserRow>());
const memorySessions = (globalThis._memorySessions = globalThis._memorySessions || new Map<string, { id: string; userId: string; tokenHash: string; expiresAt: Date }>());

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
  const sessionId = newId();

  // Always track in fallback memory
  memorySessions.set(tokenHash, { id: sessionId, userId: user.id, tokenHash, expiresAt });
  memoryUsers.set(user.id, user);
  memoryUsers.set(normalizeEmail(user.email), user);

  try {
    await db.insert(sugbodocSessions).values({
      id: sessionId,
      userId: user.id,
      tokenHash: tokenHash,
      expiresAt: expiresAt,
    });
  } catch (err) {
    console.warn("[createSession] SQL insert failed, using fallback in-memory session:", err);
  }

  return { token, user: toPublicUser(user) };
}

export async function getUserRowFromRequest(request: Request): Promise<UserRow | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const tokenHash = await hashToken(token);

  // Check SQL first
  try {
    const sessions = await db
      .select({ userId: sugbodocSessions.userId })
      .from(sugbodocSessions)
      .where(and(eq(sugbodocSessions.tokenHash, tokenHash), gt(sugbodocSessions.expiresAt, new Date())))
      .limit(1);

    if (sessions.length > 0 && sessions[0]) {
      const users = await db
        .select()
        .from(sugbodocUsers)
        .where(eq(sugbodocUsers.id, sessions[0].userId))
        .limit(1);

      if (users.length > 0 && users[0]) {
        const userRow = rowToUserRow(users[0]);
        memoryUsers.set(userRow.id, userRow);
        memoryUsers.set(normalizeEmail(userRow.email), userRow);
        return userRow;
      }
    }
  } catch (err) {
    console.warn("[getUserRowFromRequest] SQL lookup error, checking memory session fallback:", err);
  }

  // Fallback to memory sessions
  const memSession = memorySessions.get(tokenHash);
  if (memSession && memSession.expiresAt > new Date()) {
    const memUser = memoryUsers.get(memSession.userId);
    if (memUser) return memUser;
  }

  return null;
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
  const normalized = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const userId = `usr_${crypto.randomUUID()}`;
  const nowStr = new Date().toISOString();

  const memUser: UserRow = {
    id: userId,
    name: input.name.trim(),
    initials: getInitials(input.name),
    email: normalized,
    password_hash: passwordHash,
    phone: input.phone.trim(),
    birthday: input.birthday,
    gender: input.gender,
    blood_type: "",
    emergency_contact: null,
    role: "Patient",
    provider_id: null,
    specialty: "",
    clinic: "",
    allergies: [],
    status: "Active",
    clinical_editing_permission: "false",
    insurance_data: null,
    claims_data: [],
    created_at: nowStr,
    updated_at: nowStr,
  };

  // Attempt SQL insert
  try {
    const [row] = await db
      .insert(sugbodocUsers)
      .values({
        id: userId,
        name: input.name.trim(),
        initials: getInitials(input.name),
        email: normalized,
        passwordHash,
        phone: input.phone.trim(),
        birthday: input.birthday,
        gender: input.gender,
        bloodType: "",
        role: "Patient",
        status: "Active",
        clinicalEditingPermission: "false",
      })
      .returning();

    if (row) {
      const userRow = rowToUserRow(row);
      memoryUsers.set(userRow.id, userRow);
      memoryUsers.set(normalized, userRow);
      return userRow;
    }
  } catch (error: any) {
    if (error?.code === "23505" || String(error?.message ?? "").includes("duplicate key")) {
      throw error;
    }
    console.warn("[registerUser] SQL insertion failed, storing user in memory store:", error);
  }

  // Check for duplicate in memory
  if (memoryUsers.has(normalized)) {
    const err = new Error("An account with this email already exists.");
    (err as any).code = "23505";
    throw err;
  }

  memoryUsers.set(userId, memUser);
  memoryUsers.set(normalized, memUser);
  return memUser;
}

export async function loginUser(identifier: string, password: string) {
  const input = identifier.trim();
  let normalized = normalizeEmail(input);

  // Map username aliases to canonical emails
  const usernameMap: Record<string, string> = {
    "jose.reyes": "doctor@sugbodoc.test",
    "jose.reyes@sugbodoc.test": "doctor@sugbodoc.test",
    "doctor": "doctor@sugbodoc.test",
    "doctor@sugbodoc.test": "doctor@sugbodoc.test",
    "maria.santos": "maria.santos@sugbodoc.test",
    "maria.santos@sugbodoc.test": "maria.santos@sugbodoc.test",
    "ana.villanueva": "ana.villanueva@sugbodoc.test",
    "ana.villanueva@sugbodoc.test": "ana.villanueva@sugbodoc.test",
    "admin": "admin@sugbodoc.test",
    "admin@sugbodoc.test": "admin@sugbodoc.test",
    "juan": "juan@example.com",
    "juan@example.com": "juan@example.com",
  };

  const lowerInput = input.toLowerCase();
  if (usernameMap[lowerInput]) {
    normalized = usernameMap[lowerInput];
  } else if (!lowerInput.includes("@")) {
    normalized = `${lowerInput}@sugbodoc.test`;
  }

  // Ensure demo accounts exist before checking
  await ensureDemoAdmin();
  await ensureAllDemoDoctors();

  // Try DB first
  try {
    const users = await db
      .select()
      .from(sugbodocUsers)
      .where(eq(sugbodocUsers.email, normalized))
      .limit(1);

    const userRow = users[0] ? rowToUserRow(users[0]) : null;
    if (userRow) {
      if (userRow.status === "Inactive" || !(await verifyPassword(password, userRow.password_hash))) {
        return null;
      }
      memoryUsers.set(userRow.id, userRow);
      memoryUsers.set(normalized, userRow);
      return userRow;
    }
  } catch (error) {
    console.warn("[loginUser] SQL query failed, falling back to memory store:", error);
  }

  // Fallback to memory store
  const memUser = memoryUsers.get(normalized) || memoryUsers.get(lowerInput);
  if (memUser) {
    if (memUser.status === "Inactive" || !(await verifyPassword(password, memUser.password_hash))) {
      return null;
    }
    return memUser;
  }

  return null;
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
  aliases?: string[];
}) {
  const normalized = normalizeEmail(email);
  const nowStr = new Date().toISOString();
  const memUser: UserRow = {
    id: values.id ?? `usr_${crypto.randomUUID()}`,
    name: values.name,
    initials: values.initials,
    email: normalized,
    password_hash: values.password_hash,
    phone: values.phone ?? "",
    birthday: values.birthday ?? "",
    gender: values.gender ?? "",
    blood_type: values.blood_type ?? "",
    role: values.role ?? "Patient",
    provider_id: values.provider_id ?? null,
    specialty: values.specialty ?? "",
    clinic: values.clinic ?? "",
    allergies: values.allergies ?? [],
    status: values.status ?? "Active",
    clinical_editing_permission: values.clinical_editing_permission ?? "false",
    insurance_data: values.insurance_data ?? null,
    claims_data: values.claims_data ?? [],
    emergency_contact: null,
    created_at: nowStr,
    updated_at: nowStr,
  };

  // Always seed in-memory store so it is immediately accessible
  memoryUsers.set(memUser.id, memUser);
  memoryUsers.set(normalized, memUser);
  if (values.aliases) {
    for (const alias of values.aliases) {
      memoryUsers.set(alias.toLowerCase(), memUser);
    }
  }

  try {
    const existing = await db
      .select()
      .from(sugbodocUsers)
      .where(eq(sugbodocUsers.email, normalized))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      const userRow = rowToUserRow(existing[0]);
      memoryUsers.set(userRow.id, userRow);
      memoryUsers.set(normalized, userRow);
      return userRow;
    }

    const [created] = await db
      .insert(sugbodocUsers)
      .values({
        id: values.id ?? `usr_${crypto.randomUUID()}`,
        name: values.name,
        initials: values.initials,
        email: normalized,
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

    if (created) {
      const userRow = rowToUserRow(created);
      memoryUsers.set(userRow.id, userRow);
      memoryUsers.set(normalized, userRow);
      return userRow;
    }
  } catch (err) {
    console.warn(`[ensureUser] SQL sync skipped for ${email}, using memory store:`, err);
  }

  return memUser;
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
    aliases: ["juan"],
  });
}

export async function ensureDemoAdmin() {
  await ensureDemoPatient();
  return ensureUser("admin@sugbodoc.test", {
    id: "usr_admin_default",
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
    aliases: ["admin"],
  });
}

export const MOCK_DOCTORS = [
  {
    id: "doctor_dr_2",
    providerId: "dr_2",
    name: "Dr. Jose Reyes",
    initials: "JR",
    username: "jose.reyes",
    email: "doctor@sugbodoc.test",
    secondaryEmail: "jose.reyes@sugbodoc.test",
    specialty: "Cardiology",
    clinic: "Chong Hua Hospital",
    phone: "+63 917 000 0002",
    birthday: "1982-06-18",
    gender: "Male",
    role: "Doctor",
    password: "doctor123",
    aliases: ["jose.reyes", "doctor", "jose.reyes@sugbodoc.test"],
  },
  {
    id: "doctor_dr_1",
    providerId: "dr_1",
    name: "Dr. Maria Santos",
    initials: "MS",
    username: "maria.santos",
    email: "maria.santos@sugbodoc.test",
    specialty: "Internal Medicine",
    clinic: "Cebu Doctors' University Hospital",
    phone: "+63 917 000 0001",
    birthday: "1985-09-24",
    gender: "Female",
    role: "Doctor",
    password: "doctor123",
    aliases: ["maria.santos", "maria.santos@sugbodoc.test"],
  },
  {
    id: "doctor_dr_3",
    providerId: "dr_3",
    name: "Dr. Ana Villanueva",
    initials: "AV",
    username: "ana.villanueva",
    email: "ana.villanueva@sugbodoc.test",
    specialty: "OB-GYN",
    clinic: "Perpetual Succour Hospital",
    phone: "+63 917 000 0003",
    birthday: "1980-04-12",
    gender: "Female",
    role: "Doctor",
    password: "doctor123",
    aliases: ["ana.villanueva", "ana.villanueva@sugbodoc.test"],
  },
] as const;

export async function ensureAllDemoDoctors() {
  await ensureDemoPatient();
  const results = [];
  for (const doc of MOCK_DOCTORS) {
    const user = await ensureUser(doc.email, {
      id: doc.id,
      name: doc.name,
      initials: doc.initials,
      password_hash: await hashPassword(doc.password),
      phone: doc.phone,
      birthday: doc.birthday,
      gender: doc.gender,
      blood_type: "",
      role: "Doctor",
      provider_id: doc.providerId,
      specialty: doc.specialty,
      clinic: doc.clinic,
      allergies: [],
      status: "Active",
      clinical_editing_permission: "true",
      insurance_data: null,
      claims_data: [],
      aliases: [...doc.aliases],
    });
    results.push(user);
  }
  return results;
}

export async function ensureDemoDoctor() {
  const doctors = await ensureAllDemoDoctors();
  return doctors[0]; // Dr. Jose Reyes (doctor@sugbodoc.test)
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
  try {
    const appointments = await db
      .select({ data: sugbodocAppointments.data })
      .from(sugbodocAppointments)
      .where(eq(sugbodocAppointments.userId, patientId));

    const hasAppointment = appointments.some((appointment) => {
      const doctor = (appointment.data as Record<string, any>)?.doctor;
      return doctor?.id === providerId || doctor?.providerId === providerId;
    });
    if (hasAppointment) return true;

    // Check memory store for appointments as well
    const memAppts = Array.from(globalThis._memoryAppointments?.values() || []);
    const hasMemAppt = memAppts.some((appt) => {
      if (appt.user_id !== patientId) return false;
      const doctor = (appt.data as Record<string, any>)?.doctor;
      return doctor?.id === providerId || doctor?.providerId === providerId;
    });
    if (hasMemAppt) return true;

    return false;
  } catch (err) {
    console.warn("[doctorCanAccessPatient] DB query fallback:", err);
    // In fallback mode, check memory appointments
    const memAppts = Array.from(globalThis._memoryAppointments?.values() || []);
    return memAppts.some((appt) => {
      if (appt.user_id !== patientId) return false;
      const doctor = (appt.data as Record<string, any>)?.doctor;
      return doctor?.id === providerId || doctor?.providerId === providerId;
    });
  }
}

