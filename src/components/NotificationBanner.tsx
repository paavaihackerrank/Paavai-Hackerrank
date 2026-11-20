import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, Mail, RefreshCw } from 'lucide-react';
import {
  getResendCooldownStorageKey,
  setResendCooldownTimestamp,
  useApp,
} from '../context/AppContext';

export interface NotificationBannerUser {
  email?: string | null;
  emailVerified?: boolean;
}

interface NotificationBannerProps {
  user?: NotificationBannerUser | null;
  onVerified?: (redirectPath: string) => void;
  compact?: boolean;
}

const COOLDOWN_SECONDS = 60;

function readRemainingSeconds(email?: string | null): number {
  try {
    const raw = localStorage.getItem(getResendCooldownStorageKey(email));
    if (!raw) return 0;
    const targetMs = Number(raw);
    if (!Number.isFinite(targetMs)) return 0;
    const diff = Math.ceil((targetMs - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

/**
 * Persistent high-visibility warning banner shown when a signed-up user's
 * `emailVerified` flag is `false`, prompting them to check their inbox for
 * activation instructions. Includes a 60s cooldown on resending verification emails.
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  user,
  onVerified,
  compact = false,
}) => {
  const { firebaseUser, currentUser, resendVerificationEmail, refreshEmailVerification, logout } =
    useApp();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const targetUser = user !== undefined ? user : (firebaseUser ?? currentUser);
  const targetEmail = targetUser?.email || '';

  const [cooldownSeconds, setCooldownSeconds] = useState<number>(() =>
    readRemainingSeconds(targetEmail)
  );

  const syncCooldown = useCallback(() => {
    setCooldownSeconds(readRemainingSeconds(targetEmail));
  }, [targetEmail]);

  useEffect(() => {
    syncCooldown();
    const timer = window.setInterval(() => {
      const remaining = readRemainingSeconds(targetEmail);
      setCooldownSeconds(remaining);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [targetEmail, syncCooldown]);

  if (!targetUser || targetUser.emailVerified !== false) {
    return null;
  }

  const email = targetEmail || 'your @paavai.edu.in email';
  const busy = checking || resending;
  const isCoolingDown = cooldownSeconds > 0;
  const cooldownProgress = Math.min(
    100,
    Math.max(0, Math.round(((COOLDOWN_SECONDS - cooldownSeconds) / COOLDOWN_SECONDS) * 100))
  );

  const handleCheckVerified = async () => {
    setChecking(true);
    setError('');
    setMessage('');
    const res = await refreshEmailVerification();
    setChecking(false);
    if (!res.ok) {
      setError(res.error || 'Email is not verified yet. Please check your inbox.');
      return;
    }
    if (onVerified) {
      onVerified(res.redirectPath || '/dashboard/member');
    }
  };

  const handleResend = async () => {
    if (isCoolingDown || busy) return;
    setResending(true);
    setError('');
    setMessage('');
    const res = await resendVerificationEmail();
    setResending(false);
    if (!res.ok) {
      syncCooldown();
      setError(res.error || 'Could not resend verification email.');
      return;
    }
    setResendCooldownTimestamp(targetEmail, COOLDOWN_SECONDS * 1000);
    setCooldownSeconds(COOLDOWN_SECONDS);
    setMessage(`A fresh verification link has been sent to ${email}. Please check your inbox.`);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-xl border border-amber-500/70 border-l-4 border-l-amber-500 bg-amber-500/12 dark:bg-amber-500/10 ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
      } space-y-4`}
    >
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Warning · Account Activation Required
          </p>
          <h2 className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Verify Your Email — Check Your Inbox
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            Your account (<strong className="font-mono">{email}</strong>) is not activated yet.
            Please check your inbox (including Spam/Promotions) for the verification link to
            activate your account. Unverified accounts are automatically deleted after{' '}
            <strong>12 hours</strong>.
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

      {isCoolingDown && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-xs font-mono text-amber-800 dark:text-amber-200">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Please wait <strong>{cooldownSeconds}s</strong> before requesting another email
              </span>
            </span>
            <span className="tabular-nums">{cooldownSeconds}s</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-amber-500/20 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-[width] duration-700 ease-linear"
              style={{ width: `${cooldownProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={handleCheckVerified}
          className="py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Checking...' : "I've Verified My Email — Activate Account"}</span>
        </button>

        <button
          type="button"
          disabled={busy || isCoolingDown}
          onClick={handleResend}
          aria-disabled={busy || isCoolingDown}
          className="py-2.5 px-4 rounded-lg text-xs font-medium border border-amber-500/40 bg-white/90 dark:bg-[#121821] text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors disabled:opacity-55 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="tabular-nums">
            {resending
              ? 'Sending...'
              : isCoolingDown
                ? `Resend Verification Email (${cooldownSeconds}s)`
                : 'Resend Verification Email'}
          </span>
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
