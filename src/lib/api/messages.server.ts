import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocMessageConversations, sugbodocMessages } from "@/db/schema";
import { doctorCanAccessPatient, isAdminUser, isDoctorUser, type AuthUser } from "@/lib/api/sugbodoc-auth.server";

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
  type: "admin" | "doctor" = "admin"
): Promise<ConversationRow> {
  const targetId = `conversation_${type}_${patientId}`;

  const existingById = await db
    .select()
    .from(sugbodocMessageConversations)
    .where(eq(sugbodocMessageConversations.id, targetId))
    .limit(1);

  if (existingById[0]) {
    return {
      id: existingById[0].id,
      patient_id: existingById[0].patientId,
      type: (existingById[0].type as "admin" | "doctor") || type,
      updated_at: existingById[0].updatedAt.toISOString(),
    };
  }

  const existingByType = await db
    .select()
    .from(sugbodocMessageConversations)
    .where(and(eq(sugbodocMessageConversations.patientId, patientId), eq(sugbodocMessageConversations.type, type)))
    .limit(1);

  if (existingByType[0]) {
    return {
      id: existingByType[0].id,
      patient_id: existingByType[0].patientId,
      type: (existingByType[0].type as "admin" | "doctor") || type,
      updated_at: existingByType[0].updatedAt.toISOString(),
    };
  }

  try {
    const [created] = await db
      .insert(sugbodocMessageConversations)
      .values({
        id: targetId,
        patientId: patientId,
        type: type,
      })
      .returning();

    if (created) {
      return {
        id: created.id,
        patient_id: created.patientId,
        type: (created.type as "admin" | "doctor") || type,
        updated_at: created.updatedAt.toISOString(),
      };
    }
  } catch (error: any) {
    if (error?.code !== "23505") throw error;
  }

  const fallback = await db
    .select()
    .from(sugbodocMessageConversations)
    .where(eq(sugbodocMessageConversations.id, targetId))
    .limit(1);

  if (!fallback[0]) throw new Error("Failed to ensure conversation");
  return {
    id: fallback[0].id,
    patient_id: fallback[0].patientId,
    type: (fallback[0].type as "admin" | "doctor") || type,
    updated_at: fallback[0].updatedAt.toISOString(),
  };
}

export async function canAccessConversation(user: AuthUser, conversationId: string): Promise<ConversationRow | null> {
  const existing = await db
    .select()
    .from(sugbodocMessageConversations)
    .where(eq(sugbodocMessageConversations.id, conversationId))
    .limit(1);

  const row = existing[0];
  if (!row) return null;

  const convType: "admin" | "doctor" = (row.type as "admin" | "doctor") || (conversationId.includes("doctor") ? "doctor" : "admin");

  const conversation: ConversationRow = {
    id: row.id,
    patient_id: row.patientId,
    type: convType,
    updated_at: row.updatedAt.toISOString(),
  };

  if (conversation.patient_id === user.id) {
    return conversation;
  }

  if (isAdminUser(user)) {
    if (conversation.type === "admin") {
      return conversation;
    }
  }

  if (isDoctorUser(user)) {
    if (conversation.type === "doctor" && (await doctorCanAccessPatient(user, conversation.patient_id))) {
      return conversation;
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
