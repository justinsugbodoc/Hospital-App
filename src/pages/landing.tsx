import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  CalendarCheck,
  FileHeart,
  Pill,
  Receipt,
  ShieldCheck,
  BellRing,
  UserPlus,
  CalendarPlus,
  Stethoscope,
  FolderLock,
  Lock,
  KeyRound,
  Eye,
  Building2,
} from 'lucide-react';
import Logo from '@/components/brand/logo';
import { getCurrentSessionUser, useAuth } from '@/hooks/use-auth';

const features = [
  {
    icon: CalendarCheck,
    title: 'Appointments',
    description: 'Book, reschedule, and track visits with partner clinics, with email confirmation for every booking.',
  },
  {
    icon: FileHeart,
    title: 'Medical Records',
    description: 'Consultations, diagnoses, lab results, and vitals kept in one lifelong, chronological health record.',
  },
  {
    icon: Pill,
    title: 'Pharmacy',
    description: 'Order prescribed medicines, follow order status, and keep an accurate list of what you are taking.',
  },
  {
    icon: Receipt,
    title: 'Billing',
    description: 'See consultation and pharmacy charges, pay securely online, and download receipts any time.',
  },
  {
    icon: ShieldCheck,
    title: 'Insurance',
    description: 'Store your HMO or PhilHealth details and file claims against completed encounters without paperwork.',
  },
  {
    icon: BellRing,
    title: 'Notifications',
    description: 'Appointment reminders, prescription updates, and billing alerts delivered straight to your inbox.',
  },
];

const steps = [
  {
    icon: UserPlus,
    title: 'Create your account',
    description: 'Register once with your basic details to open your lifelong SugboDoc health record.',
  },
  {
    icon: CalendarPlus,
    title: 'Book a visit',
    description: 'Choose a clinic, doctor, and schedule. You get an instant confirmation by email.',
  },
  {
    icon: Stethoscope,
    title: 'Get care',
    description: 'Your doctor documents the encounter, prescriptions, and follow-up plan during the visit.',
  },
  {
    icon: FolderLock,
    title: 'Keep everything',
    description: 'Records, bills, medicines, and claims stay in your account, ready for your next consultation.',
  },
];

const services = [
  'General Consultation',
  'Pediatrics',
  'Internal Medicine',
  'Cardiology',
  'OB-GYNE',
  'Dermatology',
  'Laboratory & Diagnostics',
  'Dental Care',
  'Prenatal Care',
  'Vaccination',
  'Physical Therapy',
  'Telemedicine Follow-ups',
];

const clinics = [
  { name: 'Cebu City Medical Clinic', location: 'Cebu City' },
  { name: 'Mandaue Family Health Center', location: 'Mandaue' },
  { name: 'Lapu-Lapu Diagnostic Center', location: 'Lapu-Lapu' },
  { name: 'Talisay Community Clinic', location: 'Talisay' },
  { name: 'Consolacion Wellness Hub', location: 'Consolacion' },
  { name: 'Minglanilla Care Center', location: 'Minglanilla' },
];

const privacyPoints = [
  {
    icon: Lock,
    title: 'Encrypted in transit',
    description: 'Every request between your device and SugboDoc travels over HTTPS with modern encryption.',
  },
  {
    icon: KeyRound,
    title: 'Role-based access',
    description: 'Patients, doctors, and administrators only ever see the records their role permits.',
  },
  {
    icon: Eye,
    title: 'Audit trail',
    description: 'Clinical and administrative actions are logged, so access to your record is accountable.',
  },
];

