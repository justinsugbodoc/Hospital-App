import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocMessageConversations, sugbodocMessages, sugbodocUsers, sugbodocAppointments } from "@/db/schema";
import { doctorCanAccessPatient, isAdminUser, isDoctorUser, MOCK_DOCTORS, type AuthUser, newId } from "@/lib/api/sugbodoc-auth.server";

declare global {
  var _memoryConversations: Map<string, ConversationRow> | undefined;
  var _memoryMessages: Map<string, MessageRow> | undefined;
  var _demoMessagesSeeded: boolean | undefined;
}

const memoryConversations = (globalThis._memoryConversations = globalThis._memoryConversations || new Map<string, ConversationRow>());
const memoryMessages = (globalThis._memoryMessages = globalThis._memoryMessages || new Map<string, MessageRow>());

export type ConversationRow = {
  id: string;
  patient_id: string;
  type: "admin" | "doctor";
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function ensureConversation(
  patientId: string,
  type: "admin" | "doctor" = "admin",
  doctorId?: string,
): Promise<ConversationRow> {
  const targetId = type === "doctor" && doctorId
    ? `conversation_${doctorId}_${patientId}`
    : `conversation_${type}_${patientId}`;

  // Check in-memory store
  const memExisting = memoryConversations.get(targetId);
  if (memExisting) return memExisting;

  try {
    const existingById = await db
      .select()
      .from(sugbodocMessageConversations)
      .where(eq(sugbodocMessageConversations.id, targetId))
      .limit(1);

    if (existingById[0]) {
      const conv: ConversationRow = {
        id: existingById[0].id,
        patient_id: existingById[0].patientId,
        type: (existingById[0].type as "admin" | "doctor") || type,
        updated_at: existingById[0].updatedAt.toISOString(),
      };
      memoryConversations.set(targetId, conv);
      return conv;
    }

    const [created] = await db
      .insert(sugbodocMessageConversations)
      .values({
        id: targetId,
        patientId: patientId,
        type: type,
      })
      .returning();

    if (created) {
      const conv: ConversationRow = {
        id: created.id,
        patient_id: created.patientId,
        type: (created.type as "admin" | "doctor") || type,
        updated_at: created.updatedAt.toISOString(),
      };
      memoryConversations.set(targetId, conv);
      return conv;
    }
  } catch (error: any) {
    if (error?.code !== "23505") {
      console.warn("[ensureConversation] SQL insert warning:", error);
    }
  }

  const fallback: ConversationRow = {
    id: targetId,
    patient_id: patientId,
    type: type,
    updated_at: new Date().toISOString(),
  };
  memoryConversations.set(targetId, fallback);
  return fallback;
}

export async function ensureDoctorConversation(patientId: string, doctorId: string): Promise<ConversationRow> {
  return ensureConversation(patientId, "doctor", doctorId);
}

export async function canAccessConversation(user: AuthUser, conversationId: string): Promise<ConversationRow | null> {
  // Check memory store
  let row = memoryConversations.get(conversationId);

  if (!row) {
    try {
      const existing = await db
        .select()
        .from(sugbodocMessageConversations)
        .where(eq(sugbodocMessageConversations.id, conversationId))
        .limit(1);

      if (existing[0]) {
        row = {
          id: existing[0].id,
          patient_id: existing[0].patientId,
          type: (existing[0].type as "admin" | "doctor") || (conversationId.includes("doctor") ? "doctor" : "admin"),
          updated_at: existing[0].updatedAt.toISOString(),
        };
        memoryConversations.set(conversationId, row);
      }
    } catch (err) {
      console.warn("[canAccessConversation] DB query warning:", err);
    }
  }

  if (!row) {
    // If conversation starts with conversation_, synthesize access check
    if (conversationId.startsWith("conversation_")) {
      const parts = conversationId.split("_");
      // e.g. conversation_admin_pt_123 or conversation_dr_1_pt_123 or conversation_doctor_pt_123
      const patientId = parts.slice(-2).join("_").startsWith("pt_") || parts[parts.length - 1]!.startsWith("usr_")
        ? parts.slice(2).join("_")
        : parts[parts.length - 1]!;
      const isDoctor = conversationId.includes("dr_") || conversationId.includes("doctor");
      row = {
        id: conversationId,
        patient_id: patientId,
        type: isDoctor ? "doctor" : "admin",
        updated_at: new Date().toISOString(),
      };
      memoryConversations.set(conversationId, row);
    } else {
      return null;
    }
  }

  // Patient access
  if (row.patient_id === user.id || conversationId.endsWith(`_${user.id}`)) {
    return row;
  }

  // Admin access
  if (isAdminUser(user)) {
    if (row.type === "admin") {
      return row;
    }
  }

  // Doctor access
  if (isDoctorUser(user)) {
    const doctorProviderId = user.providerId!;
    // If conversation is specifically for this doctor e.g. conversation_dr_2_pt_123
    if (conversationId.includes(`_${doctorProviderId}_`)) {
      return row;
    }
    // If legacy doctor conversation, verify this doctor has an appointment/encounter with the patient
    if (row.type === "doctor" && (await doctorCanAccessPatient(user, row.patient_id))) {
      return row;
    }
  }

  return null;
}

export function publicMessage(
  message: MessageRow,
  sender?: AuthUser | { name: string; initials: string; role: string } | null,
) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    senderName: sender?.name ?? "SugboDoc user",
    senderInitials: sender?.initials ?? "SD",
    senderRole: sender?.role ?? "Patient",
    body: message.body,
    readAt: message.read_at,
    createdAt: message.created_at,
  };
}

