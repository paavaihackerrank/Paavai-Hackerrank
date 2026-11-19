import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck, RefreshCw } from 'lucide-react';
import { ACADEMIC_YEARS, DEPARTMENTS, getDashboardPath } from '../config/rbacAndData';
import { isAllowedCollegeEmail, useApp } from '../context/AppContext';

const VerificationNoticeCard: React.FC<{
  email: string;
  onVerified: (redirectPath: string) => void;
}> = ({ email, onVerified }) => {
  const { resendVerificationEmail, refreshEmailVerification, logout } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleCheckVerified = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await refreshEmailVerification();
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Email is not verified yet.');
      return;
    }
    onVerified(res.redirectPath || '/dashboard/member');
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await resendVerificationEmail();
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Could not resend email.');
      return;
    }
    setMessage('A fresh verification link has been sent to your @paavai.edu.in inbox.');
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16">
      <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5">
        <div className="w-11 h-11 rounded-lg bg-[#00EA64]/10 border border-[#00EA64]/30 flex items-center justify-center text-[#009942] dark:text-[#00EA64]">
          <MailCheck className="w-5 h-5" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Step 2 of 2 · Email Verification
          </p>
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            Verify Your Paavai Email
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We sent a verification link to <strong className="font-mono">{email}</strong>. Click the
            link in your inbox, then continue straight to your member dashboard.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {message && (
          <div className="p-3 rounded-lg text-xs font-medium bg-[#00EA64]/10 border border-[#00EA64]/30 text-[#009942] dark:text-[#00EA64]">
            {message}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={handleCheckVerified}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            <span>{busy ? 'Checking...' : "I've Verified My Email — Continue"}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleResend}
            className="w-full py-2.5 px-4 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors disabled:opacity-60"
          >
            Resend Verification Email
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={logout}
            className="w-full py-2 text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const {
    currentUser,
    currentRole,
    needsEmailVerification,
    unverifiedEmail,
    login,
    loginWithGoogle,
    switchDemoRole,
  } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser && currentRole !== 'outsider') {
      navigate(getDashboardPath(currentRole), { replace: true });
    }
  }, [currentUser, currentRole, navigate]);

  if (needsEmailVerification && unverifiedEmail) {
    return (
      <VerificationNoticeCard
        email={unverifiedEmail}
        onVerified={(path) => navigate(path, { replace: true })}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter both email and password.');
      return;
    }
    if (!isAllowedCollegeEmail(email)) {
      setError('Sign in requires an official @paavai.edu.in email address.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Login failed.');
      return;
    }
    if (res.needsVerification) {
      return;
    }
    navigate(res.redirectPath || '/dashboard/member', { replace: true });
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError('');
    const res = await loginWithGoogle();
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Google sign-in failed.');
      return;
    }
    if (res.needsVerification) {
      return;
    }
    navigate(res.redirectPath || '/dashboard/member', { replace: true });
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16">
      <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Firebase Authentication · Paavai Chapter
          </p>
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            Sign in to HRCC Paavai
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with your verified <strong>@paavai.edu.in</strong> college email to open your
            dashboard immediately.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignIn}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <span>Continue with Google (@paavai.edu.in)</span>
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="shrink mx-3 text-[11px] font-mono text-slate-400">
            or email & password
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Paavai College Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@paavai.edu.in"
              className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-[#00EA64] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in with Email'}
          </button>
        </form>

        {/* Demo Preview Quick-Switch */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Instant role preview (local demo mode):
          </p>
          <div className="grid grid-cols-1 gap-2">
            {(
              [
                ['lead', 'Preview as Campus Lead'],
                ['crew', 'Preview as Campus Crew Member'],
                ['member', 'Preview as Student Community Member'],
              ] as const
            ).map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  switchDemoRole(role);
                  navigate(getDashboardPath(role));
                }}
                className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium border border-slate-200 dark:border-slate-800 hover:border-[#00EA64] text-slate-700 dark:text-slate-200 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-center text-slate-500 dark:text-slate-400">
          New to Paavai HackerRank Crew?{' '}
          <Link to="/signup" className="text-[#009942] dark:text-[#00EA64] font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export const SignUpPage: React.FC = () => {
  const {
    currentUser,
    currentRole,
    needsEmailVerification,
    unverifiedEmail,
    signup,
    loginWithGoogle,
  } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    regNo: '',
    department: DEPARTMENTS[0],
    year: ACADEMIC_YEARS[0],
    phone: '',
    hackerRankHandle: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser && currentRole !== 'outsider') {
      navigate(getDashboardPath(currentRole), { replace: true });
    }
  }, [currentUser, currentRole, navigate]);

  if (needsEmailVerification && unverifiedEmail) {
    return (
      <VerificationNoticeCard
        email={unverifiedEmail}
        onVerified={(path) => navigate(path, { replace: true })}
      />
    );
  }

  const handleGoogleSignUp = async () => {
    setSubmitting(true);
    setError('');
    const res = await loginWithGoogle();
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Google sign-in failed.');
      return;
    }
    if (res.needsVerification) {
      return;
    }
    navigate(res.redirectPath || '/dashboard/member', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!isAllowedCollegeEmail(form.email)) {
      setError('Please sign up using your official @paavai.edu.in email address.');
      return;
    }
    if (!/^[A-Za-z0-9\-]{4,20}$/.test(form.regNo.trim())) {
      setError('Enter a valid Paavai register number (4–20 alphanumeric characters).');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError('');
    const res = await signup({
      name: form.name,
      email: form.email,
      password: form.password,
      regNo: form.regNo,
      department: form.department,
      year: form.year,
      phone: form.phone,
      hackerRankHandle: form.hackerRankHandle,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not create account.');
      return;
    }
    if (!res.needsVerification) {
      navigate(res.redirectPath || '/dashboard/member', { replace: true });
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-14">
      <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Student Registration · Instant Access After Email Verification
          </p>
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            Create Student Member Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verify your <strong>@paavai.edu.in</strong> email to receive immediate{' '}
            <strong>Student Community Member</strong> access by default—no manual approval
            required.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignUp}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
        >
          Continue with Google (@paavai.edu.in)
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="shrink mx-3 text-[11px] font-mono text-slate-400">
            or register with @paavai.edu.in email
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-name" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                id="su-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label htmlFor="su-reg" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Register Number *
              </label>
              <input
                id="su-reg"
                type="text"
                value={form.regNo}
                onChange={(e) => setForm({ ...form, regNo: e.target.value })}
                placeholder="622126104015"
                className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-dept" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                id="su-dept"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="su-year" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Year
              </label>
              <select
                id="su-year"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-email" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Paavai College Email *
              </label>
              <input
                id="su-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@paavai.edu.in"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label htmlFor="su-phone" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                id="su-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="su-handle" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
              HackerRank Handle (optional)
            </label>
            <input
              id="su-handle"
              type="text"
              value={form.hackerRankHandle}
              onChange={(e) => setForm({ ...form, hackerRankHandle: e.target.value })}
              placeholder="@your_handle"
              className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-pw" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Password *
              </label>
              <input
                id="su-pw"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label htmlFor="su-pw2" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Confirm Password *
              </label>
              <input
                id="su-pw2"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-[#00EA64] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Creating Account...' : 'Sign Up with @paavai.edu.in Email'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-[#009942] dark:text-[#00EA64] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
