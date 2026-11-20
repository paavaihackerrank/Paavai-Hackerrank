import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';

interface TroubleshootEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  checking: boolean;
  resending: boolean;
  isCoolingDown: boolean;
  cooldownSeconds: number;
  feedbackMessage?: string;
  feedbackError?: string;
  onResend: () => Promise<void> | void;
  onCheckVerified: () => Promise<void> | void;
  onSwitchEmail: () => Promise<void> | void;
}

const MAIL_SEARCH_QUERY = 'from:firebaseapp.com OR "Verify your email"';

export const TroubleshootEmailModal: React.FC<TroubleshootEmailModalProps> = ({
  isOpen,
  onClose,
  email,
  checking,
  resending,
  isCoolingDown,
  cooldownSeconds,
  feedbackMessage,
  feedbackError,
  onResend,
  onCheckVerified,
  onSwitchEmail,
}) => {
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const busy = checking || resending;
  const hasConcreteEmail = Boolean(email && email !== 'your registered email');

  const handleCopyQuery = async () => {
    try {
      await navigator.clipboard.writeText(MAIL_SEARCH_QUERY);
      setCopiedQuery(true);
      window.setTimeout(() => setCopiedQuery(false), 2000);
    } catch {
      setCopiedQuery(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!hasConcreteEmail) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setCopiedEmail(false);
    }
  };

  const handleSwitchAndClose = async () => {
    onClose();
    await onSwitchEmail();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="troubleshoot-email-title"
        aria-describedby="troubleshoot-email-desc"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]/70">
          <div className="space-y-1 min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Email Delivery Diagnostics
            </p>
            <h3
              id="troubleshoot-email-title"
              className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-white"
            >
              Troubleshoot Email
            </h3>
            <p
              id="troubleshoot-email-desc"
              className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
            >
              Common reasons verification emails do not arrive for{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-white break-all">
                {email}
              </span>{' '}
              and steps to resolve each issue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close troubleshoot email dialog"
            className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18212E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors inline-flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {feedbackError && (
            <div
              role="alert"
              className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 leading-relaxed flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{feedbackError}</span>
            </div>
          )}

          {feedbackMessage && (
            <div className="p-3 rounded-lg text-xs font-medium bg-[#00EA64]/10 border border-[#00EA64]/30 text-[#008f3d] dark:text-[#00EA64] leading-relaxed">
              {feedbackMessage}
            </div>
          )}

          <ol className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-[#0B0F14]/40">
            {/* 01: Spam / Promotions / Junk */}
            <li className="p-4 sm:p-5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300 pt-0.5 shrink-0">
                  01
                </span>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    Filtered into Spam, Junk, or Promotions Tabs
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Automated links from Firebase (<span className="font-mono">firebaseapp.com</span>)
                    are frequently routed away from your Primary inbox into Spam, Junk, Trash, or
                    Gmail&apos;s Promotions and Updates tabs.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Next step: Search your mailbox and mark the email as{' '}
                      <strong>Not Spam</strong> before clicking the link.
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyQuery}
                      className="py-1.5 px-2.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      {copiedQuery ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                          <span>Query Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy Search Filter</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </li>

            {/* 02: Provider & Institutional Blocks */}
            <li className="p-4 sm:p-5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300 pt-0.5 shrink-0">
                  02
                </span>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    Mail Provider Blocks or Institutional Quarantine
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    College domains (such as <span className="font-mono">@paavai.edu.in</span>),
                    managed Outlook gateways, and strict corporate filters often quarantine or drop
                    external authentication emails before delivery.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Next step: Use a standard personal Gmail or personal inbox with your college ID
                      kept only on your profile.
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSwitchAndClose}
                      className="py-1.5 px-2.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Switch Email Account</span>
                    </button>
                  </div>
                </div>
              </div>
            </li>

            {/* 03: Address Typo / Wrong Inbox */}
            <li className="p-4 sm:p-5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300 pt-0.5 shrink-0">
                  03
                </span>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    Typo in Address or Checking Another Mailbox Profile
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    A single mistyped character or being logged into a secondary Gmail/Outlook profile
                    in your browser prevents you from seeing the activation link.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Next step: Confirm you are viewing the exact inbox for{' '}
                      <span className="font-mono">{email}</span>.
                    </span>
                    {hasConcreteEmail && (
                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className="py-1.5 px-2.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                            <span>Address Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copy Address</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>

            {/* 04: Delivery Delay / Rate-Limit */}
            <li className="p-4 sm:p-5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300 pt-0.5 shrink-0">
                  04
                </span>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    Queue Delay or Rate-Limit Cooldown
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Outgoing emails can take 1–3 minutes during peak traffic. Triggering multiple
                    resends rapidly hits Firebase&apos;s rate limit (
                    <span className="font-mono">auth/too-many-requests</span>) and pauses delivery.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" aria-hidden="true" />
                      {isCoolingDown ? (
                        <span className="tabular-nums">
                          Wait <strong>{cooldownSeconds}s</strong> before requesting a fresh email.
                        </span>
                      ) : (
                        <span>You can request one fresh verification email now.</span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={busy || isCoolingDown}
                      onClick={onResend}
                      className="py-1.5 px-2.5 rounded-md text-xs font-mono border border-amber-500/40 bg-white dark:bg-[#121821] text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums"
                    >
                      <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {resending
                          ? 'Sending...'
                          : isCoolingDown
                            ? `Resend (${cooldownSeconds}s)`
                            : 'Resend Email'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>

            {/* 05: Verified on Another Device / Tab */}
            <li className="p-4 sm:p-5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300 pt-0.5 shrink-0">
                  05
                </span>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h4 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    Verified on Your Phone or Another Tab
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    If you opened the verification link on another device or browser tab, this session
                    will remain locked until you sync your account status.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64] shrink-0" aria-hidden="true" />
                      <span>Already clicked the link? Refresh your verification status now.</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onCheckVerified}
                      className="py-1.5 px-3 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{checking ? 'Checking...' : 'Check Status'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]/70">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unverified accounts expire automatically after 12 hours.
          </p>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18212E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