export async function seedDemoMessageThreads() {
  if (globalThis._demoMessagesSeeded) return;
  globalThis._demoMessagesSeeded = true;

  const patientId = "pt_123";

  // 1. Dr. Jose Reyes (dr_2)
  const dr2Conv = await ensureConversation(patientId, "doctor", "dr_2");
  await insertSeedMessageIfEmpty(dr2Conv.id, "doctor_dr_2", "Hello Juan, I reviewed your previous ECG results. Please remember to bring your blood pressure monitoring log to our clinic on Aug 15.", new Date(Date.now() - 3600 * 1000 * 24 * 2));
  await insertSeedMessageIfEmpty(dr2Conv.id, patientId, "Good day Dr. Reyes! Noted on this. My average reading this week has been around 125/82 mmHg.", new Date(Date.now() - 3600 * 1000 * 24 * 1));

  // 2. Dr. Maria Santos (dr_1)
  const dr1Conv = await ensureConversation(patientId, "doctor", "dr_1");
  await insertSeedMessageIfEmpty(dr1Conv.id, "doctor_dr_1", "Good morning Juan, for your upcoming Routine Checkup on Jul 30 at Cebu Doctors' Hospital, please ensure a 10-12 hour fasting period before laboratory draws.", new Date(Date.now() - 3600 * 1000 * 24 * 4));
  await insertSeedMessageIfEmpty(dr1Conv.id, patientId, "Understood Dr. Santos! Thank you for the reminder.", new Date(Date.now() - 3600 * 1000 * 24 * 3));

  // 3. Dr. Ana Villanueva (dr_3)
  const dr3Conv = await ensureConversation(patientId, "doctor", "dr_3");
  await insertSeedMessageIfEmpty(dr3Conv.id, "doctor_dr_3", "Hello Juan, your comprehensive health screening summary has been finalized and archived in your electronic medical records.", new Date(Date.now() - 3600 * 1000 * 24 * 7));

  // 4. Admin
  const adminConv = await ensureConversation(patientId, "admin");
  await insertSeedMessageIfEmpty(adminConv.id, "usr_admin_default", "Welcome to SugboDoc! If you have any inquiries regarding HMO approvals, PhilHealth claims, or specialist referrals, please reply directly here.", new Date(Date.now() - 3600 * 1000 * 24 * 10));
}

async function insertSeedMessageIfEmpty(conversationId: string, senderId: string, body: string, createdAt: Date) {
  const memList = Array.from(memoryMessages.values()).filter((m) => m.conversation_id === conversationId);
  if (memList.length > 0) return;

  const msgId = `msg_seed_${crypto.randomUUID().slice(0, 8)}`;
  const memMsg: MessageRow = {
    id: msgId,
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    read_at: new Date().toISOString(),
    created_at: createdAt.toISOString(),
  };
  memoryMessages.set(msgId, memMsg);

  try {
    const existing = await db
      .select({ id: sugbodocMessages.id })
      .from(sugbodocMessages)
      .where(eq(sugbodocMessages.conversationId, conversationId))
      .limit(1);

    if (!existing[0]) {
      await db.insert(sugbodocMessages).values({
        id: msgId,
        conversationId,
        senderId,
        body,
        readAt: new Date(),
        createdAt,
      });
    }
  } catch (err) {
    // ignore SQL seed collision
  }
}

