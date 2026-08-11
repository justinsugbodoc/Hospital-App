# Porting brief: Express API -> TanStack Start server routes

Source repo (read-only): `/tmp/Asset-Manager`
- Express routes: `/tmp/Asset-Manager/artifacts/api-server/src/routes/*.ts`
- Drizzle schema: `/tmp/Asset-Manager/lib/db/src/schema/sugbodoc.ts`

Target project: `/dev-server` (TanStack Start + Lovable Cloud / Supabase).

## Rules

1. Port each Express handler to a TanStack server route under `src/routes/api/...`
   preserving the EXACT URL path, HTTP method, request body shape, response JSON
   shape and status codes. The existing frontend calls these paths unchanged.
2. File shape:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { errorJson, json, readJson, searchParams } from "@/lib/api/http.server";
import { db, getUserFromRequest, isAdminUser, isDoctorUser, doctorCanAccessPatient, newId } from "@/lib/api/sugbodoc-auth.server";

export const Route = createFileRoute("/api/appointments")({
  server: {
    handlers: {
      GET: async ({ request, params }) => { /* ... */ return json({ appointments: [] }); },
    },
  },
});
```

   - `/api/records/:encounterId/patient-data` -> `src/routes/api/records/$encounterId/patient-data.ts`
     with route id `"/api/records/$encounterId/patient-data"`; read the value via `params.encounterId`.
   - A collection path like `/api/records` -> `src/routes/api/records/index.ts` with id `"/api/records/"`.
     If unsure about the trailing slash, write `"/api/records"` — the dev server prints the
     expected id if it's wrong.
   - Never edit `src/routeTree.gen.ts`.
3. Database access: no Drizzle, no `pg`. Use the service-role Supabase client
   through `db()` from `@/lib/api/sugbodoc-auth.server` (already written; read it first).
   Table names are unchanged (`sugbodoc_users`, `sugbodoc_appointments`,
   `sugbodoc_encounters`, `sugbodoc_clinical_records`, `sugbodoc_pharmacy_medications`,
   `sugbodoc_pharmacy_orders`, `sugbodoc_pharmacy_bills`, `sugbodoc_pharmacy_payments`,
   `sugbodoc_admin_schedules`, `sugbodoc_audit_events`, `sugbodoc_message_conversations`,
   `sugbodoc_messages`, `sugbodoc_sessions`).
   Columns are snake_case in the DB (`user_id`, `created_at`, `record_type`,
   `encounter_date`, `patient_id`, `provider_id`, ...). When a response returns a row
   to the client, map it back to the camelCase shape the original Drizzle row had, so
   the frontend keeps working. Timestamps come back as ISO strings — that matches what
   JSON serialization produced before.
   Example query translations:
   - `db.select().from(t).where(eq(t.userId, id))` -> `const { data } = await db().from("t").select("*").eq("user_id", id)`
   - insert + returning -> `.insert({...}).select("*").single()`
   - update -> `.update({...}).eq("id", id).select("*").single()`
   - delete -> `.delete().eq("id", id)`
   - ordering -> `.order("created_at", { ascending: false })`
   - Supabase has no joins by SQL; do two queries and stitch in JS.
   - `numeric` columns come back as strings; keep the original number/string handling the
     old code produced (use `Number(x)` where the old code did arithmetic).
   - Casting: this project has strict TS. Use `as never` on insert/update payload objects
     and `as unknown as SomeRow` on results when the generated types complain.
4. IDs: replace `randomUUID()` with `crypto.randomUUID()` (or `newId("prefix_")`).
   Replace node `crypto` hashing with the helpers in `sugbodoc-auth.server.ts`.
5. Auth: replace `getUserFromRequest(req)` with `await getUserFromRequest(request)`
   (same returned `AuthUser` shape, camelCase). Keep every authorization check identical.
6. Any pure helper functions / constants / seed data at the top of the Express route file
   should be copied into a sibling module under `src/lib/api/<name>.server.ts` and imported,
   OR kept in the route file if small. Do not import anything from `@workspace/*`.
7. `process.env['X']` must be read INSIDE the handler, never at module scope.
   If an external key (e.g. `STRIPE_SECRET_KEY`, `RESEND_API_KEY`) is missing, return a
   clear 500/501 JSON error instead of crashing.
8. Node-only APIs are unavailable (no `fs`, no `child_process`, no `node:crypto` scrypt).
   Use Web APIs. `stripe` npm package: use plain `fetch` against `https://api.stripe.com/v1/...`
   with `Authorization: Bearer <key>` and `application/x-www-form-urlencoded` bodies
   instead of the SDK.
9. When done, verify with: `cd /dev-server && bunx tsgo --noEmit` (report remaining errors
   only for the files you wrote) and `curl -s localhost:8080/api/<your-path>` where a GET
   endpoint exists (expect 401 JSON when unauthenticated — that proves routing works).
10. Only create/modify the files for YOUR assigned endpoints. Other agents work in parallel
    on other route files — do not touch `src/lib/api/http.server.ts`,
    `src/lib/api/sugbodoc-auth.server.ts`, `src/routes/api/accounts/*`, or shared config.
