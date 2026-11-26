import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  CERTIFICATE_AWARD_TYPES,
  CertificateAwardType,
  DEPARTMENTS,
  EventCertificate,
} from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { downloadCertificatePng } from '../lib/certificateCanvas';

export const CertificatesManagerPanel: React.FC = () => {
  const {
    can,
    events,
    users,
    publicProfiles,
    eventCheckIns,
    certificates,
    siteSettings,
    issueEventCertificate,
    issueCertificatesForEventCheckIns,
    deleteCertificate,
  } = useApp();

  const isLead = can('canApproveContent');

  // Bulk issuance state
  const [bulkEventId, setBulkEventId] = useState<string>(events[0]?.id || '');
  const [bulkBusy, setBulkBusy] = useState(false);

  // Individual issuance form state
  const [eventId, setEventId] = useState<string>(events[0]?.id || '');
  const [pickedUserId, setPickedUserId] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [awardType, setAwardType] = useState<CertificateAwardType>('Winner');
  const [awardTitle, setAwardTitle] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [formError, setFormError] = useState('');

  // Registry filters
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveBulkEventId = bulkEventId || events[0]?.id || '';
  const effectiveFormEventId = eventId || events[0]?.id || '';

  const bulkEventCheckInCount = useMemo(
    () => eventCheckIns.filter((c) => c.eventId === effectiveBulkEventId).length,
    [eventCheckIns, effectiveBulkEventId]
  );

  // Quick-pick candidates from QR check-ins of selected event + portal users (if Lead)
  const quickPickCandidates = useMemo(() => {
    const map = new Map<
      string,
      { uid: string; name: string; registerNumber: string; department: string; source: string }
    >();
    eventCheckIns
      .filter((c) => c.eventId === effectiveFormEventId)
      .forEach((c) => {
        map.set(c.userId, {
          uid: c.userId,
          name: c.userName,
          registerNumber: c.registerNumber,
          department: c.department,
          source: 'QR Checked In',
        });
      });
    users.forEach((u) => {
      if (!map.has(u.id)) {
        map.set(u.id, {
          uid: u.id,
          name: u.name,
          registerNumber: u.regNo,
          department: u.department,
          source: 'Portal Member',
        });
      }
    });
    publicProfiles.forEach((p) => {
      if (!map.has(p.uid)) {
        map.set(p.uid, {
          uid: p.uid,
          name: p.name,
          registerNumber: '',
          department: p.department,
          source: 'Verified Member',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [eventCheckIns, effectiveFormEventId, users, publicProfiles]);

  const handleQuickPick = (uid: string) => {
    setPickedUserId(uid);
    const found = quickPickCandidates.find((c) => c.uid === uid);
    if (found) {
      setRecipientName(found.name);
      setRegisterNumber(found.registerNumber);
      setDepartment(found.department);
    }
  };

  const handleBulkIssue = async () => {
    if (!effectiveBulkEventId) return;
    setBulkBusy(true);
    await issueCertificatesForEventCheckIns(effectiveBulkEventId);
    setBulkBusy(false);
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!effectiveFormEventId) {
      setFormError('Select an event first.');
      return;
    }
    if (recipientName.trim().length < 2) {
      setFormError('Enter the recipient full name.');
      return;
    }

    setIssuing(true);
    const res = await issueEventCertificate({
      eventId: effectiveFormEventId,
      recipientUid: pickedUserId || undefined,
      recipientName: recipientName.trim(),
      registerNumber: registerNumber.trim() || undefined,
      department: department.trim() || undefined,
      awardType,
      awardTitle: awardTitle.trim() || undefined,
    });
    setIssuing(false);

    if (!res.ok) {
      setFormError(res.error || 'Could not issue certificate.');
      return;
    }

    setPickedUserId('');
    setRecipientName('');
    setRegisterNumber('');
    setDepartment('');
    setAwardTitle('');
  };

  const getVerifyUrl = (certId: string) => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://paavai-hackerrank.web.app';
    return `${origin}/certificates/${encodeURIComponent(certId)}`;
  };

  const handleCopyVerifyLink = async (certId: string) => {
    try {
      await navigator.clipboard.writeText(getVerifyUrl(certId));
      setCopiedId(certId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard permissions error
    }
  };

  const handleDownload = (cert: EventCertificate) => {
    downloadCertificatePng({
      certificate: cert,
      verificationUrl: getVerifyUrl(cert.certId),
      leadName: siteSettings.leadName || 'Campus Lead',
    });
  };

  const filteredCertificates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return certificates.filter((c) => {
      if (filterEventId !== 'all' && c.eventId !== filterEventId) return false;
      if (!q) return true;
      return (
        c.recipientName.toLowerCase().includes(q) ||
        c.certId.toLowerCase().includes(q) ||
        c.eventTitle.toLowerCase().includes(q) ||
        (c.registerNumber || '').toLowerCase().includes(q) ||
        c.awardType.toLowerCase().includes(q)
      );
    });
  }, [certificates, filterEventId, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
          Tamper-Evident Credentials · HTML5 Canvas PNG + Public Verification
        </p>
        <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
          Verifiable E-Certificates ({certificates.length})
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Issue verifiable Participation, Winner, Runner-Up, Top Performer, and Crew Recognition
          certificates. Verified QR check-in attendees can also self-claim their Participation
          certificate directly from their Profile.
        </p>
      </div>

      {/* 1-Click Bulk Issuance for QR Checked-In Attendees */}
      <section className="p-5 rounded-xl border border-[#00EA64]/40 bg-white dark:bg-[#121821] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Bulk Issue for QR Checked-In Attendees</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate deterministic Participation E-Certificates in one batch for every student who
            completed QR check-in for the selected event.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <select
            value={effectiveBulkEventId}
            onChange={(e) => setBulkEventId(e.target.value)}
            aria-label="Event for bulk certificate issuance"
            className="h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          >
            {events.length === 0 && <option value="">No events available</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({eventCheckIns.filter((c) => c.eventId === ev.id).length} checked in)
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={bulkBusy || !effectiveBulkEventId || bulkEventCheckInCount === 0}
            onClick={handleBulkIssue}
            className="h-10 px-4 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            {bulkBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Issuing Batch...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Issue for {bulkEventCheckInCount} Checked-In</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Individual Winner / Award Certificate Form */}
      <form
        onSubmit={handleIssueSubmit}
        className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Issue Individual Award or Winner Certificate</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="cert-event"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Event *
            </label>
            <select
              id="cert-event"
              value={effectiveFormEventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setPickedUserId('');
              }}
              className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cert-quick-pick"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Quick-Pick Student (Optional)
            </label>
            <select
              id="cert-quick-pick"
              value={pickedUserId}
              onChange={(e) => handleQuickPick(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            >
              <option value="">Manual entry / External participant</option>
              {quickPickCandidates.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name}
                  {c.registerNumber
                    ? ` (${c.registerNumber})`
                    : c.department
                    ? ` (${c.department})`
                    : ''}{' '}
                  · {c.source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cert-award-type"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Award Type *
            </label>
            <select
              id="cert-award-type"
              value={awardType}
              onChange={(e) => setAwardType(e.target.value as CertificateAwardType)}
              className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            >
              {CERTIFICATE_AWARD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="cert-recipient-name"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Recipient Full Name *
            </label>
            <input
              id="cert-recipient-name"
              type="text"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g., Karthik Sundaram"
              className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label
              htmlFor="cert-reg-no"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Register Number (Optional)
            </label>
            <input
              id="cert-reg-no"
              type="text"
              value={registerNumber}
              onChange={(e) => setRegisterNumber(e.target.value)}
              placeholder="e.g., 622123104012"
              className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label
              htmlFor="cert-dept"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Department (Optional)
            </label>
            <input
              id="cert-dept"
              type="text"
              list="cert-dept-options"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g., CSE"
              className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
            <datalist id="cert-dept-options">
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label
            htmlFor="cert-award-title"
            className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Custom Citation Line (Optional)
          </label>
          <input
            id="cert-award-title"
            type="text"
            value={awardTitle}
            onChange={(e) => setAwardTitle(e.target.value)}
            placeholder="e.g., for securing 1st Place with a 100% test-case score in"
            className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </div>

        {formError && (
          <p role="alert" className="text-xs font-mono text-red-500">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={issuing || !effectiveFormEventId}
          className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {issuing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Issuing Certificate...</span>
            </>
          ) : (
            <>
              <Award className="w-4 h-4" />
              <span>Issue Verifiable Certificate</span>
            </>
          )}
        </button>
      </form>

      {/* Issued Certificates Registry */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
            Issued Registry ({filteredCertificates.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              aria-label="Filter certificates by event"
              className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700"
            >
              <option value="all">All Events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient, ID, award..."
                className="h-9 pl-8 pr-3 rounded-lg text-xs bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700 w-56"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] font-mono text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Event &amp; Award</th>
                <th className="py-3 px-4">Certificate ID</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No certificates issued matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => (
                  <tr key={cert.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {cert.recipientName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {[cert.registerNumber, cert.department].filter(Boolean).join(' · ') ||
                          'Verified Recipient'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {cert.eventTitle}
                      </p>
                      <span
                        className={`inline-block mt-1 font-mono text-[10px] px-2 py-0.5 rounded ${
                          cert.awardType === 'Winner'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]'
                        }`}
                      >
                        {cert.awardType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {cert.certId}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(cert.issuedAt).toLocaleDateString('en-IN')}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownload(cert)}
                          title="Download PNG"
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PNG</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyVerifyLink(cert.certId)}
                          title="Copy Verification Link"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#00EA64]"
                        >
                          {copiedId === cert.certId ? (
                            <Check className="w-3.5 h-3.5 text-[#00EA64]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <Link
                          to={`/certificates/${encodeURIComponent(cert.certId)}`}
                          title="Open Public Verification Page"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#00EA64]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        {isLead &&
                          (confirmDeleteId === cert.certId ? (
                            <div className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteCertificate(cert.certId);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded text-[10px] font-semibold bg-red-600 text-white"
                              >
                                Revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 rounded text-[10px] border border-slate-300 dark:border-slate-700"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(cert.certId)}
                              title="Revoke Certificate"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
