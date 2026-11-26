import { UnstopParticipant, UserAccount } from '../config/rbacAndData';

export interface ParsedUnstopRow {
  name: string;
  email: string;
  registerNumber: string;
  college: string;
  teamName: string;
  status: string;
  phone: string;
  matchedUserId?: string;
  matchedUserName?: string;
}

export interface UnstopCsvParseResult {
  rows: ParsedUnstopRow[];
  skippedCount: number;
  duplicateCount: number;
  matchedCount: number;
  detectedHeaders: string[];
  error?: string;
}

/**
 * RFC-4180 compliant CSV parser supporting quoted fields, embedded commas,
 * escaped quotes (""), and CRLF / LF line breaks.
 */
export function parseCsvMatrix(rawCsv: string): string[][] {
  const input = rawCsv.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const exact = normalized.findIndex((h) => h === candidate);
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const partial = normalized.findIndex((h) => h.includes(candidate));
    if (partial >= 0) return partial;
  }
  return -1;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses an Unstop-exported registrations CSV, deduplicates by email,
 * and matches rows against verified Paavai portal accounts.
 */
export function parseUnstopParticipantsCsv(
  rawCsv: string,
  portalUsers: UserAccount[]
): UnstopCsvParseResult {
  const matrix = parseCsvMatrix(rawCsv);
  if (matrix.length < 2) {
    return {
      rows: [],
      skippedCount: 0,
      duplicateCount: 0,
      matchedCount: 0,
      detectedHeaders: matrix[0] || [],
      error: 'CSV must include a header row and at least one participant row.',
    };
  }

  const headers = matrix[0];
  const emailIdx = findColumnIndex(headers, [
    'email',
    'email id',
    'email address',
    'candidate email',
    'participant email',
    'user email',
    'mail',
  ]);
  const nameIdx = findColumnIndex(headers, [
    'name',
    'candidate name',
    'full name',
    'participant name',
    'student name',
    'player name',
    'user name',
  ]);
  const firstNameIdx = findColumnIndex(headers, ['first name', 'firstname']);
  const lastNameIdx = findColumnIndex(headers, ['last name', 'lastname']);
  const regNoIdx = findColumnIndex(headers, [
    'register number',
    'reg no',
    'roll number',
    'roll no',
    'college id',
    'student id',
    'registration number',
    'usn',
  ]);
  const collegeIdx = findColumnIndex(headers, [
    'organisation',
    'organization',
    'college',
    'college name',
    'institute',
    'institution',
    'university',
  ]);
  const teamIdx = findColumnIndex(headers, ['team name', 'team', 'squad']);
  const statusIdx = findColumnIndex(headers, [
    'registration status',
    'status',
    'payment status',
    'round status',
    'state',
  ]);
  const phoneIdx = findColumnIndex(headers, [
    'mobile',
    'phone',
    'contact',
    'phone number',
    'mobile number',
    'whatsapp',
  ]);

  if (emailIdx < 0) {
    return {
      rows: [],
      skippedCount: matrix.length - 1,
      duplicateCount: 0,
      matchedCount: 0,
      detectedHeaders: headers,
      error:
        'Could not locate an Email column. Make sure the Unstop CSV export includes an Email / Candidate Email column.',
    };
  }

  // Build fast lookup maps for Paavai portal accounts
  const userByEmail = new Map<string, UserAccount>();
  const userByRegNo = new Map<string, UserAccount>();
  for (const user of portalUsers) {
    if (user.email) userByEmail.set(user.email.trim().toLowerCase(), user);
    if (user.collegeEmail) userByEmail.set(user.collegeEmail.trim().toLowerCase(), user);
    if (user.regNo) {
      userByRegNo.set(user.regNo.trim().toUpperCase(), user);
    }
  }

  const seenEmails = new Set<string>();
  const parsed: ParsedUnstopRow[] = [];
  let skippedCount = 0;
  let duplicateCount = 0;
  let matchedCount = 0;

  for (let i = 1; i < matrix.length; i += 1) {
    const cols = matrix[i];
    const rawEmail = (cols[emailIdx] || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(rawEmail)) {
      skippedCount += 1;
      continue;
    }
    if (seenEmails.has(rawEmail)) {
      duplicateCount += 1;
      continue;
    }
    seenEmails.add(rawEmail);

    let name = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
    if (!name && (firstNameIdx >= 0 || lastNameIdx >= 0)) {
      const first = firstNameIdx >= 0 ? (cols[firstNameIdx] || '').trim() : '';
      const last = lastNameIdx >= 0 ? (cols[lastNameIdx] || '').trim() : '';
      name = `${first} ${last}`.trim();
    }
    if (!name) {
      name = rawEmail.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Participant';
    }

    const rawReg = regNoIdx >= 0 ? (cols[regNoIdx] || '').trim().toUpperCase() : '';
    const college = collegeIdx >= 0 ? (cols[collegeIdx] || '').trim() : '';
    const teamName = teamIdx >= 0 ? (cols[teamIdx] || '').trim() : '';
    const status = statusIdx >= 0 ? (cols[statusIdx] || '').trim() : 'Registered';
    const rawPhone = phoneIdx >= 0 ? (cols[phoneIdx] || '').replace(/[^\d+\-\s]/g, '').trim() : '';

    const matchedUser =
      userByEmail.get(rawEmail) || (rawReg ? userByRegNo.get(rawReg) : undefined);

    if (matchedUser) {
      matchedCount += 1;
    }

    parsed.push({
      name: name.slice(0, 100),
      email: rawEmail.slice(0, 120),
      registerNumber: (rawReg || matchedUser?.regNo || '').slice(0, 32),
      college: college.slice(0, 160),
      teamName: teamName.slice(0, 100),
      status: (status || 'Registered').slice(0, 60),
      phone: rawPhone.slice(0, 20),
      matchedUserId: matchedUser?.id,
      matchedUserName: matchedUser?.name,
    });
  }

  return {
    rows: parsed,
    skippedCount,
    duplicateCount,
    matchedCount,
    detectedHeaders: headers,
  };
}