export default function Landing() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) return;
    const role = getCurrentSessionUser()?.role;
    if (role === 'Admin' || role === 'Clinician') setLocation('/admin');
    else if (role === 'Doctor') setLocation('/doctor');
    else setLocation('/dashboard');
  }, [token, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">How it works</a>
            <a href="#services" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Services</a>
            <a href="#security" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-accent"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Create Account
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/70 via-background to-background" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <HeartDot /> Digital health records for Cebu
                </span>
                <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Your lifelong digital health record
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  SugboDoc keeps your care in one place — book <strong className="font-semibold text-foreground">appointments</strong> with
                  partner clinics, keep every <strong className="font-semibold text-foreground">medical record</strong> in one timeline,
                  settle <strong className="font-semibold text-foreground">billing</strong> online, order from the{' '}
                  <strong className="font-semibold text-foreground">pharmacy</strong>, and file{' '}
                  <strong className="font-semibold text-foreground">insurance</strong> claims without the paperwork.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link
                    href="/register"
                    className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    Login
                  </Link>
                </div>
                <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
                  {[
                    { value: '6', label: 'Care modules' },
                    { value: '12+', label: 'Services covered' },
                    { value: '24/7', label: 'Record access' },
                  ].map(stat => (
                    <div key={stat.label}>
                      <dt className="text-2xl font-bold text-primary">{stat.value}</dt>
                      <dd className="mt-1 text-xs font-medium text-muted-foreground">{stat.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="relative">
                <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-primary/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Your health summary</p>
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
                      Preview
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      { icon: CalendarCheck, title: 'Next appointment', detail: 'Cardiology · Cebu City Medical Clinic' },
                      { icon: FileHeart, title: 'Latest record', detail: 'Consultation notes and lab results' },
                      { icon: Pill, title: 'Active prescription', detail: 'Ready for pharmacy pickup' },
                      { icon: Receipt, title: 'Outstanding balance', detail: 'Pay securely from your dashboard' },
                    ].map(item => (
                      <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                          <item.icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border/70 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Everything your care needs</h2>
              <p className="mt-4 text-base text-muted-foreground">
                One portal for patients, doctors, and clinic staff — from the first booking to the final claim.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(feature => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm">
                    <feature.icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="bg-accent/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How SugboDoc works</h2>
              <p className="mt-4 text-base text-muted-foreground">Four simple steps from sign-up to a complete health history.</p>
            </div>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <step.icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className="text-2xl font-bold text-primary/25">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Services + clinics */}
        <section id="services" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-14 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Supported healthcare services</h2>
                <p className="mt-4 text-base text-muted-foreground">
                  Book any of these services through a SugboDoc partner clinic, with records filed automatically after the visit.
                </p>
                <ul className="mt-8 flex flex-wrap gap-2.5">
                  {services.map(service => (
                    <li
                      key={service}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
                    >
                      {service}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Partner clinics</h2>
                <p className="mt-4 text-base text-muted-foreground">
                  Placeholder listings for the clinic network. Each clinic manages its own schedules inside SugboDoc.
                </p>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {clinics.map(clinic => (
                    <li key={clinic.name} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{clinic.name}</p>
                        <p className="text-xs text-muted-foreground">{clinic.location}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="border-t border-border/70 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl border border-border bg-gradient-to-br from-primary to-secondary p-8 text-primary-foreground sm:p-12">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Security and privacy</h2>
                <p className="mt-4 text-base leading-relaxed opacity-90">
                  Your health record is sensitive. SugboDoc is built so only you and the clinicians involved in your care can reach it.
                </p>
              </div>
              <div className="mt-10 grid gap-5 sm:grid-cols-3">
                {privacyPoints.map(point => (
                  <div key={point.title} className="rounded-2xl bg-primary-foreground/10 p-6 backdrop-blur">
                    <point.icon className="h-6 w-6" strokeWidth={2.2} />
                    <h3 className="mt-4 text-base font-bold">{point.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed opacity-90">{point.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card p-8 sm:flex-row sm:items-center sm:p-10">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Start your health record today</h2>
                <p className="mt-2 text-sm text-muted-foreground">It takes a minute to register — your record stays with you for life.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Create Account
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-accent/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-3 text-sm text-muted-foreground">
                A lifelong digital health record for patients and clinics in Cebu, Philippines.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
              <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">About</a>
              <a href="mailto:support@sugbodoc.ph" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Contact</a>
              <a href="#security" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Privacy</a>
              <a href="#security" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Terms</a>
            </nav>
          </div>
          <p className="mt-10 text-xs text-muted-foreground">
            © {new Date().getFullYear()} SugboDoc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeartDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />;
}
