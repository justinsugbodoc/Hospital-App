import { pgTable, text, timestamp, integer, boolean, numeric, jsonb } from "drizzle-orm/pg-core";

export const sugbodocUsers = pgTable("sugbodoc_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone").notNull().default(""),
  birthday: text("birthday").notNull().default(""),
  gender: text("gender").notNull().default(""),
  bloodType: text("blood_type").notNull().default(""),
  emergencyContact: jsonb("emergency_contact"),
  role: text("role").notNull().default("Patient"),
  providerId: text("provider_id"),
  specialty: text("specialty").notNull().default(""),
  clinic: text("clinic").notNull().default(""),
  allergies: jsonb("allergies").notNull().default([]),
  status: text("status").notNull().default("Active"),
  clinicalEditingPermission: text("clinical_editing_permission").notNull().default("false"),
  insuranceData: jsonb("insurance_data"),
  claimsData: jsonb("claims_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocSessions = pgTable("sugbodoc_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocAppointments = pgTable("sugbodoc_appointments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("Pending"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocEncounters = pgTable("sugbodoc_encounters", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").references(() => sugbodocAppointments.id, { onDelete: "set null" }),
  reference: text("reference").notNull().unique(),
  encounterDate: text("encounter_date").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocClinicalRecords = pgTable("sugbodoc_clinical_records", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  encounterId: text("encounter_id").notNull().references(() => sugbodocEncounters.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").references(() => sugbodocAppointments.id, { onDelete: "set null" }),
  recordType: text("record_type").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocPharmacyMedications = pgTable("sugbodoc_pharmacy_medications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  genericName: text("generic_name").notNull().default(""),
  dosage: text("dosage").notNull().default(""),
  dosageForm: text("dosage_form").notNull().default(""),
  form: text("form").notNull().default(""),
  category: text("category").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  enabled: text("enabled").notNull().default("true"),
  partnerLocations: jsonb("partner_locations").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocPharmacyOrders = pgTable("sugbodoc_pharmacy_orders", {
  reference: text("reference").primaryKey(),
  patientId: text("patient_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  encounterId: text("encounter_id").references(() => sugbodocEncounters.id, { onDelete: "set null" }),
  billId: text("bill_id"),
  status: text("status").notNull().default("Pending"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  data: jsonb("data").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocPharmacyBills = pgTable("sugbodoc_pharmacy_bills", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  orderReference: text("order_reference").notNull().unique().references(() => sugbodocPharmacyOrders.reference, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("Pending"),
  billDate: timestamp("bill_date", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocPharmacyPayments = pgTable("sugbodoc_pharmacy_payments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  orderReference: text("order_reference").notNull().unique().references(() => sugbodocPharmacyOrders.reference, { onDelete: "cascade" }),
  billId: text("bill_id").notNull().references(() => sugbodocPharmacyBills.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("Paid"),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  reference: text("reference").notNull(),
  stripeSessionId: text("stripe_session_id").unique(),
  fulfillmentStatus: text("fulfillment_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocAdminSchedules = pgTable("sugbodoc_admin_schedules", {
  id: text("id").primaryKey(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  specialty: text("specialty").notNull(),
  clinic: text("clinic").notNull(),
  day: text("day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  slots: integer("slots").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocAuditEvents = pgTable("sugbodoc_audit_events", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocMessageConversations = pgTable("sugbodoc_message_conversations", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().unique().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugbodocMessages = pgTable("sugbodoc_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => sugbodocMessageConversations.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => sugbodocUsers.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