/**
 * Deterministic Firestore document ID per (eventId, email) so re-importing an updated
 * Unstop CSV safely upserts existing participants without creating duplicates.
 */
export function buildUnstopParticipantDocId(eventId: string, email: string): string {
  const safeEvent = eventId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const normalizedEmail = email.trim().toLowerCase();
  // Simple FNV-1a 32-bit hash in base36 + slug prefix for readability & uniqueness
  let hash = 2166136261;
  for (let i = 0; i < normalizedEmail.length; i += 1) {
    hash ^= normalizedEmail.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  const localSlug = normalizedEmail
    .split('@')[0]
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);
  return `${safeEvent}_${localSlug || 'user'}_${hashHex}`.slice(0, 120);
}

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) and RFC-4180 quotes values.
 */
function csvEscapeCell(value: string): string {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportUnstopParticipantsCsv(
  participants: UnstopParticipant[],
  checkedInUserIds: Set<string>,
  checkedInEmails: Set<string>,
  fileName: string
): void {
  const headers = [
    'Event',
    'Name',
    'Email',
    'Register Number',
    'College',
    'Team',
    'Unstop Status',
    'Portal Account Matched',
    'QR Checked In',
    'Imported At',
  ];

  const lines = [
    headers.map(csvEscapeCell).join(','),
    ...participants.map((p) => {
      const isCheckedIn =
        (p.matchedUserId && checkedInUserIds.has(p.matchedUserId)) ||
        checkedInEmails.has(p.email.toLowerCase());
      return [
        p.eventTitle,
        p.name,
        p.email,
        p.registerNumber || '',
        p.college || '',
        p.teamName || '',
        p.status || 'Registered',
        p.matchedUserId ? 'Yes' : 'No',
        isCheckedIn ? 'Checked In' : 'Not Checked In',
        p.importedAt,
      ]
        .map(csvEscapeCell)
        .join(',');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
