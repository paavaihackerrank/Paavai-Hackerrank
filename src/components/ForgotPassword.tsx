import React, { useState } from 'react';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { isAllowedCollegeEmail, useApp } from '../context/AppContext';

interface ForgotPasswordProps {
  initialEmail?: string;
  onBackToLogin: () => void;
}

/**
 * Forgot Password recovery component on the Login page using Firebase's
 * `sendPasswordResetEmail` (via `sendPasswordReset` in AppContext).
 */
export const ForgotPassword: React.FC<ForgotPasswordProps> = ({
  initialEmail = '',
  onBackToLogin,
}) => {
  const { sendPasswordReset } = useApp();
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim();
    if (!targetEmail || !isAllowedCollegeEmail(targetEmail)) {
      setError('Enter your registered @paavai.edu.in email address.');
      setSuccessMessage('');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');
    const res = await sendPasswordReset(targetEmail);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not send password reset email.');
      return;
    }

    setSuccessMessage(
      `Password reset link sent to ${targetEmail.toLowerCase()}. Check your inbox and Spam/Promotions folder.`
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#00EA64]/15 border border-[#00EA64]/30 flex items-center justify-center text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5">
          <KeyRound className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
            Forgot Password
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter your registered <strong>@paavai.edu.in</strong> email and Firebase will send a
            secure password reset link to recover your account access.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="p-3.5 rounded-lg text-xs font-medium bg-[#00EA64]/10 border border-[#00EA64]/30 text-[#009942] dark:text-[#00EA64] leading-relaxed space-y-1.5"
        >
          <div className="flex items-start gap-2">
            <MailCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-6">
            Didn&apos;t receive it after 2 minutes? Check Spam/Quarantine, and confirm this account
            is registered in Firebase Authentication with the Email/Password provider enabled.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="forgot-password-email"
            className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Registered Paavai Email
          </label>
          <input
            id="forgot-password-email"
            type="email"
            autoComplete="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="student@paavai.edu.in"
            className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
        >
          {submitting ? 'Sending Reset Link...' : 'Send Password Reset Email'}
        </button>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full py-2 text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Sign In</span>
        </button>
      </form>
    </div>
  );
};
