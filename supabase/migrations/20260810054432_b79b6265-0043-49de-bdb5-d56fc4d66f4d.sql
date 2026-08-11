CREATE TABLE public.sugbodoc_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  initials text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  phone text NOT NULL DEFAULT '',
  birthday text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  blood_type text NOT NULL DEFAULT '',
  emergency_contact jsonb,
  role text NOT NULL DEFAULT 'Patient',
  provider_id text,
  specialty text NOT NULL DEFAULT '',
  clinic text NOT NULL DEFAULT '',
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Active',
  clinical_editing_permission text NOT NULL DEFAULT 'false',
  insurance_data jsonb,
  claims_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_users TO service_role;
ALTER TABLE public.sugbodoc_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_sessions TO service_role;
ALTER TABLE public.sugbodoc_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_appointments (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  date text NOT NULL,
  time text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_appointments TO service_role;
ALTER TABLE public.sugbodoc_appointments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_encounters (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  appointment_id text REFERENCES public.sugbodoc_appointments(id) ON DELETE SET NULL,
  reference text NOT NULL UNIQUE,
  encounter_date text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_encounters TO service_role;
ALTER TABLE public.sugbodoc_encounters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_clinical_records (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  encounter_id text NOT NULL REFERENCES public.sugbodoc_encounters(id) ON DELETE CASCADE,
  appointment_id text REFERENCES public.sugbodoc_appointments(id) ON DELETE SET NULL,
  record_type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_clinical_records TO service_role;
ALTER TABLE public.sugbodoc_clinical_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_pharmacy_medications (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  generic_name text NOT NULL DEFAULT '',
  dosage text NOT NULL DEFAULT '',
  dosage_form text NOT NULL DEFAULT '',
  form text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  enabled text NOT NULL DEFAULT 'true',
  partner_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_pharmacy_medications TO service_role;
ALTER TABLE public.sugbodoc_pharmacy_medications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_pharmacy_orders (
  reference text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  encounter_id text REFERENCES public.sugbodoc_encounters(id) ON DELETE SET NULL,
  bill_id text,
  status text NOT NULL DEFAULT 'Pending',
  payment_status text NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_pharmacy_orders TO service_role;
ALTER TABLE public.sugbodoc_pharmacy_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_pharmacy_bills (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  order_reference text NOT NULL REFERENCES public.sugbodoc_pharmacy_orders(reference) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  bill_date timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sugbodoc_pharmacy_bills_order_reference_idx ON public.sugbodoc_pharmacy_bills(order_reference);
GRANT ALL ON public.sugbodoc_pharmacy_bills TO service_role;
ALTER TABLE public.sugbodoc_pharmacy_bills ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_pharmacy_payments (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  order_reference text NOT NULL REFERENCES public.sugbodoc_pharmacy_orders(reference) ON DELETE CASCADE,
  bill_id text NOT NULL REFERENCES public.sugbodoc_pharmacy_bills(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Paid',
  payment_date timestamptz NOT NULL DEFAULT now(),
  reference text NOT NULL,
  stripe_session_id text,
  fulfillment_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sugbodoc_pharmacy_payments_order_reference_idx ON public.sugbodoc_pharmacy_payments(order_reference);
CREATE UNIQUE INDEX sugbodoc_pharmacy_payments_stripe_session_idx ON public.sugbodoc_pharmacy_payments(stripe_session_id);
GRANT ALL ON public.sugbodoc_pharmacy_payments TO service_role;
ALTER TABLE public.sugbodoc_pharmacy_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_admin_schedules (
  id text PRIMARY KEY,
  doctor_id text NOT NULL,
  doctor_name text NOT NULL,
  specialty text NOT NULL,
  clinic text NOT NULL,
  day text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  slots integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_admin_schedules TO service_role;
ALTER TABLE public.sugbodoc_admin_schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_audit_events (
  id text PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_audit_events TO service_role;
ALTER TABLE public.sugbodoc_audit_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_message_conversations (
  id text PRIMARY KEY,
  patient_id text NOT NULL UNIQUE REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_message_conversations TO service_role;
ALTER TABLE public.sugbodoc_message_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sugbodoc_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public.sugbodoc_message_conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES public.sugbodoc_users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sugbodoc_messages TO service_role;
ALTER TABLE public.sugbodoc_messages ENABLE ROW LEVEL SECURITY;