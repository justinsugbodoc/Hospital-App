import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth, STORAGE_KEYS } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff, ArrowLeft, Stethoscope, UserRound, Shield, Sparkles } from 'lucide-react';
import Logo from '@/components/brand/logo';
import { serverLogin } from '@/lib/server';

type LoginMode = 'standard' | 'doctor';

const MOCK_DOCTOR_PRESETS = [
  {
    name: 'Dr. Jose Reyes',
    specialty: 'Cardiology',
    username: 'jose.reyes',
    email: 'doctor@sugbodoc.test',
    password: 'doctor123',
    clinic: 'Chong Hua Hospital',
  },
  {
    name: 'Dr. Maria Santos',
    specialty: 'Internal Medicine',
    username: 'maria.santos',
    email: 'maria.santos@sugbodoc.test',
    password: 'doctor123',
    clinic: "Cebu Doctors' University Hospital",
  },
  {
    name: 'Dr. Ana Villanueva',
    specialty: 'OB-GYN',
    username: 'ana.villanueva',
    email: 'ana.villanueva@sugbodoc.test',
    password: 'doctor123',
    clinic: 'Perpetual Succour Hospital',
  },
];

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('standard');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const result = await serverLogin(identifier.trim(), password);
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(result.user));
      login(result.token);
      setLocation(
        result.user.role === 'Admin' || result.user.role === 'Clinician'
          ? '/admin'
          : result.user.role === 'Doctor'
          ? '/doctor'
          : '/dashboard',
      );
      return;
    } catch (error) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Unable to sign in right now.');
    }
  };

  const fillPreset = (u: string, p: string, m: LoginMode = 'doctor') => {
    setMode(m);
    setIdentifier(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10 mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group px-1 py-1"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
          Back to Landing Page
        </Link>
      </div>

      <div className="w-full max-w-[440px] bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-border p-6 sm:p-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6">
          <Logo className="justify-center" />
          <p className="text-sm text-muted-foreground mt-2">Lifelong digital health records & clinical care</p>
        </div>

        {/* Login Role Toggle */}
        <div className="mb-6 flex rounded-xl bg-muted/70 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('standard');
              if (identifier === 'jose.reyes' || identifier === 'maria.santos' || identifier === 'ana.villanueva') {
                setIdentifier('');
                setPassword('');
              }
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition ${
              mode === 'standard'
                ? 'bg-background shadow-xs text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserRound className="h-4 w-4" />
            Patient / Admin
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('doctor');
              if (!identifier) {
                setIdentifier('jose.reyes');
                setPassword('doctor123');
              }
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition ${
              mode === 'doctor'
                ? 'bg-background shadow-xs text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Stethoscope className="h-4 w-4 text-primary" />
            Doctor Login
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="identifier">
              {mode === 'doctor' ? 'Doctor Username or Email' : 'Email Address'}
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError('');
              }}
              placeholder={
                mode === 'doctor'
                  ? 'e.g. jose.reyes or doctor@sugbodoc.test'
                  : 'juan@example.com or admin@sugbodoc.test'
              }
              autoComplete="username"
              className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <a href="#" className="text-xs text-primary font-medium hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-11 px-3 pr-10 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-semibold text-sm transition-all hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'doctor' ? 'Sign in to Doctor Portal' : 'Sign In'}
          </button>
        </form>

        {/* Quick-fill Mock Doctor Accounts */}
        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Mock Doctor Demo Accounts
            </p>
            <span className="text-[10px] text-muted-foreground">Click to fill</span>
          </div>

          <div className="grid gap-2">
            {MOCK_DOCTOR_PRESETS.map((doc) => (
              <button
                key={doc.username}
                type="button"
                onClick={() => fillPreset(doc.username, doc.password, 'doctor')}
                className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 hover:bg-primary/5 hover:border-primary/40 p-2.5 text-left transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Stethoscope className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">{doc.name}</span>
                    <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 px-1.5 py-0.2 text-[9px] font-semibold">
                      {doc.specialty}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Username: <span className="font-semibold text-foreground">{doc.username}</span> · PW: <span className="font-mono">{doc.password}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Quick test patient & admin buttons */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => fillPreset('juan@example.com', 'password123', 'standard')}
              className="flex-1 rounded-lg border border-border bg-background p-2 text-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            >
              Patient Demo: <strong className="text-foreground">Juan</strong>
            </button>
            <button
              type="button"
              onClick={() => fillPreset('admin@sugbodoc.test', 'admin123', 'standard')}
              className="flex-1 rounded-lg border border-border bg-background p-2 text-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            >
              Admin Demo: <strong className="text-foreground">admin@sugbodoc.test</strong>
            </button>
          </div>
        </div>

        <div className="mt-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Register as Patient
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

