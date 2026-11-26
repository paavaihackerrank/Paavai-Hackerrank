import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AttendanceExportMode,
  buildAttendanceCsvContent,
  downloadCsvFile,
} from '../lib/attendanceCsvExport';

export interface AttendanceCsvExportModalProps {
  open: boolean;
  initialEventId?: string;
  onClose: () => void;
}

export const AttendanceCsvExportModal: React.FC<AttendanceCsvExportModalProps> = ({
  open,
  initialEventId = 'all',
  onClose,
}) => {
  const { events, registrations, eventCheckIns, can, addToast } = useApp();
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);
  const [exportMode, setExportMode] = useState<AttendanceExportMode>('full_roster');

  useEffect(() => {
    if (open) {
      setSelectedEventId(initialEventId || 'all');
    }
  }, [open, initialEventId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()),
    [events]
  );

  const checkInCountByEvent = useMemo(() => {
    const map = new Map<string, number>();
    eventCheckIns.forEach((c) => {
      map.set(c.eventId, (map.get(c.eventId) || 0) + 1);
    });
    return map;
  }, [eventCheckIns]);

  const regCountByEvent = useMemo(() => {
    const map = new Map<string, number>();
    registrations.forEach((r) => {
      map.set(r.eventId, (map.get(r.eventId) || 0) + 1);
    });
    return map;
  }, [registrations]);

  const preview = useMemo(
    () =>
      buildAttendanceCsvContent({
        events,
        registrations,
        checkIns: eventCheckIns,
        filterEventId: selectedEventId === 'all' ? undefined : selectedEventId,
        mode: exportMode,
      }),
    [events, registrations, eventCheckIns, selectedEventId, exportMode]
  );

  if (!open) return null;

  const handleDownload = () => {
    if (!can('canExportRegistrations')) {
      addToast(
        'Export restricted',
        'Only the Campus Lead / Admin can export event attendance CSV files.',
        'error'
      );
      return;
    }
    if (preview.totalRows === 0) {
      addToast(
        'No attendance records to export',
        'Select another event or switch to Full Roster once students have registered or checked in.',
        'info'
      );
      return;
    }

    downloadCsvFile(preview.csv, preview.filename);
    addToast(
      'Attendance CSV exported',
      `Downloaded ${preview.totalRows.toLocaleString()} record${preview.totalRows === 1 ? '' : 's'} (${preview.filename}).`,
      'success'
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-csv-export-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64] inline-flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Admin Record Keeping · CSV Export</span>
            </p>
            <h2
              id="attendance-csv-export-title"
              className="font-mono text-lg font-bold text-slate-900 dark:text-white"
            >
              Export Event Attendance Data
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2430] transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Event Scope Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="attendance-export-event-select"
              className="block font-mono text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Select Event Scope
            </label>
            <select
              id="attendance-export-event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              <option value="all">
                All Campus Events ({eventCheckIns.length} checked in · {registrations.length}{' '}
                registered)
              </option>
              {sortedEvents.map((ev) => {
                const cCount = checkInCountByEvent.get(ev.id) || 0;
                const rCount = regCountByEvent.get(ev.id) || 0;
                const dt = new Date(ev.dateISO).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({dt}) — {cCount} present / {rCount} registered
                  </option>
                );
              })}
            </select>
          </div>

          {/* Export Format Mode */}
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
              Attendance Sheet Format
            </p>
            <div
              role="group"
              aria-label="Attendance CSV format"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14]"
            >
              <button
                type="button"
                onClick={() => setExportMode('full_roster')}
                aria-pressed={exportMode === 'full_roster'}
                className={`px-3 py-2 rounded-md text-xs font-mono font-semibold text-left transition-colors ${
                  exportMode === 'full_roster'
                    ? 'bg-[#00EA64] text-[#0B0F14]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Full Roster (Present &amp; Absent)
              </button>
              <button
                type="button"
                onClick={() => setExportMode('checkins_only')}
                aria-pressed={exportMode === 'checkins_only'}
                className={`px-3 py-2 rounded-md text-xs font-mono font-semibold text-left transition-colors ${
                  exportMode === 'checkins_only'
                    ? 'bg-[#00EA64] text-[#0B0F14]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Verified Check-Ins Only
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {exportMode === 'full_roster'
                ? 'Reconciles all RSVPed students against gate QR check-ins, marking each student as Present or Absent for NAAC / department records.'
                : 'Exports only attendees with verified venue QR check-ins and exact check-in timestamps.'}
            </p>
          </div>

          {/* Live Export Summary */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
              <div className="pr-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Rows</p>
                <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                  {preview.totalRows.toLocaleString()}
                </p>
              </div>
              <div className="px-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Present</p>
                <p className="mt-0.5 text-xl font-bold text-[#009942] dark:text-[#00EA64]">
                  {preview.presentCount.toLocaleString()}
                </p>
              </div>
              <div className="pl-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Absent</p>
                <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-300">
                  {preview.absentCount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 space-y-1">
              <p className="truncate">
                File: <span className="text-slate-800 dark:text-slate-200">{preview.filename}</span>
              </p>
              <p>
                Columns: Event Title, Date, Venue, Status, Student Name, Register No., Dept, Year,
                Emails, Phone, Pass Code, Registered &amp; Check-In Timestamps.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0E141C] flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={preview.totalRows === 0}
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {preview.totalRows === 0
                ? 'No Records Available'
                : `Download CSV (${preview.totalRows.toLocaleString()})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCsvExportModal;
