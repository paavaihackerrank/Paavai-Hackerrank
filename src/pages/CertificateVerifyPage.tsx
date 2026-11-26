import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { EventCertificate } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import {
  buildLinkedInAddCertUrl,
  downloadCertificatePng,
  renderCertificateToDataUrl,
} from '../lib/certificateCanvas';
import { PageSeo } from '../components/PageSeo';

export const CertificateVerifyPage: React.FC = () => {
  const { certId = '' } = useParams<{ certId: string }>();
  const navigate = useNavigate();
  const { getCertificateById, siteSettings } = useApp();

  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<EventCertificate | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [lookupInput, setLookupInput] = useState(certId);

  useEffect(() => {
    setLookupInput(certId);
    let cancelled = false;
    const run = async () => {
      if (!certId.trim()) {
        setLoading(false);
        setCertificate(null);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      const res = await getCertificateById(certId);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.certificate) {
        setCertificate(null);
        setError(res.error || 'Certificate not found.');
        return;
      }
      setCertificate(res.certificate);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [certId, getCertificateById]);

  const verificationUrl = useMemo(() => {
    const id = certificate?.certId || certId;
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/certificates/${encodeURIComponent(id)}`;
    }
    return `https://paavai-hackerrank.web.app/certificates/${encodeURIComponent(id)}`;
  }, [certificate?.certId, certId]);

  const previewDataUrl = useMemo(() => {
    if (!certificate) return '';
    return renderCertificateToDataUrl({
      certificate,
      verificationUrl,
      leadName: siteSettings.leadName || 'Campus Lead',
    });
  }, [certificate, verificationUrl, siteSettings.leadName]);

  const linkedInUrl = useMemo(() => {
    if (!certificate) return '';
    return buildLinkedInAddCertUrl(certificate, verificationUrl);
  }, [certificate, verificationUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lookupInput.trim();
    if (!trimmed) return;
    navigate(`/certificates/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <PageSeo
        title={
          certificate
            ? `Verified Certificate — ${certificate.recipientName}`
            : 'Verify E-Certificate'
        }
        description="Verify the authenticity of official HackerRank Campus Crew – Paavai Engineering College event E-Certificates."
        canonicalPath={`/certificates/${encodeURIComponent(certId)}`}
      />

      {/* Header + Quick Lookup Bar */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Official Credential Registry · HRCC Paavai
          </p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            E-Certificate Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Public tamper-evident verification backed by Firestore for Paavai Engineering College
            contests and workshops.
          </p>
        </div>

        <form onSubmit={handleLookupSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="CERT-..."
              aria-label="Certificate ID"
              className="w-full h-10 pl-9 pr-3 rounded-lg text-xs font-mono bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors whitespace-nowrap shrink-0"
          >
            Verify ID
          </button>
        </form>
      </header>

      {loading && (
        <div className="p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#00EA64] animate-spin" aria-hidden="true" />
          <p className="font-mono text-sm text-slate-600 dark:text-slate-300">
            Checking HRCC Paavai certificate registry...
          </p>
        </div>
      )}

      {!loading && !certificate && !error && (
        <section className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/40 flex items-center justify-center mx-auto">
            <Award className="w-6 h-6 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
          </div>
          <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
            Enter a Certificate ID to Verify
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Paste any HRCC Paavai E-Certificate ID (for example,{' '}
            <span className="font-mono text-slate-800 dark:text-slate-200">CERT-...</span>) in the
            verification box above to confirm recipient authenticity, event details, and download
            the official PNG credential.
          </p>
        </section>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="p-6 sm:p-8 rounded-xl border border-red-500/30 bg-red-500/5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="font-mono text-base font-bold text-red-600 dark:text-red-400">
                Certificate Not Verified
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 pt-1">
                Queried ID: {certId || '(empty)'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/events"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              Browse Campus Events
            </Link>
            <Link
              to="/"
              className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Return Home
            </Link>
          </div>
        </div>
      )}

      {!loading && certificate && (
        <div className="space-y-6">
          {/* Authenticity Banner */}
          <section className="p-5 sm:p-6 rounded-xl border border-[#00EA64]/50 bg-white dark:bg-[#121821] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#00EA64]/15 border border-[#00EA64]/40 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Authentic HRCC Paavai Credential
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {certificate.certId}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Issued to <strong className="text-slate-900 dark:text-white">{certificate.recipientName}</strong>{' '}
                  for <strong className="text-slate-900 dark:text-white">{certificate.eventTitle}</strong> (
                  {certificate.awardType}).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  downloadCertificatePng({
                    certificate,
                    verificationUrl,
                    leadName: siteSettings.leadName || 'Campus Lead',
                  })
                }
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#00EA64]" aria-hidden="true" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy Verify Link</span>
                  </>
                )}
              </button>

              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>Add to LinkedIn</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </section>

          {/* High-Resolution Certificate Canvas Preview */}
          {previewDataUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#070B10] shadow-lg">
              <img
                src={previewDataUrl}
                alt={`E-Certificate for ${certificate.recipientName} — ${certificate.eventTitle}`}
                className="w-full h-auto block"
              />
            </div>
          )}

          {/* Structured Verification Metadata */}
          <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
            <h2 className="font-mono text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>Verified Record Details</span>
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Recipient Name</dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {certificate.recipientName}
                </dd>
              </div>
              {certificate.registerNumber && (
                <div>
                  <dt className="font-mono text-slate-500 dark:text-slate-400">Register Number</dt>
                  <dd className="font-mono text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    {certificate.registerNumber}
                  </dd>
                </div>
              )}
              {certificate.department && (
                <div>
                  <dt className="font-mono text-slate-500 dark:text-slate-400">Department</dt>
                  <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    {certificate.department}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Event / Contest</dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  <Link
                    to={`/events/${certificate.eventId}`}
                    className="hover:text-[#009942] dark:hover:text-[#00EA64] hover:underline"
                  >
                    {certificate.eventTitle}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Award Category</dt>
                <dd className="font-mono text-sm font-semibold text-[#009942] dark:text-[#00EA64] mt-0.5">
                  {certificate.awardType}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Event Date</dt>
                <dd className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>
                    {Number.isNaN(new Date(certificate.eventDate).getTime())
                      ? certificate.eventDate
                      : new Date(certificate.eventDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Issued On</dt>
                <dd className="font-mono text-xs text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                  {Number.isNaN(new Date(certificate.issuedAt).getTime())
                    ? certificate.issuedAt
                    : new Date(certificate.issuedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Authorized By</dt>
                <dd className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {certificate.issuedByName}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-slate-500 dark:text-slate-400">Credential ID</dt>
                <dd className="font-mono text-xs text-slate-700 dark:text-slate-200 mt-0.5 break-all">
                  {certificate.certId}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
};
