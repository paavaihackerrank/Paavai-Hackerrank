import {
  CampusEvent,
  EventCheckIn,
  EventRegistration,
  buildAttendeeTicketCode,
} from '../config/rbacAndData';

export type AttendanceExportMode = 'checkins_only' | 'full_roster';

export interface AttendanceCsvBuildInput {
  events: CampusEvent[];
  registrations: EventRegistration[];
  checkIns: EventCheckIn[];
  filterEventId?: string;
  mode?: AttendanceExportMode;
}

export interface AttendanceCsvBuildResult {
  csv: string;
  filename: string;
  totalRows: number;
  presentCount: number;
  absentCount: number;
  headers: string[];
}

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/**
 * Neutralizes spreadsheet formula injection (CSV injection) and applies RFC 4180 quoting.
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const trimmed = raw.trim();
  const neutralized = FORMULA_PREFIX_RE.test(trimmed) ? `'${raw}` : raw;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

function slugifyFilenamePart(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'event'
  );
}

function formatReadableTimestamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReadableDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const ATTENDANCE_CSV_HEADERS = [
  'Event Title',
  'Event Category',
  'Event Date',
  'Venue',
  'Attendance Status',
  'Student Name',
  'Register Number',
  'Department',
  'Year',
  'Personal Email',
  'College Email',
  'Phone',
  'Entry Pass / Check-In Code',
  'Registered At',
  'Checked In At',
  'Check-In Record ID',
];

export function buildAttendanceCsvContent({
  events,
  registrations,
  checkIns,
  filterEventId,
  mode = 'checkins_only',
}: AttendanceCsvBuildInput): AttendanceCsvBuildResult {
  const eventById = new Map<string, CampusEvent>(events.map((e) => [e.id, e]));
  const selectedEvent = filterEventId ? eventById.get(filterEventId) : undefined;

  const filteredCheckIns = filterEventId
    ? checkIns.filter((c) => c.eventId === filterEventId)
    : checkIns;
  const filteredRegs = filterEventId
    ? registrations.filter((r) => r.eventId === filterEventId)
    : registrations;

  const regByEventAndUser = new Map<string, EventRegistration>();
  filteredRegs.forEach((reg) => {
    regByEventAndUser.set(`${reg.eventId}::${reg.userId}`, reg);
  });

  const checkInByEventAndUser = new Map<string, EventCheckIn>();
  filteredCheckIns.forEach((chk) => {
    checkInByEventAndUser.set(`${chk.eventId}::${chk.userId}`, chk);
  });

  const dataRows: string[][] = [];
  let presentCount = 0;
  let absentCount = 0;

  if (mode === 'checkins_only') {
    const sorted = [...filteredCheckIns].sort((a, b) =>
      b.checkedInAt.localeCompare(a.checkedInAt)
    );
    sorted.forEach((chk) => {
      const ev = eventById.get(chk.eventId);
      const reg = regByEventAndUser.get(`${chk.eventId}::${chk.userId}`);
      presentCount += 1;
      dataRows.push([
        ev?.title || chk.eventTitle || chk.eventId,
        ev?.category || '',
        formatReadableDate(ev?.dateISO),
        ev?.venue || '',
        'Present',
        chk.userName,
        chk.registerNumber,
        chk.department,
        chk.year,
        chk.userEmail,
        chk.collegeEmail || '',
        chk.phone || '',
        reg?.ticketCode || chk.checkInCode,
        reg?.registeredAt || '',
        formatReadableTimestamp(chk.checkedInAt),
        chk.id,
      ]);
    });
  } else {
    // Full Roster: include every RSVPed student (Present or Absent) plus any checked-in walk-ins
    const seenKeys = new Set<string>();

    const sortedRegs = [...filteredRegs].sort((a, b) => {
      const evCmp = a.eventId.localeCompare(b.eventId);
      if (evCmp !== 0) return evCmp;
      return a.userName.localeCompare(b.userName);
    });

    sortedRegs.forEach((reg) => {
      const key = `${reg.eventId}::${reg.userId}`;
      seenKeys.add(key);
      const ev = eventById.get(reg.eventId);
      const chk = checkInByEventAndUser.get(key);
      const isPresent = Boolean(chk);
      if (isPresent) presentCount += 1;
      else absentCount += 1;

      const passCode =
        reg.ticketCode || chk?.checkInCode || buildAttendeeTicketCode(reg.eventId, reg.userId);

      dataRows.push([
        ev?.title || chk?.eventTitle || reg.eventId,
        ev?.category || '',
        formatReadableDate(ev?.dateISO),
        ev?.venue || '',
        isPresent ? 'Present' : 'Absent',
        chk?.userName || reg.userName,
        chk?.registerNumber || reg.registerNumber,
        chk?.department || reg.department,
        chk?.year || reg.year,
        chk?.userEmail || reg.userEmail,
        chk?.collegeEmail || '',
        chk?.phone || '',
        passCode,
        reg.registeredAt,
        chk ? formatReadableTimestamp(chk.checkedInAt) : '',
        chk?.id || '',
      ]);
    });

    // Include any checked-in attendees without a matching registration doc
    filteredCheckIns.forEach((chk) => {
      const key = `${chk.eventId}::${chk.userId}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      const ev = eventById.get(chk.eventId);
      presentCount += 1;
      dataRows.push([
        ev?.title || chk.eventTitle || chk.eventId,
        ev?.category || '',
        formatReadableDate(ev?.dateISO),
        ev?.venue || '',
        'Present',
        chk.userName,
        chk.registerNumber,
        chk.department,
        chk.year,
        chk.userEmail,
        chk.collegeEmail || '',
        chk.phone || '',
        chk.checkInCode,
        '',
        formatReadableTimestamp(chk.checkedInAt),
        chk.id,
      ]);
    });
  }

  const lines = [
    ATTENDANCE_CSV_HEADERS.map(sanitizeCsvCell).join(','),
    ...dataRows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ];

  // UTF-8 BOM ensures Excel opens Unicode characters cleanly
  const csv = `\uFEFF${lines.join('\r\n')}`;
  const today = new Date().toISOString().slice(0, 10);
  const scopeSlug = selectedEvent
    ? slugifyFilenamePart(selectedEvent.title)
    : filterEventId
      ? slugifyFilenamePart(filterEventId)
      : 'all-events';
  const modeSuffix = mode === 'full_roster' ? 'roster' : 'checkins';
  const filename = `hrcc-paavai-attendance-${scopeSlug}-${modeSuffix}-${today}.csv`;

  return {
    csv,
    filename,
    totalRows: dataRows.length,
    presentCount,
    absentCount,
    headers: ATTENDANCE_CSV_HEADERS,
  };
}

export function downloadCsvFile(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
