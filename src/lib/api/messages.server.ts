import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocMessageConversations, sugbodocMessages } from "@/db/schema";
import { doctorCanAccessPatient, isAdminUser, isDoctorUser, type AuthUser } from "@/lib/api/sugbodoc-auth.server";

export type ConversationRow = {
  id: string;
  patient_id: string;
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

export async function ensureConversation(patientId: string): Promise<ConversationRow> {
  const existing = await db
    .select()
    .from(sugbodocMessageConversations)
    .where(eq(sugbodocMessageConversations.patientId, patientId))
    .limit(1);

  if (existing[0]) {
    return {
      id: existing[0].id,
      patient_id: existing[0].patientId,
      updated_at: existing[0].updatedAt.toISOString(),
    };
  }

  try {
    const [created] = await db
      .insert(sugbodocMessageConversations)
      .values({
        id: `conversation_${patientId}`,
        patientId: patientId,
      })
      .returning();

    if (created) {
      return {
        id: created.id,
        patient_id: created.patientId,
        updated_at: created.updatedAt.toISOString(),
      };
    }
  } catch (error: any) {
    if (error?.code !== "23505") throw error;
  }

  const fallback = await db
    .select()
    .from(sugbodocMessageConversations)
    .where(eq(sugbodocMessageConversations.patientId, patientId))
    .limit(1);

  if (!fallback[0]) throw new Error("Failed to ensure conversation");
  return {
    id: fallback[0].id,
    patient_id: fallback[0].patientId,
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

  const conversation: ConversationRow = {
    id: row.id,
    patient_id: row.patientId,
    updated_at: row.updatedAt.toISOString(),
  };

  if (
    !isAdminUser(user) &&
    conversation.patient_id !== user.id &&
    !(isDoctorUser(user) && (await doctorCanAccessPatient(user, conversation.patient_id)))
  ) {
    return null;
  }
  return conversation;
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
