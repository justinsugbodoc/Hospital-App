import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  CalendarCheck,
  FileHeart,
  Pill,
  Receipt,
  ShieldCheck,
  BellRing,
  UserPlus,
  Stethoscope,
  FolderLock,
  Lock,
  KeyRound,
  Eye,
  Hospital,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  PhoneCall,
  Menu,
  X,
  Activity,
  HeartPulse,
} from 'lucide-react';
import Logo from '@/components/brand/logo';
import { getCurrentSessionUser, useAuth } from '@/hooks/use-auth';

const features = [
  {
    icon: CalendarCheck,
    title: 'Appointments',
    description: 'Book, reschedule, and track consultations with doctors across partner hospitals with instant email confirmations.',
    badge: 'Real-time Booking',
  },
  {
    icon: FileHeart,
    title: 'Medical Records',
    description: 'Keep lab results, clinical diagnoses, doctor notes, and vital signs in one secure, lifelong chronological timeline.',
    badge: 'EHR Synchronized',
  },
  {
    icon: Pill,
    title: 'Pharmacy',
    description: 'Order prescribed medications directly from hospital pharmacies with real-time fulfillment and pickup tracking.',
    badge: 'Direct Prescriptions',
  },
  {
    icon: Receipt,
    title: 'Billing',
    description: 'View itemized invoices for consultations and prescriptions, and pay securely online with instant digital receipts.',
    badge: 'Online Payments',
  },
  {
    icon: ShieldCheck,
    title: 'Insurance',
    description: 'Store HMO and PhilHealth details to file digital insurance claims against completed hospital encounters without paperwork.',
    badge: 'HMO & PhilHealth',
  },
  {
    icon: BellRing,
    title: 'Notifications',
    description: 'Stay informed with automated alerts for upcoming visits, lab test releases, prescription refills, and payment updates.',
    badge: 'Instant Alerts',
  },
];

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Create Your Account',
    description: 'Register in minutes with basic patient details to activate your lifelong SugboDoc digital health portal.',
  },
  {
    number: '02',
    icon: Stethoscope,
    title: 'Connect & Consult',
    description: 'Book visits or visit partner hospitals where doctors document consultations, vitals, and prescriptions directly.',
  },
  {
    number: '03',
    icon: FolderLock,
    title: 'Access Lifelong Records',
    description: 'Instantly view your medical history, order pharmacy items, pay bills online, and track insurance claims anytime.',
  },
];

const partnerHospitals = [
  {
    name: 'Chong Hua Hospital',
    location: 'Fuente Osmeña & Mandaue City',
    type: 'Tertiary Medical Center',
    beds: '660+ Beds',
  },
  {
    name: "Cebu Doctors' University Hospital",
    location: 'Osmeña Blvd, Cebu City',
    type: 'Multi-Specialty Hospital',
    beds: '300+ Beds',
  },
  {
    name: 'Perpetual Succour Hospital',
    location: 'Gorordo Ave, Cebu City',
    type: 'Tertiary Care Hospital',
    beds: '250+ Beds',
  },
  {
    name: 'Vicente Sotto Memorial Medical Center',
    location: 'B. Rodriguez St, Cebu City',
    type: 'Government Medical Center',
    beds: '1,200+ Beds',
  },
  {
    name: 'Cebu City Medical Center',
    location: 'N. Bacalso Ave, Cebu City',
    type: 'Municipal General Hospital',
    beds: '300+ Beds',
  },
  {
    name: 'Visayas Community Medical Center',
    location: 'Osmeña Blvd, Cebu City',
    type: 'Community Health Hospital',
    beds: '180+ Beds',
  },
  {
    name: 'University of Cebu Medical Center (UCMed)',
    location: 'North Reclamation Area, Mandaue',
    type: 'Medical & Research Center',
    beds: '350+ Beds',
  },
  {
    name: 'Mandaue City Hospital',
    location: 'Centro, Mandaue City',
    type: 'District Care Hospital',
    beds: '100+ Beds',
  },
];

