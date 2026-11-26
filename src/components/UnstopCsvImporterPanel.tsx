import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  UnstopCsvParseResult,
  exportUnstopParticipantsCsv,
  parseUnstopParticipantsCsv,
} from '../lib/unstopCsv';

export const UnstopCsvImporterPanel: React.FC = () => {
  const {
    can,
    events,
    users,
    registrations,
    eventCheckIns,
    unstopParticipants,
    importUnstopParticipants,
    deleteUnstopParticipant,
    clearEventUnstopParticipants,
  } = useApp();

  const isLead = can('canApproveContent');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    const unstopFirst = events.find((e) => Boolean(e.unstopUrl));
    return unstopFirst?.id || events[0]?.id || '';
  });
  const [rawCsvText, setRawCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<UnstopCsvParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Roster filter state
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClearEventId, setConfirmClearEventId] = useState<string | null>(null);

  const effectiveEventId = selectedEventId || events[0]?.id || '';

  // Combine Lead users list with Crew-accessible registrations & check-ins so both Lead and Crew match Paavai accounts
  const matchableAccounts = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const reg of registrations) {
      if (!byId.has(reg.userId)) {
        byId.set(reg.userId, {
          id: reg.userId,
          name: reg.userName,
          email: reg.userEmail,
          role: 'member',
          regNo: reg.registerNumber,
          department: reg.department,
          year: reg.year,
          phone: '',
          hackerRankHandle: '',
          bio: '',
          skills: [],
          joinedAt: reg.registeredAt,
        });
      }
    }
    for (const ci of eventCheckIns) {
      if (!byId.has(ci.userId)) {
        byId.set(ci.userId, {
          id: ci.userId,
          name: ci.userName,
          email: ci.userEmail,
          collegeEmail: ci.collegeEmail || undefined,
          role: 'member',
          regNo: ci.registerNumber,
          department: ci.department,
          year: ci.year,
          phone: ci.phone || '',
          hackerRankHandle: '',
          bio: '',
          skills: [],
          joinedAt: ci.checkedInAt,
        });
      }
    }
    return Array.from(byId.values());
  }, [users, registrations, eventCheckIns]);

  const handleCsvInput = (csvContent: string, uploadedName = '') => {
    setRawCsvText(csvContent);
    setFileName(uploadedName);
    setImportError('');
    if (!csvContent.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseUnstopParticipantsCsv(csvContent, matchableAccounts);
    setParseResult(result);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImportError('CSV file must be smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleCsvInput(String(reader.result || ''), file.name);
    };
    reader.onerror = () => {
      setImportError('Could not read the selected CSV file.');
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!effectiveEventId) {
      setImportError('Select a campus event before importing.');
      return;
    }
    if (!parseResult || parseResult.rows.length === 0) {
      setImportError('Upload or paste a valid Unstop participants CSV first.');
      return;
    }
    setImporting(true);
    setImportError('');
    const res = await importUnstopParticipants(effectiveEventId, parseResult.rows);
    setImporting(false);
    if (!res.ok) {
      setImportError(res.error || 'Import failed.');
      return;
    }
    setRawCsvText('');
    setFileName('');
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFilterEventId(effectiveEventId);
  };

  // Cross-reference with verified QR check-ins
  const checkedInLookup = useMemo(() => {
    const userIdsByEvent = new Map<string, Set<string>>();
    const emailsByEvent = new Map<string, Set<string>>();
    for (const c of eventCheckIns) {
      if (!userIdsByEvent.has(c.eventId)) userIdsByEvent.set(c.eventId, new Set());
      if (!emailsByEvent.has(c.eventId)) emailsByEvent.set(c.eventId, new Set());
      userIdsByEvent.get(c.eventId)!.add(c.userId);
      if (c.userEmail) emailsByEvent.get(c.eventId)!.add(c.userEmail.toLowerCase());
      if (c.collegeEmail) emailsByEvent.get(c.eventId)!.add(c.collegeEmail.toLowerCase());
    }
    return { userIdsByEvent, emailsByEvent };
  }, [eventCheckIns]);

  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unstopParticipants.filter((p) => {
      if (filterEventId !== 'all' && p.eventId !== filterEventId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.registerNumber || '').toLowerCase().includes(q) ||
        (p.college || '').toLowerCase().includes(q) ||
        (p.teamName || '').toLowerCase().includes(q)
      );
    });
  }, [unstopParticipants, filterEventId, searchQuery]);

  const rosterStats = useMemo(() => {
    let matched = 0;
    let checkedIn = 0;
    for (const p of filteredRoster) {
      if (p.matchedUserId) matched += 1;
      const uidSet = checkedInLookup.userIdsByEvent.get(p.eventId);
      const emailSet = checkedInLookup.emailsByEvent.get(p.eventId);
      if (
        (p.matchedUserId && uidSet?.has(p.matchedUserId)) ||
        emailSet?.has(p.email.toLowerCase())
      ) {
        checkedIn += 1;
      }
    }
    return { total: filteredRoster.length, matched, checkedIn };
  }, [filteredRoster, checkedInLookup]);

  const handleExportRoster = () => {
    const allCheckedInUids = new Set<string>();
    const allCheckedInEmails = new Set<string>();
    const targetEvents =
      filterEventId === 'all'
        ? eventCheckIns
        : eventCheckIns.filter((c) => c.eventId === filterEventId);
    for (const c of targetEvents) {
      allCheckedInUids.add(c.userId);
      if (c.userEmail) allCheckedInEmails.add(c.userEmail.toLowerCase());
      if (c.collegeEmail) allCheckedInEmails.add(c.collegeEmail.toLowerCase());
    }
    exportUnstopParticipantsCsv(
      filteredRoster,
      allCheckedInUids,
      allCheckedInEmails,
      filterEventId === 'all'
        ? 'hrcc-paavai-unstop-participants.csv'
        : `hrcc-paavai-unstop-${filterEventId}.csv`
    );
  };

  return (
    <section className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Unstop Organizer Integration · Attendance Reconciliation
          </p>
          <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white mt-0.5">
            Unstop Registered Participants CSV Import ({unstopParticipants.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload your Unstop registrations CSV export to sync participants, auto-match verified
            Paavai student accounts, and cross-check live QR check-in attendance.
          </p>
        </div>

        {filteredRoster.length > 0 && can('canExportRegistrations') && (
          <button
            type="button"
            onClick={handleExportRoster}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Export Unstop + Attendance CSV</span>
          </button>
        )}
      </div>

      {/* Upload / Paste Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <label
              htmlFor="unstop-csv-event"
              className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Target Campus Event
            </label>
            <select
              id="unstop-csv-event"
              value={effectiveEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            >
              {events.length === 0 && <option value="">No events created yet</option>}
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} {ev.unstopUrl ? '· Unstop Linked' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
              Unstop Registrations Export (.csv)
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="unstop-csv-file-input"
              />
              <label
                htmlFor="unstop-csv-file-input"
                className="flex-1 h-10 px-3.5 rounded-lg text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F14] hover:border-[#00EA64] transition-colors cursor-pointer inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate"
              >
                <Upload className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {fileName || 'Choose Unstop CSV file (Name, Email, College, Team...)'}
                </span>
              </label>
              {(rawCsvText || fileName) && (
                <button
                  type="button"
                  onClick={() => {
                    handleCsvInput('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label="Clear CSV selection"
                  className="h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Paste Fallback */}
        <details className="text-xs">
          <summary className="cursor-pointer font-mono text-slate-500 dark:text-slate-400 hover:text-[#009942] dark:hover:text-[#00EA64]">
            Or paste raw CSV rows directly
          </summary>
          <textarea
            rows={4}
            value={rawCsvText}
            onChange={(e) => handleCsvInput(e.target.value, fileName || 'pasted.csv')}
            placeholder="Name,Email,Register Number,College,Team Name,Status&#10;Arjun Kumar,arjun@paavai.edu.in,622123104001,Paavai Engineering College,Binary Squad,Confirmed"
            className="mt-2 w-full p-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </details>

        {importError && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{importError}</span>
          </div>
        )}

        {parseResult && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-3">
            {parseResult.error ? (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseResult.error}</span>
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span className="inline-flex items-center gap-1.5 text-[#009942] dark:text-[#00EA64] font-semibold">
                      <FileSpreadsheet className="w-4 h-4" />
                      {parseResult.rows.length} valid participant
                      {parseResult.rows.length === 1 ? '' : 's'} ready
                    </span>
                    {parseResult.matchedCount > 0 && (
                      <span className="text-slate-600 dark:text-slate-300">
                        · {parseResult.matchedCount} matched to portal accounts
                      </span>
                    )}
                    {parseResult.duplicateCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        · {parseResult.duplicateCount} duplicate email
                        {parseResult.duplicateCount === 1 ? '' : 's'} skipped
                      </span>
                    )}
                    {parseResult.skippedCount > 0 && (
                      <span className="text-slate-500">
                        · {parseResult.skippedCount} invalid row
                        {parseResult.skippedCount === 1 ? '' : 's'} skipped
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={importing || !effectiveEventId}
                    onClick={handleImportSubmit}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing to Firestore...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Save {parseResult.rows.length} Participants</span>
                      </>
                    )}
                  </button>
                </div>

                {/* First 4 Preview Rows */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 font-mono text-slate-500">
                        <th className="py-1.5 pr-3">Name</th>
                        <th className="py-1.5 pr-3">Email</th>
                        <th className="py-1.5 pr-3">Reg. No</th>
                        <th className="py-1.5 pr-3">Team / College</th>
                        <th className="py-1.5">Portal Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                      {parseResult.rows.slice(0, 4).map((r) => (
                        <tr key={r.email}>
                          <td className="py-1.5 pr-3 font-medium text-slate-900 dark:text-white">
                            {r.name}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-slate-600 dark:text-slate-300">
                            {r.email}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-slate-500">
                            {r.registerNumber || '—'}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                            {r.teamName || r.college || '—'}
                          </td>
                          <td className="py-1.5">
                            {r.matchedUserId ? (
                              <span className="font-mono text-[#009942] dark:text-[#00EA64]">
                                Matched ({r.matchedUserName})
                              </span>
                            ) : (
                              <span className="text-slate-400">External / Unlinked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.rows.length > 4 && (
                    <p className="text-[11px] font-mono text-slate-500 mt-1.5">
                      + {parseResult.rows.length - 4} more participant rows will be imported.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Imported Roster Table + Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterEventId}
              onChange={(e) => {
                setFilterEventId(e.target.value);
                setConfirmClearEventId(null);
              }}
              aria-label="Filter Unstop roster by event"
              className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700"
            >
              <option value="all">All Events ({unstopParticipants.length})</option>
              {events.map((ev) => {
                const count = unstopParticipants.filter((p) => p.eventId === ev.id).length;
                if (count === 0) return null;
                return (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({count})
                  </option>
                );
              })}
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
                placeholder="Search name, email, team..."
                className="h-9 pl-8 pr-3 rounded-lg text-xs bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700 w-56"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="text-slate-600 dark:text-slate-300">
              Showing {rosterStats.total} · Matched {rosterStats.matched} · QR Checked In{' '}
              <strong className="text-[#009942] dark:text-[#00EA64]">{rosterStats.checkedIn}</strong>
            </span>

            {isLead && filterEventId !== 'all' && filteredRoster.length > 0 && (
              confirmClearEventId === filterEventId ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await clearEventUnstopParticipants(filterEventId);
                      setConfirmClearEventId(null);
                    }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirm Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearEventId(null)}
                    className="px-2 py-1 rounded text-[11px] border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearEventId(filterEventId)}
                  className="text-red-500 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Event CSV</span>
                </button>
              )
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] font-mono text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Participant</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Team / College</th>
                <th className="py-3 px-4">Status &amp; Attendance</th>
                {isLead && <th className="py-3 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td
                    colSpan={isLead ? 5 : 4}
                    className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No Unstop CSV participants imported yet. Export registrations from Unstop and
                    upload the CSV above.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((p) => {
                  const uidSet = checkedInLookup.userIdsByEvent.get(p.eventId);
                  const emailSet = checkedInLookup.emailsByEvent.get(p.eventId);
                  const isCheckedIn = Boolean(
                    (p.matchedUserId && uidSet?.has(p.matchedUserId)) ||
                      emailSet?.has(p.email.toLowerCase())
                  );
                  return (
                    <tr key={p.id}>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                        <p className="font-mono text-[11px] text-slate-500">{p.email}</p>
                        {p.registerNumber && (
                          <p className="font-mono text-[11px] text-slate-400">{p.registerNumber}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {p.eventTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {p.teamName && (
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            Team: {p.teamName}
                          </p>
                        )}
                        <p className="truncate max-w-[220px]">{p.college || '—'}</p>
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {p.status || 'Registered'}
                          </span>
                          {p.matchedUserId && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                              <UserCheck className="w-3 h-3" />
                              Portal User
                            </span>
                          )}
                          {isCheckedIn && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                              <CheckCircle2 className="w-3 h-3" />
                              QR Checked In
                            </span>
                          )}
                        </div>
                      </td>
                      {isLead && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteUnstopParticipant(p.id)}
                            aria-label={`Remove ${p.name}`}
                            className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
