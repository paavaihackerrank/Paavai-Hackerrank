import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  MailCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

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
          'Your @paavai.edu.in email is now verified.',
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
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
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-red-500">
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
                <span>Go to Sign In</span>
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
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/30 flex items-center justify-center text-[#009942] dark:text-[#00EA64] shrink-0">
                <KeyRound className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[#009942] dark:text-[#00EA64]">
                  HRCC Paavai · Password Recovery
                </p>
                <h1 className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                  Set a New Password
                </h1>
                {targetEmail && (
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
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
                <input
                  id="new-password-input"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password-input"
                  className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-password-input"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
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
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[#009942] dark:text-[#00EA64]">
                Password Updated
              </p>
              <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                Your Password Has Been Reset
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {targetEmail ? `Your password for ${targetEmail} has been updated.` : 'Your password has been updated.'}{' '}
                You can now sign in with your new credentials.
              </p>
            </div>
            <Link
              to="/login"
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