const securityPoints = [
  {
    icon: Lock,
    title: '256-Bit SSL Encryption',
    description: 'All patient communications and clinical data are encrypted in transit over secure TLS protocol.',
  },
  {
    icon: KeyRound,
    title: 'Role-Based Access Control',
    description: 'Strict authorization rules ensure patients, clinicians, and admins only access data permitted by their role.',
  },
  {
    icon: Eye,
    title: 'Immutable Audit Trail',
    description: 'Every clinical record access, prescription issue, and file view is recorded with date, time, and user ID.',
  },
  {
    icon: ShieldAlert,
    title: 'DPA 2012 & HIPAA Standard',
    description: 'Built following Philippine Data Privacy Act of 2012 requirements to guarantee complete patient data rights.',
  },
];

export default function Landing() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!token) return;
    const role = getCurrentSessionUser()?.role;
    if (role === 'Admin' || role === 'Clinician') setLocation('/admin');
    else if (role === 'Doctor') setLocation('/doctor');
    else setLocation('/dashboard');
  }, [token, setLocation]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-[#4A4FC4] selection:text-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main Navigation">
            <a href="#features" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#4A4FC4]">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#4A4FC4]">
              How it works
            </a>
            <a href="#hospitals" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#4A4FC4]">
              Partner Hospitals
            </a>
            <a href="#security" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#4A4FC4]">
              Security & Privacy
            </a>
          </nav>

          {/* Auth Action Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[#4A4FC4] transition-colors hover:bg-[#4A4FC4]/10"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A4FC4] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#4A4FC4]/25 transition-all hover:bg-[#3A3FA0] hover:shadow-lg active:scale-[0.98]"
            >
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-xl p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white px-4 pt-3 pb-6 md:hidden">
            <nav className="flex flex-col gap-3">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                How it works
              </a>
              <a
                href="#hospitals"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                Partner Hospitals
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                Security & Privacy
              </a>
            </nav>
            <div className="mt-4 flex flex-col gap-2.5 pt-4 border-t border-slate-100">
              <Link
                href="/login"
                className="w-full text-center rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[#4A4FC4]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="w-full text-center rounded-xl bg-[#4A4FC4] py-2.5 text-sm font-semibold text-white shadow-md"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#E8E9FB]/50 via-white to-[#F8FAFC] py-16 lg:py-24">
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#4A4FC4]/10 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              {/* Left Column: Copy & Actions */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#4A4FC4]/20 bg-[#E8E9FB] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4A4FC4]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Unified Digital Health Platform for Cebu</span>
                </div>

                <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                  Your lifelong digital health record
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                  SugboDoc keeps your healthcare journey seamlessly connected in one secure platform — book{' '}
                  <strong className="font-semibold text-slate-900">appointments</strong> with top hospitals, maintain a complete{' '}
                  <strong className="font-semibold text-slate-900">medical record</strong> history, order from partner{' '}
                  <strong className="font-semibold text-slate-900">pharmacies</strong>, manage{' '}
                  <strong className="font-semibold text-slate-900">billing</strong> and online payments, file{' '}
                  <strong className="font-semibold text-slate-900">insurance</strong> claims effortlessly, and receive real-time{' '}
                  <strong className="font-semibold text-slate-900">notifications</strong> for all your care updates.
                </p>

                {/* Primary & Secondary CTA Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A4FC4] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-[#4A4FC4]/30 transition-all hover:bg-[#3A3FA0] hover:shadow-xl active:scale-[0.98]"
                  >
                    <span>Create Account</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-800 shadow-sm transition-all hover:border-[#4A4FC4] hover:bg-[#E8E9FB]/50 hover:text-[#4A4FC4]"
                  >
                    Login to Portal
                  </Link>
                </div>

                {/* Trust Badges / Stats */}
                <div className="mt-12 grid grid-cols-3 gap-6 pt-8 border-t border-slate-200/80">
                  <div>
                    <div className="text-2xl font-black text-[#4A4FC4] sm:text-3xl">8+</div>
                    <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-600">Partner Hospitals</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-[#4A4FC4] sm:text-3xl">100%</div>
                    <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-600">Paperless Records</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-[#4A4FC4] sm:text-3xl">24/7</div>
                    <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-600">Patient Access</div>
                  </div>
                </div>
              </div>

              {/* Right Column: High Quality Healthcare Image or Styled Illustration */}
              <div className="lg:col-span-5">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  {/* Decorative Backdrop Effect */}
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#4A4FC4] to-indigo-400 opacity-20 blur-xl" />

                  <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                    {!imageError ? (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100">
                        <img
                          src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80"
                          alt="Healthcare professional using digital health record system"
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                          onError={() => setImageError(true)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Integrated Clinical Care</p>
                          <p className="text-base font-bold">Connecting Patients & Hospitals in Real Time</p>
                        </div>
                      </div>
                    ) : (
                      /* Clean Illustration Fallback */
                      <div className="relative aspect-[4/3] w-full flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#E8E9FB] to-indigo-100 p-6 text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#4A4FC4] text-white shadow-lg shadow-[#4A4FC4]/30">
                          <HeartPulse className="h-10 w-10" />
                        </div>
                        <h3 className="mt-4 text-xl font-extrabold text-slate-900">SugboDoc Care Network</h3>
                        <p className="mt-2 text-xs text-slate-600">Digital EHR & Hospital Portal</p>
                      </div>
                    )}

                    {/* Overlay Floating Card 1: Hospital Verified */}
                    <div className="absolute top-6 left-6 flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur-md p-3.5 shadow-xl border border-slate-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Hospital Verified</p>
                        <p className="text-[11px] font-medium text-slate-500">Encounters & Vitals Synced</p>
                      </div>
                    </div>

                    {/* Overlay Floating Card 2: Interactive Health Card Preview */}
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-[#4A4FC4]" />
                          <span className="text-xs font-bold text-slate-900">Lifelong Timeline Preview</span>
                        </div>
                        <span className="rounded-full bg-[#E8E9FB] px-2.5 py-0.5 text-[10px] font-bold text-[#4A4FC4]">
                          Live EHR
                        </span>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center justify-between rounded-xl bg-white p-2.5 shadow-sm border border-slate-200/60">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8E9FB] text-[#4A4FC4]">
                              <CalendarCheck className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900">Cardiology Visit</p>
                              <p className="text-[10px] text-slate-500">Chong Hua Hospital</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Confirmed
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white p-2.5 shadow-sm border border-slate-200/60">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8E9FB] text-[#4A4FC4]">
                              <Pill className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900">E-Prescription Ready</p>
                              <p className="text-[10px] text-slate-500">Cebu Doctors' Pharmacy</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            Ready
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE CARDS SECTION */}
        <section id="features" className="py-20 bg-white border-y border-slate-200/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8E9FB] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#4A4FC4]">
                Complete Healthcare Ecosystem
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                All-in-One Digital Healthcare Modules
              </h2>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                Designed specifically for healthcare systems in Cebu, offering complete care continuity from admission to recovery.
              </p>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#4A4FC4]/40 hover:shadow-xl hover:shadow-[#4A4FC4]/10"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4A4FC4] text-white shadow-md shadow-[#4A4FC4]/25 transition-transform group-hover:scale-110">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 group-hover:bg-[#E8E9FB] group-hover:text-[#4A4FC4]">
                          {feature.badge}
                        </span>
                      </div>

                      <h3 className="mt-6 text-xl font-bold text-slate-900">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-[#4A4FC4] opacity-80 group-hover:opacity-100">
                      <span>Explore Module</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* HOW SUGBODOC WORKS (3 SIMPLE STEPS) */}
        <section id="how-it-works" className="py-20 bg-[#F8FAFC]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8E9FB] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#4A4FC4]">
                Simple & Seamless
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                How SugboDoc Works
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Get started in 3 simple steps to manage your family's health records effortlessly.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="relative flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8E9FB] text-[#4A4FC4]">
                        <Icon className="h-7 w-7" />
                      </span>
                      <span className="text-4xl font-black text-[#4A4FC4]/20">{step.number}</span>
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-slate-900">{step.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PARTNER HOSPITALS SECTION */}
        <section id="hospitals" className="py-20 bg-white border-t border-slate-200/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8E9FB] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#4A4FC4]">
                  Cebu Hospital Network
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  Partner Hospitals & Medical Centers
                </h2>
                <p className="mt-3 text-base text-slate-600 max-w-2xl">
                  Connecting top healthcare institutions across Metro Cebu and the Visayas region for unified medical access.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
                <Hospital className="h-4 w-4 text-[#4A4FC4]" />
                <span>8 Integrated Facilities</span>
              </div>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {partnerHospitals.map((hospital) => (
                <div
                  key={hospital.name}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-all duration-200 hover:border-[#4A4FC4] hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8E9FB] text-[#4A4FC4] group-hover:bg-[#4A4FC4] group-hover:text-white transition-colors">
                      <Hospital className="h-5 w-5" />
                    </span>
                    <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {hospital.beds}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-[#4A4FC4] transition-colors">
                    {hospital.name}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">{hospital.location}</p>
                  <p className="mt-2 text-[11px] font-semibold text-[#4A4FC4]">{hospital.type}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECURITY AND PRIVACY SECTION */}
        <section id="security" className="py-20 bg-slate-900 text-white relative overflow-hidden">
          <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-[#4A4FC4]/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300 backdrop-blur-md">
                <Lock className="h-3.5 w-3.5" />
                <span>Enterprise Security & Compliance</span>
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                Built to Protect Your Sensitive Medical History
              </h2>
              <p className="mt-4 text-base text-slate-300 sm:text-lg leading-relaxed">
                SugboDoc enforces strict data governance and privacy policies so you have full peace of mind regarding your health records.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {securityPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <div
                    key={point.title}
                    className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 backdrop-blur-sm transition-all hover:border-[#4A4FC4]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4A4FC4] text-white shadow-lg">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-base font-bold text-white">{point.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{point.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CALL TO ACTION BANNER */}
        <section className="py-16 bg-[#F8FAFC]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#4A4FC4] to-[#3A3FA0] p-8 sm:p-12 text-white shadow-2xl">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="max-w-2xl">
                  <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    Ready to take control of your health record?
                  </h2>
                  <p className="mt-3 text-base text-indigo-100">
                    Open your account today to connect with partner clinics and keep your family's medical history in one place.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-[#4A4FC4] shadow-lg transition-all hover:bg-indigo-50 active:scale-[0.98]"
                  >
                    <span>Create Account</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-base font-bold text-white backdrop-blur-md transition-all hover:bg-white/20"
                  >
                    Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* MODERN FOOTER */}
      <footer className="border-t border-slate-200 bg-white pt-16 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-12 pb-12 border-b border-slate-100">
            {/* Brand Info */}
            <div className="md:col-span-5">
              <Logo />
              <p className="mt-4 max-w-sm text-sm text-slate-600 leading-relaxed">
                SugboDoc is Cebu's unified digital health record platform, connecting patients, clinicians, pharmacies, and hospitals.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <PhoneCall className="h-4 w-4 text-[#4A4FC4]" />
                <span>Support: support@sugbodoc.ph</span>
              </div>
            </div>

            {/* Links Columns */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Platform</h4>
                <ul className="mt-4 space-y-2.5 text-sm font-medium text-slate-600">
                  <li>
                    <a href="#features" className="hover:text-[#4A4FC4] transition-colors">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="hover:text-[#4A4FC4] transition-colors">
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#hospitals" className="hover:text-[#4A4FC4] transition-colors">
                      Partner Hospitals
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Legal & Security</h4>
                <ul className="mt-4 space-y-2.5 text-sm font-medium text-slate-600">
                  <li>
                    <a href="#security" className="hover:text-[#4A4FC4] transition-colors">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#security" className="hover:text-[#4A4FC4] transition-colors">
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#security" className="hover:text-[#4A4FC4] transition-colors">
                      Security Overview
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Account</h4>
                <ul className="mt-4 space-y-2.5 text-sm font-medium text-slate-600">
                  <li>
                    <Link href="/login" className="hover:text-[#4A4FC4] transition-colors">
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="hover:text-[#4A4FC4] transition-colors">
                      Create Account
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
            <p>© {new Date().getFullYear()} SugboDoc. All rights reserved. Registered Digital Health Service.</p>
            <p>Made with care for Cebu and the Philippines.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

