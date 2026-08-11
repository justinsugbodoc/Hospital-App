// Ported helpers from the original Express api-server `routes/admin-operations.ts`.
import { errorJson } from "@/lib/api/http.server";
import { getUserFromRequest, isAdminUser, type AuthUser } from "@/lib/api/sugbodoc-auth.server";

export const defaultSchedules = [
  ["dr_1", "Dr. Maria Santos", "Internal Medicine", "Cebu Doctors' University Hospital", "Monday"],
  ["dr_2", "Dr. Jose Reyes", "Cardiology", "Chong Hua Hospital", "Tuesday"],
  ["dr_3", "Dr. Ana Villanueva", "OB-GYN", "Perpetual Succour Hospital", "Wednesday"],
  ["dr_4", "Dr. Carlo Mendoza", "Dermatology", "Vicente Sotto Memorial Medical Center", "Thursday"],
  ["dr_5", "Dr. Lea Fernandez", "Pediatrics", "Cebu Doctors' University Hospital", "Friday"],
] as const;

export async function requireAdmin(request: Request): Promise<AuthUser | Response> {
  const user = await getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return errorJson("Admin access required.", user ? 403 : 401);
  }
  return user as AuthUser;
}

export type ScheduleRow = {
  id: string;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  clinic: string;
  day: string;
  start_time: string;
  end_time: string;
  slots: number;
  enabled: boolean;
  updated_at: string;
};

export function toPublicSchedule(row: ScheduleRow) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    specialty: row.specialty,
    clinic: row.clinic,
    day: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
    slots: Number(row.slots),
    enabled: row.enabled,
    updatedAt: row.updated_at,
  };
}

export type AuditEventRow = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
};

export function toPublicAuditEvent(row: AuditEventRow) {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    timestamp: row.timestamp,
  };
}
