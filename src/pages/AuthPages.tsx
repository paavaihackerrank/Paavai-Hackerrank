import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { ACADEMIC_YEARS, DEPARTMENTS, getDashboardPath } from '../config/rbacAndData';
import {
  isCollegeEmailId,
  isInstitutionalEmail,
  isPersonalEmail,
  isValidAccountEmail,
  isValidPhoneNumber,
  useApp,
} from '../context/AppContext';
import { NotificationBanner } from '../components/NotificationBanner';
import { ForgotPassword } from '../components/ForgotPassword';

export const LoginPage: React.FC = () => {
  const {
    firebaseUser,
    currentUser,
    currentRole,
    needsEmailVerification,
    unverifiedEmail,
    login,
  } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser && currentRole !== 'outsider') {
      navigate(getDashboardPath(currentRole), { replace: true });
    }
  }, [currentUser, currentRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter both email and password.');
      return;
    }
    if (!isValidAccountEmail(email)) {
      setError('Enter a valid registered email address.');
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

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-14 space-y-5">
      {needsEmailVerification && unverifiedEmail ? (
        <NotificationBanner
          user={firebaseUser}
          onVerified={(path) => navigate(path, { replace: true })}
        />
      ) : (
        <div
          role="note"
          className="p-4 rounded-xl border border-amber-500/50 border-l-4 border-l-amber-500 bg-amber-500/10 flex items-start gap-3"
        >
          <MailCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-mono font-semibold text-amber-700 dark:text-amber-300">
              Email Verification Required to Activate Account
            </p>
            <p className="text-slate-700 dark:text-slate-300">
              Signed up recently? Check your <strong>registered personal email</strong> inbox
              (including Spam/Promotions) for a verification link to activate your account.
              Unverified accounts are automatically deleted after <strong>12 hours</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Firebase Authentication · Paavai Chapter
          </p>
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {resetMode ? 'Recover Account Access' : 'Sign in to HRCC Paavai'}
          </h1>
          {!resetMode && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sign in with your verified <strong>personal email</strong> and password to open your
              dashboard immediately.
            </p>
          )}
        </div>

        {!resetMode && error && (
          <div
            role="alert"
            className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed"
          >
            {error}
          </div>
        )}

        {resetMode ? (
          <ForgotPassword
            initialEmail={email}
            onBackToLogin={() => {
              setResetMode(false);
              setError('');
            }}
          />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Personal Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-mono text-slate-600 dark:text-slate-300"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setError('');
                  }}
                  className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
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
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign in with Personal Email'}
            </button>
          </form>
        )}

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
    firebaseUser,
    currentUser,
    currentRole,
    needsEmailVerification,
    unverifiedEmail,
    signup,
  } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    collegeEmail: '',
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
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 space-y-6">
        <NotificationBanner
          user={firebaseUser}
          onVerified={(path) => navigate(path, { replace: true })}
        />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!isValidAccountEmail(form.email)) {
      setError('Enter a valid personal email address (used for login and verification).');
      return;
    }
    if (isInstitutionalEmail(form.email) || !isPersonalEmail(form.email)) {
      setError(
        'Institutional emails (@paavai.edu.in / .edu.in) cannot be used as your login email. Please enter a personal email address (e.g. @gmail.com, @outlook.com).'
      );
      return;
    }
    if (!isCollegeEmailId(form.collegeEmail)) {
      setError('Enter your unique @paavai.edu.in college email ID.');
      return;
    }
    if (!/^[A-Za-z0-9\-]{4,20}$/.test(form.regNo.trim())) {
      setError('Enter a valid Paavai register number (4–20 alphanumeric characters).');
      return;
    }
    if (!isValidPhoneNumber(form.phone)) {
      setError('Enter a valid 10-digit unique phone number.');
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
      collegeEmail: form.collegeEmail,
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
            Register with your <strong>personal email &amp; password</strong>, plus your unique{' '}
            <strong>@paavai.edu.in college email ID</strong> and unique{' '}
            <strong>phone number</strong>. Verify your personal email to receive immediate{' '}
            <strong>Student Community Member</strong> access.
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
                Personal Email *
              </label>
              <input
                id="su-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@gmail.com"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Personal email only (not @paavai.edu.in) — used for login &amp; verification
              </p>
            </div>
            <div>
              <label htmlFor="su-phone" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Phone Number * (Unique)
              </label>
              <input
                id="su-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Must not match an existing member
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-college-email" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                College Email ID * (Unique)
              </label>
              <input
                id="su-college-email"
                type="email"
                value={form.collegeEmail}
                onChange={(e) => setForm({ ...form, collegeEmail: e.target.value })}
                placeholder="622126104015@paavai.edu.in"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Official @paavai.edu.in ID (1 per student)
              </p>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-pw" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Password *
              </label>
              <input
                id="su-pw"
                type="password"
                autoComplete="new-password"
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
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Creating Account...' : 'Sign Up with Personal Email'}
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
