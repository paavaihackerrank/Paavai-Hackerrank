import React, { useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface VerificationBannerProps {
  email: string;
  onVerified?: (redirectPath: string) => void;
  compact?: boolean;
}

export const VerificationBanner: React.FC<VerificationBannerProps> = ({
  email,
  onVerified,
  compact = false,
}) => {
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
    if (onVerified) {
      onVerified(res.redirectPath || '/dashboard/member');
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await resendVerificationEmail();
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Could not resend verification email.');
      return;
    }
    setMessage(`A fresh verification link has been sent to ${email}.`);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border border-amber-500/40 bg-amber-500/10 ${
        compact ? 'p-4 sm:p-5' : 'p-6 sm:p-7'
      } space-y-4`}
    >
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <MailCheck className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
            Account Activation Pending · Check Your Email
          </p>
          <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
            Verify Your Email to Activate Your Account
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Please check your email (<strong className="font-mono">{email}</strong>) for a
            verification link to activate your account. Unverified accounts are automatically deleted
            after <strong>12 hours</strong>.
          </p>
        </div>
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

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={handleCheckVerified}
          className="py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          <span>{busy ? 'Checking...' : "I've Verified My Email — Activate Account"}</span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={handleResend}
          className="py-2.5 px-4 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors disabled:opacity-60"
        >
          Resend Verification Email
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={logout}
          className="py-2 px-3 text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
};
