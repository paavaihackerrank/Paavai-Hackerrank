import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CAMPUS_LEAD_EMAIL } from '../lib/firebase';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import { PageSeo } from '../components/PageSeo';

export const EmailDebugPage: React.FC = () => {
  const {
    can,
    emailSendAttempts,
    refreshEmailSendAttempts,
    deleteEmailSendAttempt,
    addToast,
  } = useApp();

  const [typeFilter, setTypeFilter] = useState<
    'all' | 'password_reset' | 'verification' | 'join_request_approved' | 'join_request_rejected'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [templateViewMode, setTemplateViewMode] = useState<'preview' | 'html'>('preview');

  if (!can('canAccessAdminPanel')) {
    return null;
  }

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : `https://${firebaseAppletConfig.authDomain}`;
  const hostname =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : firebaseAppletConfig.authDomain;
  const customActionUrl = `${origin}/auth/action`;

  const recommendedPasswordResetSubject =
    'Reset your HackerRank Campus Crew – Paavai password';
  const recommendedPasswordResetBody = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background-color:#0b0f14;padding:20px 24px;border-bottom:2px solid #00ea64;">
            <p style="margin:0;font-family:monospace;font-size:12px;font-weight:700;color:#00ea64;letter-spacing:0.02em;">HRCC PAAVAI</p>
            <h1 style="margin:6px 0 0;font-size:18px;font-weight:700;color:#ffffff;">Password Reset Request</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 12px;">Hello,</p>
            <p style="margin:0 0 16px;">We received a request to reset the password for your <strong>HackerRank Campus Crew – Paavai Engineering College</strong> account (<strong>%EMAIL%</strong>).</p>
            <p style="margin:0 0 20px;">
              <a href="%LINK%" style="display:inline-block;background-color:#00ea64;color:#0b0f14;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:8px;">Reset Password</a>
            </p>
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">This link expires automatically after use. If you did not ask to reset your password, you can safely ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
            HackerRank Campus Crew · Paavai Engineering College · Namakkal
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshEmailSendAttempts();
    setRefreshing(false);
    addToast('Logs refreshed', 'Queried Firestore emailSendAttempts.', 'info');
  };

  const copyValue = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
      addToast('Copied to clipboard', undefined, 'info');
    } catch {
      addToast('Copy failed', 'Select and copy the text manually.', 'error');
    }
  };

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return emailSendAttempts.filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.email.toLowerCase().includes(q) ||
        (entry.errorCode || '').toLowerCase().includes(q) ||
        (entry.errorMessage || '').toLowerCase().includes(q) ||
        (entry.continueUrl || '').toLowerCase().includes(q)
      );
    });
  }, [emailSendAttempts, typeFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = emailSendAttempts.length;
    const sent = emailSendAttempts.filter((e) => e.status === 'sent').length;
    const failed = emailSendAttempts.filter((e) => e.status === 'failed').length;
    const fallbackWarnings = emailSendAttempts.filter(
      (e) => e.status === 'sent' && Boolean(e.errorCode)
    ).length;
    const passwordResets = emailSendAttempts.filter(
      (e) => e.type === 'password_reset'
    ).length;
    return { total, sent, failed, fallbackWarnings, passwordResets };
  }, [emailSendAttempts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <PageSeo
        title="Email Delivery Diagnostics"
        description="Campus Lead Firebase email delivery diagnostics and template preview."
        noIndex
      />
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <Link
            to="/dashboard/lead"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Lead Dashboard</span>
          </Link>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[#009942] dark:text-[#00EA64]">
            Campus Lead Diagnostics · emailSendAttempts
          </p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Email Delivery &amp; Auth Template Debug
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Inspect client-recorded password reset and verification email dispatch logs from
            Firestore, diagnose continue-URL fallbacks or rate limits, and verify Firebase Console
            template settings.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2.5 rounded-lg text-xs font-mono font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-2 shrink-0 disabled:opacity-60"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Firestore Logs'}</span>
        </button>
      </header>

      {/* Summary KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">Total Logged</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {stats.total}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">Dispatched</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#009942] dark:text-[#00EA64] mt-1">
            {stats.sent}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">Failed</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400 mt-1">
            {stats.failed}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Continue-URI Fallbacks
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {stats.fallbackWarnings}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">Password Resets</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {stats.passwordResets}
          </p>
        </div>
      </section>

      {/* Filters & Logs Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                'all',
                'password_reset',
                'verification',
                'join_request_approved',
                'join_request_rejected',
              ] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  typeFilter === t
                    ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                    : 'bg-slate-100 dark:bg-[#0B0F14] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {t === 'all'
                  ? 'All Types'
                  : t === 'password_reset'
                    ? 'Password Reset'
                    : t === 'verification'
                      ? 'Verification'
                      : t === 'join_request_approved'
                        ? 'Join Approved'
                        : 'Join Rejected'}
              </button>
            ))}

            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

            {(['all', 'sent', 'failed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-[#0B0F14] font-semibold'
                    : 'bg-slate-100 dark:bg-[#0B0F14] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st === 'all' ? 'All Statuses' : st}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search email or error code..."
              className="w-full h-9 pl-8 pr-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Mail className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
              No emailSendAttempts records match these filters
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Every new signup verification, resend click, and forgot-password submission writes an
              audit entry to Firestore collection <code className="font-mono">emailSendAttempts</code>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0B0F14]/70">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Recipient Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Error Code / Notes</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredLogs.map((log) => {
                  const hasWarning = log.status === 'sent' && Boolean(log.errorCode);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#0B0F14]/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-600 dark:text-slate-300">
                        <div>
                          {log.attemptedAt
                            ? new Date(log.attemptedAt).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'medium',
                              })
                            : '—'}
                        </div>
                        <div className="text-[10px] text-slate-400">{log.attemptedAt}</div>
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-900 dark:text-white">
                        {log.email}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        {log.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            failed
                          </span>
                        ) : hasWarning ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                            sent (fallback)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#009942] dark:text-[#00EA64]">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            sent
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-md space-y-1">
                        {log.errorCode ? (
                          <p className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            {log.errorCode}
                          </p>
                        ) : (
                          <p className="font-mono text-[11px] text-slate-400">No error code</p>
                        )}
                        {log.errorMessage && (
                          <p className="text-slate-600 dark:text-slate-300 leading-snug">
                            {log.errorMessage}
                          </p>
                        )}
                        {log.continueUrl && (
                          <p className="font-mono text-[10px] text-slate-400 truncate">
                            continueUrl: {log.continueUrl}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => deleteEmailSendAttempt(log.id)}
                          aria-label={`Delete log for ${log.email}`}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-500/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Firebase Console Email Template & Custom Action URL Verification Guide */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5">
          <div className="space-y-1">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[#009942] dark:text-[#00EA64]">
              Firebase Console · Password Reset Template &amp; Action URL
            </p>
            <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              Console Configuration Checklist ({firebaseAppletConfig.projectId})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Firebase Authentication email templates and Authorized Domains live in the Firebase
              Console (client SDKs cannot modify them remotely). Apply the exact settings below in{' '}
              <strong>Authentication → Templates → Password reset</strong> and{' '}
              <strong>Authentication → Settings → Authorized domains</strong>.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Custom Action Handler URL (Customize action URL)
                </p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white truncate">
                  {customActionUrl}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyValue('actionUrl', customActionUrl)}
                className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px] inline-flex items-center gap-1 shrink-0 hover:border-[#00EA64]"
              >
                {copiedKey === 'actionUrl' ? (
                  <Check className="w-3 h-3 text-[#00EA64]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Copy</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Sender Name &amp; Default From
                </p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white">
                  HackerRank Campus Crew – Paavai
                </p>
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  noreply@{firebaseAppletConfig.authDomain}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Reply-To Address
                </p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white">
                  hackerrankcrew@paavai.edu.in
                </p>
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Authorized host: {hostname}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Password Reset Subject Line
                </p>
                <button
                  type="button"
                  onClick={() => copyValue('subject', recommendedPasswordResetSubject)}
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px] inline-flex items-center gap-1 hover:border-[#00EA64]"
                >
                  {copiedKey === 'subject' ? (
                    <Check className="w-3 h-3 text-[#00EA64]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy</span>
                </button>
              </div>
              <p className="font-mono text-slate-900 dark:text-white">
                {recommendedPasswordResetSubject}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Branded Password Reset Email Template
                </p>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821]">
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('preview')}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        templateViewMode === 'preview'
                          ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Visual Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('html')}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        templateViewMode === 'html'
                          ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      HTML Source
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyValue('body', recommendedPasswordResetBody)}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px] inline-flex items-center gap-1 hover:border-[#00EA64]"
                  >
                    {copiedKey === 'body' ? (
                      <Check className="w-3 h-3 text-[#00EA64]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Copy HTML</span>
                  </button>
                </div>
              </div>

              {templateViewMode === 'preview' ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden shadow-sm">
                  <div className="bg-[#0B0F14] px-5 py-4 border-b-2 border-[#00EA64]">
                    <p className="font-mono text-[11px] font-bold text-[#00EA64]">
                      HRCC PAAVAI
                    </p>
                    <p className="font-mono text-base font-bold text-white mt-1">
                      Password Reset Request
                    </p>
                  </div>
                  <div className="p-5 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <p>Hello,</p>
                    <p>
                      We received a request to reset the password for your{' '}
                      <strong className="text-slate-900 dark:text-white">
                        HackerRank Campus Crew – Paavai Engineering College
                      </strong>{' '}
                      account (<span className="font-mono">%EMAIL%</span>).
                    </p>
                    <div className="pt-1">
                      <span className="inline-block px-4 py-2.5 rounded-lg bg-[#00EA64] text-[#0B0F14] font-semibold text-xs font-mono">
                        Reset Password
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      This link expires automatically after use. If you did not ask to reset your
                      password, you can safely ignore this email.
                    </p>
                  </div>
                  <div className="px-5 py-3 bg-slate-50 dark:bg-[#0B0F14] border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    HackerRank Campus Crew · Paavai Engineering College · Namakkal
                  </div>
                </div>
              ) : (
                <pre className="p-2.5 rounded bg-slate-100 dark:bg-[#121821] font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {recommendedPasswordResetBody}
                </pre>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4 h-fit">
          <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
            Why Reset Emails Fail to Arrive
          </h2>
          <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800">
              <strong className="font-mono text-slate-900 dark:text-white block mb-0.5">
                1. Account Not Created in Firebase Auth Users
              </strong>
              When <em>Email enumeration protection</em> is active in Firebase Auth,{' '}
              <code className="font-mono">sendPasswordResetEmail</code> resolves as{' '}
              <code className="font-mono">sent</code> without emailing if{' '}
              <code className="font-mono">{CAMPUS_LEAD_EMAIL}</code> has not been added or
              signed up in <strong>Authentication → Users</strong> yet.
            </li>
            <li className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800">
              <strong className="font-mono text-slate-900 dark:text-white block mb-0.5">
                2. Institutional @paavai.edu.in Spam / Quarantine
              </strong>
              Default Firebase sender{' '}
              <code className="font-mono">noreply@{firebaseAppletConfig.authDomain}</code> lacks your
              institution&apos;s SPF/DKIM alignment. Check Outlook/Gmail Quarantine or configure a
              custom SMTP sender in Firebase Auth Settings.
            </li>
            <li className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800">
              <strong className="font-mono text-slate-900 dark:text-white block mb-0.5">
                3. Missing Preview Host in Authorized Domains
              </strong>
              If the table above shows <code className="font-mono">sent (fallback)</code> with{' '}
              <code className="font-mono">auth/unauthorized-continue-uri</code>, add{' '}
              <code className="font-mono">{hostname}</code> to{' '}
              <strong>Authentication → Settings → Authorized domains</strong>.
            </li>
          </ul>

          <a
            href={`https://console.firebase.google.com/project/${firebaseAppletConfig.projectId}/authentication/emails`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-lg text-xs font-mono font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-[#00EA64] transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Open Firebase Console Email Templates</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
};
