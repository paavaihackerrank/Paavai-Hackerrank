import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, MailCheck } from 'lucide-react';
import { ACADEMIC_YEARS, DEPARTMENTS, getDashboardPath } from '../config/rbacAndData';
import {
  isCollegeEmailId,
  isInstitutionalEmail,
  isPersonalEmail,
  isValidAccountEmail,
  isValidOptionalImageUrl,
  isValidPhoneNumber,
  useApp,
} from '../context/AppContext';
import { DRIVE_SHARING_HINT, validateDriveOrHttpsUrl } from '../lib/driveUtils';
import { MemberAvatar } from '../components/MemberAvatar';
import { NotificationBanner } from '../components/NotificationBanner';
import { ForgotPassword } from '../components/ForgotPassword';
import { PageSeo } from '../components/PageSeo';

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
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '';
  const resetCompleted = searchParams.get('reset') === 'success';
  const safeRedirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser && currentRole !== 'outsider') {
      navigate(safeRedirect || getDashboardPath(currentRole), { replace: true });
    }
  }, [currentUser, currentRole, navigate, safeRedirect]);

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
    navigate(safeRedirect || res.redirectPath || '/dashboard/member', { replace: true });
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-14 space-y-5">
      <PageSeo
        title={resetMode ? 'Account Recovery' : 'Sign In'}
        description="Sign in to your HackerRank Campus Crew – Paavai Engineering College student account."
        noIndex
      />
      {needsEmailVerification && unverifiedEmail ? (
        <NotificationBanner
          user={firebaseUser}
          onVerified={(path) => navigate(safeRedirect || path, { replace: true })}
        />
      ) : !resetMode ? (
        <div
          role="note"
          className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3"
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
      ) : null}

      {resetCompleted && !resetMode && (
        <div
          role="status"
          className="p-4 rounded-xl border border-[#00EA64]/40 bg-[#00EA64]/10 flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 text-xs leading-relaxed">
            <p className="font-mono font-semibold text-[#009942] dark:text-[#00EA64]">
              Password Updated
            </p>
            <p className="text-slate-700 dark:text-slate-300">
              Your password reset is complete. Sign in below using your personal email and new
              password.
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
            {resetMode ? 'Account Recovery' : 'Sign in to HRCC Paavai'}
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
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-3 pr-10 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-r-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
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
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '';
  const safeRedirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '';
  const joinReqId = (searchParams.get('joinReqId') || '').trim();
  const initialDeptParam = (searchParams.get('dept') || '').trim();
  const initialYearParam = (searchParams.get('year') || '').trim();

  const [form, setForm] = useState({
    name: (searchParams.get('name') || '').trim(),
    email: (searchParams.get('email') || '').trim(),
    collegeEmail: (searchParams.get('collegeEmail') || '').trim(),
    password: '',
    confirmPassword: '',
    regNo: (searchParams.get('regNo') || '').trim(),
    department: DEPARTMENTS.includes(initialDeptParam) ? initialDeptParam : DEPARTMENTS[0],
    year: ACADEMIC_YEARS.includes(initialYearParam) ? initialYearParam : ACADEMIC_YEARS[0],
    phone: (searchParams.get('phone') || '').trim(),
    hackerRankHandle: '',
    photoUrl: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const photoValidation = useMemo(
    () => validateDriveOrHttpsUrl(form.photoUrl, { allowEmpty: true }),
    [form.photoUrl]
  );

  useEffect(() => {
    if (currentUser && currentRole !== 'outsider') {
      navigate(safeRedirect || getDashboardPath(currentRole), { replace: true });
    }
  }, [currentUser, currentRole, navigate, safeRedirect]);

  if (needsEmailVerification && unverifiedEmail) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 space-y-6">
        <NotificationBanner
          user={firebaseUser}
          onVerified={(path) => navigate(safeRedirect || path, { replace: true })}
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
    if (!isValidOptionalImageUrl(form.photoUrl) || !photoValidation.valid) {
      setError(
        photoValidation.error ||
          'Profile image link must be a valid Google Drive share link or https:// URL (max 500 characters).'
      );
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
      photoUrl: form.photoUrl,
      joinReqId: joinReqId || undefined,
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
      <PageSeo
        title="Create Student Member Account"
        description="Register with HackerRank Campus Crew at Paavai Engineering College for DSA tracks, coding contests, and member dashboard access."
        noIndex
      />
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

        {joinReqId && (
          <div className="p-3 rounded-lg text-xs font-mono bg-[#00EA64]/10 border border-[#00EA64]/35 text-[#009942] dark:text-[#00EA64] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Pre-filled from your Join Request. Once you verify your personal email, your inquiry
              will automatically be marked approved.
            </span>
          </div>
        )}

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

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label htmlFor="su-photo" className="block text-xs font-mono text-slate-600 dark:text-slate-300">
                Profile Image Link — Google Drive or Direct URL (optional)
              </label>
              {form.photoUrl.trim() && photoValidation.valid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  <span>{photoValidation.isDrive ? 'Drive Link Ready' : 'Image URL Ready'}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <MemberAvatar
                name={form.name || 'Member'}
                photoUrl={form.photoUrl}
                variant="member"
                sizeClass="w-10 h-10"
                roundedClass="rounded-lg"
                textClass="text-xs"
              />
              <input
                id="su-photo"
                type="url"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/.../view"
                className="flex-1 h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {form.photoUrl.trim()
                ? photoValidation.valid
                  ? photoValidation.hint
                  : photoValidation.error
                : `Paste a Google Drive share link or https:// URL. ${DRIVE_SHARING_HINT}.`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="su-pw" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  id="su-pw"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-10 pl-3 pr-10 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-r-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="su-pw2" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  id="su-pw2"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full h-10 pl-3 pr-10 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-r-lg"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
          >
            {submitting
              ? 'Creating Account & Sending Verification...'
              : 'Sign Up with Personal Email'}
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
