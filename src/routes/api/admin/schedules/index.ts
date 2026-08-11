import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { asc, ne } from "drizzle-orm";
import { db } from "@/db";
import { sugbodocAdminSchedules } from "@/db/schema";
import { errorJson, json, readJson } from "@/lib/api/http.server";
import { defaultSchedules, requireAdmin, toPublicSchedule, type ScheduleRow } from "@/lib/api/admin-operations.server";

const scheduleSchema = z.object({
  id: z.string().min(1),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  specialty: z.string().min(1),
  clinic: z.string().min(1),
  day: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  slots: z.number().int().min(0),
  enabled: z.boolean(),
});

export const Route = createFileRoute("/api/admin/schedules/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await requireAdmin(request);
        if (user instanceof Response) return user;

        let rowsData = await db
          .select()
          .from(sugbodocAdminSchedules)
          .orderBy(asc(sugbodocAdminSchedules.doctorName));

        if (rowsData.length === 0) {
          for (const [doctorId, doctorName, specialty, clinic, day] of defaultSchedules) {
            await db.insert(sugbodocAdminSchedules).values({
              id: `schedule_${doctorId}`,
              doctorId: doctorId,
              doctorName: doctorName,
              specialty,
              clinic,
              day,
              startTime: "09:00",
              endTime: "17:00",
              slots: 8,
              enabled: true,
            });
          }
          rowsData = await db
            .select()
            .from(sugbodocAdminSchedules)
            .orderBy(asc(sugbodocAdminSchedules.doctorName));
        }

        const rows: ScheduleRow[] = rowsData.map((r) => ({
          id: r.id,
          doctor_id: r.doctorId,
          doctor_name: r.doctorName,
          specialty: r.specialty,
          clinic: r.clinic,
          day: r.day,
          start_time: r.startTime,
          end_time: r.endTime,
          slots: r.slots,
          enabled: r.enabled,
          updated_at: r.updatedAt.toISOString(),
        }));

        return json({ schedules: rows.map(toPublicSchedule) });
      },
      PUT: async ({ request }) => {
        const user = await requireAdmin(request);
        if (user instanceof Response) return user;

        const body = await readJson<{ schedules?: unknown }>(request);
        const parsed = z.array(scheduleSchema).safeParse(body?.schedules);
        if (!parsed.success) {
          return errorJson("Invalid schedule data.", 400);
        }

        await db.delete(sugbodocAdminSchedules).where(ne(sugbodocAdminSchedules.id, ""));

        if (parsed.data.length > 0) {
          for (const schedule of parsed.data) {
            await db.insert(sugbodocAdminSchedules).values({
              id: schedule.id,
              doctorId: schedule.doctorId,
              doctorName: schedule.doctorName,
              specialty: schedule.specialty,
              clinic: schedule.clinic,
              day: schedule.day,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              slots: schedule.slots,
              enabled: schedule.enabled,
            });
          }
        }

        const rowsData = await db
          .select()
          .from(sugbodocAdminSchedules)
          .orderBy(asc(sugbodocAdminSchedules.doctorName));

        const rows: ScheduleRow[] = rowsData.map((r) => ({
          id: r.id,
          doctor_id: r.doctorId,
          doctor_name: r.doctorName,
          specialty: r.specialty,
          clinic: r.clinic,
          day: r.day,
          start_time: r.startTime,
          end_time: r.endTime,
          slots: r.slots,
          enabled: r.enabled,
          updated_at: r.updatedAt.toISOString(),
        }));

        return json({ schedules: rows.map(toPublicSchedule) });
      },
    },
  },
});
