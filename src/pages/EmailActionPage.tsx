import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MailCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageSeo } from '../components/PageSeo';

type ActionPhase = 'checking' | 'reset_form' | 'success' | 'error';

/**
 * Custom Firebase Auth Action Handler (`/auth/action`).
 * Supports Firebase Email Templates when Custom Action URL is configured to
 * `https://<domain>/auth/action` for `mode=resetPassword` and `mode=verifyEmail`.
 */
export const EmailActionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    verifyActionCode,
    verifyPasswordResetActionCode,
    confirmPasswordResetAction,
    addToast,
  } = useApp();

  const mode = searchParams.get('mode') || '';
  const oobCode = searchParams.get('oobCode') || '';

  const [phase, setPhase] = useState<ActionPhase>('checking');
  const [targetEmail, setTargetEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!mode || !oobCode) {
        setPhase('error');
        setErrorMessage(
          'Missing or incomplete Firebase action parameters. Open the link directly from your email inbox.'
        );
        return;
      }

      if (mode === 'verifyEmail') {
        const res = await verifyActionCode(oobCode);
        if (cancelled) return;
        if (!res.ok) {
          setPhase('error');
          setErrorMessage(res.error || 'Could not verify your email address.');
          return;
        }
        addToast(
          'Welcome to HackerRank Campus Crew!',
          'Your email address is now verified.',
          'success'
        );
        navigate('/verified?verified=true', { replace: true });
        return;
      }

      if (mode === 'resetPassword') {
        const check = await verifyPasswordResetActionCode(oobCode);
        if (cancelled) return;
        if (!check.ok) {
          setPhase('error');
          setErrorMessage(check.error || 'Invalid or expired password reset link.');
          return;
        }
        setTargetEmail(check.email || '');
        setPhase('reset_form');
        return;
      }

      setPhase('error');
      setErrorMessage(`Unsupported Firebase action mode "${mode}".`);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode, verifyActionCode, verifyPasswordResetActionCode, addToast, navigate]);

  const meetsLength = newPassword.length >= 6;
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetsLength) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    const res = await confirmPasswordResetAction(oobCode, newPassword);
    setSubmitting(false);

    if (!res.ok) {
      setErrorMessage(res.error || 'Could not reset password.');
      return;
    }

    setPhase('success');
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16">
      <PageSeo
        title={mode === 'resetPassword' ? 'Reset Password' : 'Email Action Verification'}
        description="Complete email verification or password reset for your HackerRank Campus Crew account."
        noIndex
      />
      <div className="p-7 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6">
        {phase === 'checking' && (
          <div className="flex flex-col items-center text-center py-6 space-y-3">
            <Loader2 className="w-8 h-8 text-[#00EA64] animate-spin" aria-hidden="true" />
            <h1 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              Validating Security Link...
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verifying your Firebase Authentication action code.
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-semibold text-red-600 dark:text-red-400">
                Action Link Error
              </p>
              <h1 className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                Link Expired or Invalid
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                to="/login"
                className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5"
              >
                <span>Request Fresh Link</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/"
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                Return Home
              </Link>
            </div>
          </div>
        )}

        {phase === 'reset_form' && (
          <div className="space-y-5">
            {/* Step Progress */}
            <div
              aria-label="Password recovery progress"
              className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono"
            >
              <span className="text-slate-500 dark:text-slate-400">1. Verify Email</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <span className="text-slate-500 dark:text-slate-400">2. Open Reset Link</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <span className="font-semibold text-[#009942] dark:text-[#00EA64]">
                3. New Password
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/30 flex items-center justify-center text-[#009942] dark:text-[#00EA64] shrink-0">
                <KeyRound className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                  HRCC Paavai · Password Recovery
                </p>
                <h1 className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                  Set a New Password
                </h1>
                {targetEmail && (
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    Account: {targetEmail}
                  </p>
                )}
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password-input"
                  className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password-input"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full h-10 pl-3 pr-10 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showNewPassword}
                    className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-r-lg"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password-input"
                  className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full h-10 pl-3 pr-10 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
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

              {/* Clean Password Criteria */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                <span
                  className={`inline-flex items-center gap-1 ${
                    meetsLength ? 'text-[#009942] dark:text-[#00EA64]' : ''
                  }`}
                >
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>6+ characters</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    passwordsMatch ? 'text-[#009942] dark:text-[#00EA64]' : ''
                  }`}
                >
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>Passwords match</span>
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[42px] py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
              >
                {submitting ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        )}

        {phase === 'success' && (
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/40 flex items-center justify-center text-[#009942] dark:text-[#00EA64]">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                Password Updated
              </p>
              <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                Your Password Has Been Reset
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {targetEmail
                  ? `Your password for ${targetEmail} has been updated.`
                  : 'Your password has been updated.'}{' '}
                You can now sign in with your new credentials.
              </p>
            </div>
            <Link
              to="/login?reset=success"
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center justify-center gap-2"
            >
              <MailCheck className="w-4 h-4" aria-hidden="true" />
              <span>Sign In Now</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
