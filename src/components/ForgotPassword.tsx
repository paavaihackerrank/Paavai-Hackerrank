import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import { isValidAccountEmail, useApp } from '../context/AppContext';

interface ForgotPasswordProps {
  initialEmail?: string;
  onBackToLogin: () => void;
}

const RESET_SEARCH_FILTER = 'from:firebaseapp.com OR "password"';
const RESEND_COOLDOWN_SECONDS = 45;

function getWebmailShortcut(email: string): { label: string; href: string } | null {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { label: 'Open Gmail', href: 'https://mail.google.com' };
  }
  if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'msn.com'
  ) {
    return { label: 'Open Outlook', href: 'https://outlook.live.com/mail/' };
  }
  if (domain === 'yahoo.com' || domain === 'yahoo.in' || domain === 'ymail.com') {
    return { label: 'Open Yahoo Mail', href: 'https://mail.yahoo.com' };
  }
  return null;
}

/**
 * Forgot Password recovery flow on the Login page using Firebase's
 * `sendPasswordResetEmail` (via `sendPasswordReset` in AppContext).
 */
export const ForgotPassword: React.FC<ForgotPasswordProps> = ({
  initialEmail = '',
  onBackToLogin,
}) => {
  const { sendPasswordReset } = useApp();
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [phase, setPhase] = useState<'request' | 'sent'>('request');
  const [sentToEmail, setSentToEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [copiedFilter, setCopiedFilter] = useState(false);
  const [showTips, setShowTips] = useState(true);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const dispatchReset = async (targetRaw: string) => {
    const targetEmail = targetRaw.trim().toLowerCase();
    if (!targetEmail || !isValidAccountEmail(targetEmail)) {
      setError('Enter a valid registered personal email address.');
      return;
    }

    setSubmitting(true);
    setError('');
    const res = await sendPasswordReset(targetEmail);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not send password reset email.');
      return;
    }

    setSentToEmail(targetEmail);
    setPhase('sent');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchReset(resetEmail);
  };

  const handleCopyFilter = async () => {
    try {
      await navigator.clipboard.writeText(RESET_SEARCH_FILTER);
      setCopiedFilter(true);
      window.setTimeout(() => setCopiedFilter(false), 1800);
    } catch {
      setCopiedFilter(false);
    }
  };

  const webmail = sentToEmail ? getWebmailShortcut(sentToEmail) : null;

  return (
    <div className="space-y-5">
      {/* Compact Recovery Step Progress */}
      <div
        aria-label="Password recovery progress"
        className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono"
      >
        <span
          className={
            phase === 'request'
              ? 'font-semibold text-[#009942] dark:text-[#00EA64]'
              : 'text-slate-500 dark:text-slate-400'
          }
        >
          1. Verify Email
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
          ·
        </span>
        <span
          className={
            phase === 'sent'
              ? 'font-semibold text-[#009942] dark:text-[#00EA64]'
              : 'text-slate-400 dark:text-slate-500'
          }
        >
          2. Open Reset Link
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
          ·
        </span>
        <span className="text-slate-400 dark:text-slate-500">3. New Password</span>
      </div>

      {phase === 'request' ? (
        <>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00EA64]/15 border border-[#00EA64]/30 flex items-center justify-center text-[#009942] dark:text-[#00EA64] shrink-0">
              <KeyRound className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                Reset Your Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Enter your registered <strong>personal email</strong> and we will dispatch a
                one-time password reset link to your inbox.
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="forgot-password-email"
                className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Registered Personal Email
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="forgot-password-email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="you@gmail.com"
                  className="w-full h-10 pl-9 pr-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Use the personal email you signed up with rather than your college ID alias.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[42px] py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Sending Reset Email...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>
          </form>
        </>
      ) : (
        <div className="space-y-4">
          {/* Sent Confirmation Card */}
          <div className="p-4 rounded-xl border border-[#00EA64]/35 bg-[#00EA64]/8 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 flex items-center justify-center text-[#009942] dark:text-[#00EA64] shrink-0">
                <MailCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                  Check Your Email Inbox
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  We sent a password reset link to{' '}
                  <strong className="font-mono text-slate-900 dark:text-white break-all">
                    {sentToEmail}
                  </strong>
                  . Open the message and follow the link to choose a new password.
                </p>
              </div>
            </div>

            {/* Primary Actions: Open Webmail / Resend with Cooldown */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {webmail && (
                <a
                  href={webmail.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>{webmail.label}</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}

              <button
                type="button"
                disabled={submitting || cooldown > 0}
                onClick={() => dispatchReset(sentToEmail)}
                className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F14] text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Sending...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resend in {cooldown}s</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resend Reset Email</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhase('request');
                  setError('');
                }}
                className="min-h-[36px] px-2.5 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Change email
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Delivery Tips Accordion */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]/70 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTips((prev) => !prev)}
              aria-expanded={showTips}
              className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-[#141b25] transition-colors"
            >
              <span>Didn&apos;t see the reset email?</span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                {showTips ? 'Hide steps' : 'Show steps'}
              </span>
            </button>

            {showTips && (
              <div className="px-4 pb-3.5 pt-1 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <p className="leading-relaxed">
                  <strong className="font-mono text-slate-800 dark:text-slate-100">01.</strong>{' '}
                  Check your <strong>Spam</strong>, <strong>Junk</strong>, or{' '}
                  <strong>Promotions</strong> folder for messages from{' '}
                  <span className="font-mono">firebaseapp.com</span>.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Search filter: <code className="font-mono">{RESET_SEARCH_FILTER}</code>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyFilter}
                    className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    {copiedFilter ? (
                      <>
                        <Check className="w-3 h-3 text-[#00EA64]" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        <span>Copy Filter</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="leading-relaxed">
                  <strong className="font-mono text-slate-800 dark:text-slate-100">02.</strong>{' '}
                  Allow 1–2 minutes for delivery before clicking Resend, and confirm the email
                  address matches the account registered on HRCC Paavai.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBackToLogin}
        className="w-full py-2 text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Back to Sign In</span>
      </button>
    </div>
  );
};
