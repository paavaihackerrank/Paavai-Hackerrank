import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActionCodeSettings,
  User as FirebaseUser,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Announcement,
  CODING_PLATFORMS,
  CampusEvent,
  CertificateAwardType,
  CodingActivity,
  CodingPlatform,
  EmailSendAttempt,
  EventCertificate,
  EventCheckIn,
  EventCheckInCode,
  EventMode,
  EventRegistration,
  GalleryPhoto,
  INITIAL_SITE_SETTINGS,
  JoinRequest,
  LeaderboardEntry,
  LearningResource,
  PermissionKey,
  PracticeSummary,
  PublicProfile,
  ROLE_META,
  SiteSettings,
  TeamMember,
  UnstopParticipant,
  UnstopSyncedEventDetails,
  UserAccount,
  UserRole,
  buildAttendeeTicketCode,
  getDashboardPath,
  getEffectiveEventMode,
  hasPermission,
  isOnlineAttendanceEnabled,
  isOnlineEvent,
} from '../config/rbacAndData';
import {
  CAMPUS_LEAD_EMAIL,
  OperationType,
  auth,
  db,
  handleFirestoreError,
  isBootstrappedAdminEmail,
} from '../lib/firebase';
import { isValidDriveOrHttpsUrl } from '../lib/driveUtils';
import { ParsedUnstopRow, buildUnstopParticipantDocId } from '../lib/unstopCsv';
import { buildAttendanceCsvContent, downloadCsvFile } from '../lib/attendanceCsvExport';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface SignupPayload {
  name: string;
  email: string;
  collegeEmail: string;
  password: string;
  regNo: string;
  department: string;
  year: string;
  phone: string;
  hackerRankHandle: string;
  photoUrl?: string;
  joinReqId?: string;
}

interface PendingSignupMeta {
  name: string;
  collegeEmail: string;
  regNo: string;
  department: string;
  year: string;
  phone: string;
  hackerRankHandle: string;
  photoUrl?: string;
  joinReqId?: string;
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  needsVerification?: boolean;
  role?: Exclude<UserRole, 'outsider'>;
  redirectPath?: string;
}

export interface VerificationDispatchState {
  status: 'idle' | 'sending' | 'sent' | 'failed';
  email: string;
  dispatchedAt?: string;
  error?: string;
  fallbackWarning?: string;
}

interface AppContextValue {
  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Auth & RBAC
  authReady: boolean;
  firebaseUser: FirebaseUser | null;
  needsEmailVerification: boolean;
  unverifiedEmail: string | null;
  verificationDispatchState: VerificationDispatchState;
  currentUser: UserAccount | null;
  currentRole: UserRole;
  can: (permission: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (payload: SignupPayload) => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{
    ok: boolean;
    error?: string;
    rateLimited?: boolean;
    alreadyVerified?: boolean;
    fallbackWarning?: string;
    dispatchedAt?: string;
  }>;
  refreshEmailVerification: () => Promise<AuthActionResult>;
  verifyActionCode: (oobCode: string) => Promise<AuthActionResult>;
  verifyPasswordResetActionCode: (
    oobCode: string
  ) => Promise<{ ok: boolean; email?: string; error?: string }>;
  confirmPasswordResetAction: (
    oobCode: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  syncVerificationAfterRedirect: () => Promise<{
    verified: boolean;
    role?: Exclude<UserRole, 'outsider'>;
    redirectPath?: string;
  }>;
  logout: () => Promise<void>;

  // Live Firestore Data Collections
  siteSettings: SiteSettings;
  users: UserAccount[];
  publicProfiles: PublicProfile[];
  teamMembers: TeamMember[];
  events: CampusEvent[];
  announcements: Announcement[];
  leaderboard: LeaderboardEntry[];
  resources: LearningResource[];
  gallery: GalleryPhoto[];
  registrations: EventRegistration[];
  unstopParticipants: UnstopParticipant[];
  checkInCodes: EventCheckInCode[];
  eventCheckIns: EventCheckIn[];
  certificates: EventCertificate[];
  joinRequests: JoinRequest[];
  completedResourceIds: string[];
  codingActivities: CodingActivity[];
  emailSendAttempts: EmailSendAttempt[];
  refreshEmailSendAttempts: () => Promise<void>;
  deleteEmailSendAttempt: (id: string) => Promise<void>;

  // Actions — Events
  createEvent: (
    event: Omit<CampusEvent, 'id' | 'status' | 'createdByName' | 'createdByRole'>
  ) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CampusEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  approveEvent: (id: string) => Promise<void>;
  rejectEvent: (id: string) => Promise<void>;
  toggleOnlineEventAttendance: (eventId: string, enabled: boolean) => Promise<void>;
  fetchUnstopEventDetails: (
    unstopUrl: string
  ) => Promise<{ ok: boolean; data?: UnstopSyncedEventDetails; error?: string }>;
  syncEventFromUnstop: (
    eventId: string,
    unstopUrlOverride?: string
  ) => Promise<{ ok: boolean; data?: UnstopSyncedEventDetails; error?: string }>;

  // Actions — Announcements
  createAnnouncement: (payload: {
    title: string;
    message: string;
    priority: 'Normal' | 'Important';
  }) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  approveAnnouncement: (id: string) => Promise<void>;
  rejectAnnouncement: (id: string) => Promise<void>;

  // Actions — Registrations, Unstop CSV & QR Check-Ins
  registerForEvent: (eventId: string) => Promise<void>;
  cancelRegistration: (eventId: string) => Promise<void>;
  resendEventTicketEmail: (registrationId: string) => Promise<{
    ok: boolean;
    delivered?: boolean;
    message?: string;
  }>;
  exportRegistrationsCSV: () => void;
  importUnstopParticipants: (
    eventId: string,
    rows: ParsedUnstopRow[]
  ) => Promise<{ ok: boolean; importedCount?: number; error?: string }>;
  deleteUnstopParticipant: (id: string) => Promise<void>;
  clearEventUnstopParticipants: (eventId: string) => Promise<void>;
  generateEventCheckInCode: (
    eventId: string
  ) => Promise<{ ok: boolean; codeDoc?: EventCheckInCode; error?: string }>;
  toggleEventCheckInCodeActive: (code: string, isActive: boolean) => Promise<void>;
  deleteEventCheckInCode: (code: string) => Promise<void>;
  lookupEventCheckInCode: (
    rawCode: string
  ) => Promise<{ ok: boolean; codeDoc?: EventCheckInCode; error?: string }>;
  checkInAttendeeWithCode: (rawCode: string) => Promise<{
    ok: boolean;
    checkIn?: EventCheckIn;
    alreadyCheckedIn?: boolean;
    error?: string;
  }>;
  markOnlineEventAttendance: (eventId: string) => Promise<{
    ok: boolean;
    checkIn?: EventCheckIn;
    alreadyMarked?: boolean;
    error?: string;
  }>;
  crewCheckInAttendeeByTicket: (
    rawInput: string,
    expectedEventId?: string
  ) => Promise<{
    ok: boolean;
    checkIn?: EventCheckIn;
    alreadyCheckedIn?: boolean;
    error?: string;
  }>;
  exportEventCheckInsCSV: (filterEventId?: string) => void;

  // Actions — Verifiable E-Certificates
  claimParticipationCertificate: (eventId: string) => Promise<{
    ok: boolean;
    certificate?: EventCertificate;
    alreadyIssued?: boolean;
    error?: string;
  }>;
  issueEventCertificate: (payload: {
    eventId: string;
    recipientUid?: string;
    recipientName: string;
    registerNumber?: string;
    department?: string;
    awardType: CertificateAwardType;
    awardTitle?: string;
  }) => Promise<{ ok: boolean; certificate?: EventCertificate; error?: string }>;
  issueCertificatesForEventCheckIns: (eventId: string) => Promise<{
    ok: boolean;
    issuedCount?: number;
    skippedCount?: number;
    error?: string;
  }>;
  deleteCertificate: (certId: string) => Promise<void>;
  getCertificateById: (certId: string) => Promise<{
    ok: boolean;
    certificate?: EventCertificate;
    error?: string;
  }>;

  // Actions — Leaderboard
  upsertLeaderboardEntry: (entry: Omit<LeaderboardEntry, 'id'> & { id?: string }) => Promise<void>;
  deleteLeaderboardEntry: (id: string) => Promise<void>;

  // Actions — Gallery & Resources
  addGalleryPhoto: (photo: Omit<GalleryPhoto, 'id' | 'uploadedBy'>) => Promise<void>;
  deleteGalleryPhoto: (id: string) => Promise<void>;
  addResource: (resource: Omit<LearningResource, 'id'>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  toggleResourceCompleted: (resourceId: string) => Promise<void>;
  logCodingActivity: (payload: {
    platform: CodingPlatform;
    date: string;
    count: number;
    title: string;
    notesUrl?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  syncHackerRankPractice: (manualSolvedTotal?: number) => Promise<{
    ok: boolean;
    delta?: number;
    totalSolved?: number;
    source?: 'hackerrank_api' | 'manual_sync';
    corsBlocked?: boolean;
    error?: string;
  }>;
  deleteCodingActivity: (activityId: string) => Promise<void>;

  // Actions — Users, Join Requests & Settings
  updateUserRole: (userId: string, newRole: Exclude<UserRole, 'outsider'>) => Promise<void>;
  updateMemberPhotoUrl: (
    userId: string,
    photoUrl: string
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<void>;
  submitJoinRequest: (
    req: Omit<JoinRequest, 'id' | 'submittedAt' | 'status'>
  ) => Promise<{ ok: boolean; id?: string }>;
  reviewJoinRequest: (
    requestId: string,
    decision: 'approved' | 'rejected',
    options?: { reviewNote?: string; leadPhoneOverride?: string }
  ) => Promise<{
    ok: boolean;
    emailStatus: 'sent' | 'queued' | 'failed';
    emailMessage?: string;
  }>;
  resendJoinRequestEmail: (
    requestId: string,
    options?: { reviewNote?: string; leadPhoneOverride?: string }
  ) => Promise<{
    ok: boolean;
    emailStatus: 'sent' | 'queued' | 'failed';
    emailMessage?: string;
  }>;
  deleteJoinRequest: (requestId: string) => Promise<void>;
  updateSiteSettings: (updates: Partial<SiteSettings>) => Promise<void>;
  updateOwnProfile: (
    updates: Partial<
      Pick<
        UserAccount,
        | 'name'
        | 'regNo'
        | 'department'
        | 'year'
        | 'phone'
        | 'photoUrl'
        | 'documentUrl'
        | 'hackerRankHandle'
        | 'hackerRankUrl'
        | 'githubUrl'
        | 'linkedinUrl'
        | 'bio'
        | 'skills'
      >
    >
  ) => Promise<void>;

  // Notifications
  toasts: ToastMessage[];
  addToast: (title: string, description?: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const clampStr = (val: string, max: number) => val.trim().slice(0, max);

const ensureMinLen = (val: string, fallback: string, minLen: number, maxLen: number) => {
  const cleaned = clampStr(val, maxLen);
  return cleaned.length >= minLen ? cleaned : fallback;
};

const sanitizeId = (raw: string) =>
  raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || `id_${Date.now()}`;

export function isValidOptionalImageUrl(raw?: string | null): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return true;
  if (trimmed.length > 500) return false;
  if (trimmed.startsWith('/src/')) return true;
  return isValidDriveOrHttpsUrl(trimmed);
}

export function sanitizeImageUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.length > 500) return '';
  if (trimmed.startsWith('/src/')) return trimmed;
  if (isValidDriveOrHttpsUrl(trimmed)) return trimmed;
  return '';
}

function sanitizeOptionalDocUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.length > 500) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
}

const PENDING_JOIN_REQ_KEY = 'hrcc_pending_join_req_id';

function computeEventCheckInWindow(dateISO: string): {
  opensAt: Timestamp;
  closesAt: Timestamp;
} {
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(dateISO.trim())
      ? `${dateISO.trim()}T09:00:00`
      : dateISO.trim();
  const parsedMs = Date.parse(normalized);
  const startMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
  const opensAt = Timestamp.fromDate(new Date(startMs - 30 * 60_000));
  const closesAt = Timestamp.fromDate(new Date(startMs + 4 * 60 * 60_000));
  return { opensAt, closesAt };
}

function computeCodingStreak(activities: CodingActivity[], extraDate?: string): number {
  const dates = new Set<string>(activities.map((a) => a.date).filter(Boolean));
  if (extraDate) dates.add(extraDate);
  if (dates.size === 0) return 0;

  const now = new Date();
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!dates.has(toKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (dates.has(toKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return Math.max(streak, dates.size > 0 ? 1 : 0);
}

function toTimestampMs(val: unknown): number | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const ms = new Date(val).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

const RESEND_COOLDOWN_MS = 60_000;

export function getResendCooldownStorageKey(email?: string | null): string {
  return `hrcc_verify_resend_until_${(email || 'current').trim().toLowerCase()}`;
}

export function setResendCooldownTimestamp(email?: string | null, durationMs = RESEND_COOLDOWN_MS) {
  try {
    localStorage.setItem(getResendCooldownStorageKey(email), String(Date.now() + durationMs));
  } catch {
    // Ignore storage errors
  }
}

interface EmailDispatchOutcome {
  continueUrl: string;
  fallbackCode?: string;
  fallbackMessage?: string;
}

const unauthorizedContinueOrigins = new Set<string>();

async function sendVerificationWithRedirect(user: FirebaseUser): Promise<EmailDispatchOutcome> {
  auth.useDeviceLanguage();
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const continueUrl = origin ? `${origin}/verified?verified=true` : '';

  if (continueUrl && !unauthorizedContinueOrigins.has(origin)) {
    const actionCodeSettings: ActionCodeSettings = {
      url: continueUrl,
      handleCodeInApp: false,
    };
    try {
      await sendEmailVerification(user, actionCodeSettings);
      return { continueUrl };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/unauthorized-continue-uri' ||
        code === 'auth/invalid-continue-uri' ||
        code === 'auth/missing-continue-uri'
      ) {
        if (origin) unauthorizedContinueOrigins.add(origin);
        await sendEmailVerification(user);
        return {
          continueUrl,
          fallbackCode: `${code} (fallback_without_continue_url)`,
          fallbackMessage:
            'Custom continue URL domain is not in Firebase Authorized Domains; sent using default Firebase verification redirect.',
        };
      }
      throw err;
    }
  }
  await sendEmailVerification(user);
  return {
    continueUrl: continueUrl || 'default',
    ...(origin && unauthorizedContinueOrigins.has(origin)
      ? {
          fallbackCode: 'cached_fallback_without_continue_url',
          fallbackMessage:
            'Sent using default Firebase verification redirect for this preview origin.',
        }
      : {}),
  };
}

function normalizeEmailAttemptType(raw: unknown): EmailSendAttempt['type'] {
  if (
    raw === 'password_reset' ||
    raw === 'join_request_approved' ||
    raw === 'join_request_rejected'
  ) {
    return raw;
  }
  return 'verification';
}

async function logEmailSendAttempt(entry: {
  type: EmailSendAttempt['type'];
  email: string;
  status: 'sent' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  continueUrl?: string;
  actorUid?: string;
}): Promise<void> {
  try {
    const attemptId = sanitizeId(
      `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
    await setDoc(doc(db, 'emailSendAttempts', attemptId), {
      type: entry.type,
      email: clampStr(entry.email.trim().toLowerCase(), 160),
      status: entry.status,
      errorCode: clampStr(entry.errorCode || '', 160),
      errorMessage: clampStr(entry.errorMessage || '', 500),
      continueUrl: clampStr(entry.continueUrl || '', 400),
      actorUid: clampStr(entry.actorUid || '', 128),
      attemptedAt: new Date().toISOString(),
    });
  } catch (logErr) {
    console.warn('Could not log emailSendAttempt:', logErr);
  }
}

export function isValidAccountEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lower);
}

export function isInstitutionalEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return /@([a-z0-9\-]+\.)*(paavai\.edu\.in|edu\.in|edu|ac\.in)$/i.test(lower);
}

export function isPersonalEmail(email?: string | null): boolean {
  return isValidAccountEmail(email) && !isInstitutionalEmail(email);
}

export function isCollegeEmailId(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return /^[a-z0-9._%+\-]+@([a-z0-9\-]+\.)*paavai\.edu\.in$/.test(lower);
}

export function normalizePhoneNumber(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidPhoneNumber(phone?: string | null): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^\d{10,15}$/.test(normalized);
}

async function sha256Hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getEmailLockId(email: string): Promise<string> {
  return sha256Hex(`email:${email.trim().toLowerCase()}`);
}

export async function getPhoneLockId(phone: string): Promise<string> {
  return sha256Hex(`phone:${normalizePhoneNumber(phone)}`);
}

export async function getCollegeEmailLockId(collegeEmail: string): Promise<string> {
  return sha256Hex(`college_email:${collegeEmail.trim().toLowerCase()}`);
}

export function isAllowedCollegeEmail(email?: string | null): boolean {
  return isValidAccountEmail(email);
}

const PENDING_META_PREFIX = 'hrcc_pending_signup_';

// Legacy demo document IDs & emails removed automatically when Campus Lead connects
const LEGACY_DEMO_USER_IDS = new Set([
  'usr_lead_01',
  'usr_crew_01',
  'usr_student_01',
  'usr_crew_02',
  'usr_student_02',
]);

const LEGACY_DEMO_EMAILS = new Set([
  'lead@paavai.edu.in',
  'crew@paavai.edu.in',
  'student@paavai.edu.in',
  'praveen.crew@paavai.edu.in',
  'nivetha.m@paavai.edu.in',
]);

const LEGACY_DEMO_TEAM_IDS = new Set([
  ...LEGACY_DEMO_USER_IDS,
  'team_01',
  'team_02',
  'team_03',
  'team_04',
  'team_05',
]);

const LEGACY_DEMO_EVENT_IDS = new Set([
  'evt_01',
  'evt_02',
  'evt_03',
  'evt_04',
  'evt_pending_01',
]);

const LEGACY_DEMO_ANNOUNCEMENT_IDS = new Set(['ann_01', 'ann_02', 'ann_pending_01']);

const LEGACY_DEMO_LEADERBOARD_IDS = new Set(
  Array.from({ length: 16 }, (_, idx) => `lb_${String(idx + 1).padStart(2, '0')}`)
);

const LEGACY_DEMO_RESOURCE_IDS = new Set(
  Array.from({ length: 12 }, (_, idx) => `res_${String(idx + 1).padStart(2, '0')}`)
);

const LEGACY_DEMO_GALLERY_IDS = new Set(['gal_01', 'gal_02', 'gal_03', 'gal_04']);
const LEGACY_DEMO_REGISTRATION_IDS = new Set(['reg_01', 'reg_02', 'reg_03']);
const LEGACY_DEMO_JOIN_REQUEST_IDS = new Set(['req_01', 'req_02']);

function readPendingMeta(uid: string): PendingSignupMeta | null {
  try {
    const raw = localStorage.getItem(`${PENDING_META_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as PendingSignupMeta;
  } catch {
    return null;
  }
}

function savePendingMeta(uid: string, meta: PendingSignupMeta): void {
  try {
    localStorage.setItem(`${PENDING_META_PREFIX}${uid}`, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
}

function clearPendingMeta(uid: string): void {
  try {
    localStorage.removeItem(`${PENDING_META_PREFIX}${uid}`);
  } catch {
    // Ignore storage errors
  }
}

function buildTeamMemberPayload(input: {
  uid: string;
  name: string;
  role: 'lead' | 'crew';
  department: string;
  year: string;
  bio: string;
  photoUrl?: string;
  hackerRankHandle: string;
}) {
  return {
    uid: sanitizeId(input.uid),
    name: ensureMinLen(input.name, 'Paavai Coder', 2, 100),
    role: input.role,
    designation: input.role === 'lead' ? 'HackerRank Campus Lead' : 'Campus Crew Member',
    department: ensureMinLen(input.department, 'CSE', 2, 40),
    year: ensureMinLen(input.year, '1st Year', 2, 20),
    bio: clampStr(input.bio || '', 500),
    photoUrl: sanitizeImageUrl(input.photoUrl),
    hackerRankHandle: clampStr(input.hackerRankHandle || '', 60),
    updatedAt: new Date().toISOString(),
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('hrcc_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Firebase Auth state
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<UserAccount | null>(null);
  const [verificationDispatchState, setVerificationDispatchState] =
    useState<VerificationDispatchState>({
      status: 'idle',
      email: '',
    });

  // Live Firestore collections (zero demo/mock fallback data)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [liveUsers, setLiveUsers] = useState<UserAccount[]>([]);
  const [publicProfiles, setPublicProfiles] = useState<PublicProfile[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [unstopParticipants, setUnstopParticipants] = useState<UnstopParticipant[]>([]);
  const [checkInCodes, setCheckInCodes] = useState<EventCheckInCode[]>([]);
  const [eventCheckIns, setEventCheckIns] = useState<EventCheckIn[]>([]);
  const [certificates, setCertificates] = useState<EventCertificate[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [completedResourceIds, setCompletedResourceIds] = useState<string[]>([]);
  const [codingActivities, setCodingActivities] = useState<CodingActivity[]>([]);
  const [emailSendAttempts, setEmailSendAttempts] = useState<EmailSendAttempt[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const cleanupRanForUidRef = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('hrcc_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const addToast = useCallback(
    (title: string, description?: string, variant: ToastVariant = 'success') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper: ensure users/{uid} exists on first verified login & sync team_members for lead/crew
  const ensureUserProfile = useCallback(
    async (fbUser: FirebaseUser): Promise<Exclude<UserRole, 'outsider'>> => {
      const userPath = `users/${fbUser.uid}`;
      const userRef = doc(db, 'users', fbUser.uid);
      try {
        const snap = await getDoc(userRef);
        const isBootAdmin =
          isBootstrappedAdminEmail(fbUser.email) && fbUser.emailVerified;

        if (snap.exists()) {
          const data = snap.data();
          clearPendingMeta(fbUser.uid);
          const shouldPromoteToLead = isBootAdmin && data.role !== 'lead';
          if (data.emailVerified === false || shouldPromoteToLead) {
            await updateDoc(userRef, {
              ...(shouldPromoteToLead ? { role: 'lead' } : {}),
              emailVerified: true,
              updatedAt: new Date().toISOString(),
            });
          }
          const rawRole = data.role as Exclude<UserRole, 'outsider'>;
          const resolvedRole: Exclude<UserRole, 'outsider'> = isBootAdmin
            ? 'lead'
            : rawRole === 'lead' || rawRole === 'crew'
              ? rawRole
              : 'member';

          if (resolvedRole === 'lead' || resolvedRole === 'crew') {
            await setDoc(
              doc(db, 'team_members', fbUser.uid),
              buildTeamMemberPayload({
                uid: fbUser.uid,
                name: String(data.name || fbUser.displayName || 'Paavai Coder'),
                role: resolvedRole,
                department: String(data.department || 'CSE'),
                year: String(data.year || '1st Year'),
                bio: String(data.bio || ''),
                photoUrl: sanitizeImageUrl(String(data.photoUrl || '')),
                hackerRankHandle: String(data.hackerRankHandle || ''),
              })
            );
          }

          const rawEmailLower = String(data.email || fbUser.email || '').trim().toLowerCase();
          const rawPhoneStr = String(data.phone || '');
          const rawCollegeLower = String(data.collegeEmail || '').trim().toLowerCase();
          const lockNowISO = new Date().toISOString();

          if (isValidAccountEmail(rawEmailLower)) {
            const eId = await getEmailLockId(rawEmailLower);
            const eSnap = await getDoc(doc(db, 'unique_emails', eId)).catch(() => null);
            if (eSnap && !eSnap.exists()) {
              await setDoc(doc(db, 'unique_emails', eId), {
                uid: fbUser.uid,
                createdAt: lockNowISO,
              }).catch(() => {});
            }
          }
          if (isValidPhoneNumber(rawPhoneStr)) {
            const pId = await getPhoneLockId(rawPhoneStr);
            const pSnap = await getDoc(doc(db, 'unique_phones', pId)).catch(() => null);
            if (pSnap && !pSnap.exists()) {
              await setDoc(doc(db, 'unique_phones', pId), {
                uid: fbUser.uid,
                createdAt: lockNowISO,
              }).catch(() => {});
            }
          }
          if (isCollegeEmailId(rawCollegeLower)) {
            const cId = await getCollegeEmailLockId(rawCollegeLower);
            const cSnap = await getDoc(doc(db, 'unique_college_emails', cId)).catch(() => null);
            if (cSnap && !cSnap.exists()) {
              await setDoc(doc(db, 'unique_college_emails', cId), {
                uid: fbUser.uid,
                createdAt: lockNowISO,
              }).catch(() => {});
            }
          }

          const joinReqIdToClose =
            (() => {
              try {
                return localStorage.getItem(PENDING_JOIN_REQ_KEY) || '';
              } catch {
                return '';
              }
            })();

          const tryAutoCloseJoinRequest = async () => {
            if (!fbUser.emailVerified) return;
            try {
              if (joinReqIdToClose) {
                const reqRef = doc(db, 'join_requests', sanitizeId(joinReqIdToClose));
                const reqSnap = await getDoc(reqRef).catch(() => null);
                if (reqSnap?.exists() && reqSnap.data()?.status === 'pending') {
                  await updateDoc(reqRef, { status: 'approved' }).catch(() => {});
                }
                try {
                  localStorage.removeItem(PENDING_JOIN_REQ_KEY);
                } catch {
                  // Ignore storage errors
                }
              }
              if (isValidAccountEmail(rawEmailLower)) {
                const matchingSnap = await getDocs(
                  query(collection(db, 'join_requests'), where('email', '==', rawEmailLower))
                ).catch(() => null);
                if (matchingSnap && !matchingSnap.empty) {
                  for (const d of matchingSnap.docs) {
                    if (d.data()?.status === 'pending') {
                      await updateDoc(d.ref, { status: 'approved' }).catch(() => {});
                    }
                  }
                }
              }
            } catch {
              // Non-blocking cleanup
            }
          };

          void tryAutoCloseJoinRequest();

          return resolvedRole;
        }

        const pending = readPendingMeta(fbUser.uid);
        const assignedRole: Exclude<UserRole, 'outsider'> = isBootAdmin ? 'lead' : 'member';
        const nowISO = new Date().toISOString();
        const emailLower = clampStr((fbUser.email || '').toLowerCase(), 160);
        const resolvedCollegeEmail = clampStr(
          (pending?.collegeEmail || (isCollegeEmailId(emailLower) ? emailLower : '')).toLowerCase(),
          160
        );
        const emailPrefix = emailLower.split('@')[0];
        const defaultLeadRegNo = /^\d{6,}$/.test(emailPrefix) ? emailPrefix : '622123104144';

        const newProfileDoc = {
          uid: fbUser.uid,
          email: emailLower,
          ...(resolvedCollegeEmail ? { collegeEmail: resolvedCollegeEmail } : {}),
          name: ensureMinLen(pending?.name || fbUser.displayName || (isBootAdmin ? 'Campus Lead' : 'Paavai Student'), 'Paavai Student', 2, 100),
          regNo: clampStr(
            (pending?.regNo || (isBootAdmin ? defaultLeadRegNo : 'PEC-MEMBER')).toUpperCase(),
            20
          ),
          department: ensureMinLen(pending?.department || 'CSE', 'CSE', 2, 40),
          year: ensureMinLen(pending?.year || (isBootAdmin ? '4th Year' : '1st Year'), '1st Year', 2, 20),
          role: assignedRole,
          emailVerified: true,
          phone: clampStr(pending?.phone || '', 20),
          photoUrl: sanitizeImageUrl(pending?.photoUrl || fbUser.photoURL || ''),
          hackerRankHandle: clampStr(
            pending?.hackerRankHandle ||
              `@${(fbUser.email || 'coder').split('@')[0].slice(0, 20)}`,
            60
          ),
          bio: isBootAdmin
            ? 'HackerRank Campus Lead at Paavai Engineering College.'
            : 'Student Community Member at Paavai Engineering College.',
          skills: ['Problem Solving'],
          joinedAt: nowISO.slice(0, 10),
          createdAt: nowISO,
          updatedAt: nowISO,
        };

        await setDoc(userRef, newProfileDoc);
        if (assignedRole === 'lead') {
          await setDoc(
            doc(db, 'team_members', fbUser.uid),
            buildTeamMemberPayload({
              uid: fbUser.uid,
              name: newProfileDoc.name,
              role: 'lead',
              department: newProfileDoc.department,
              year: newProfileDoc.year,
              bio: newProfileDoc.bio,
              photoUrl: newProfileDoc.photoUrl,
              hackerRankHandle: newProfileDoc.hackerRankHandle,
            })
          );
        }

        if (fbUser.emailVerified) {
          const reqIdFromPending = pending?.joinReqId || (() => {
            try {
              return localStorage.getItem(PENDING_JOIN_REQ_KEY) || '';
            } catch {
              return '';
            }
          })();
          if (reqIdFromPending) {
            const reqRef = doc(db, 'join_requests', sanitizeId(reqIdFromPending));
            const reqSnap = await getDoc(reqRef).catch(() => null);
            if (reqSnap?.exists() && reqSnap.data()?.status === 'pending') {
              await updateDoc(reqRef, { status: 'approved' }).catch(() => {});
            }
            try {
              localStorage.removeItem(PENDING_JOIN_REQ_KEY);
            } catch {
              // Ignore storage errors
            }
          }
        }

        clearPendingMeta(fbUser.uid);
        return assignedRole;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
        return 'member';
      }
    },
    []
  );

  // ---------------- FIREBASE AUTH LISTENER ----------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthReady(true);
      if (!fbUser) {
        setFirebaseProfile(null);
        setCompletedResourceIds([]);
        setCodingActivities([]);
        cleanupRanForUidRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  const isVerifiedAllowedUser = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      isValidAccountEmail(firebaseUser.email)
  );

  const needsEmailVerification = Boolean(
    firebaseUser &&
      !firebaseUser.emailVerified &&
      isValidAccountEmail(firebaseUser.email)
  );

  const unverifiedEmail = needsEmailVerification ? firebaseUser?.email || null : null;

  // Listen to verified signed-in user's Firestore profile (/users/{uid}), progress, & coding activities
  useEffect(() => {
    if (!firebaseUser || !isVerifiedAllowedUser) {
      setFirebaseProfile(null);
      setCompletedResourceIds([]);
      setCodingActivities([]);
      return;
    }

    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);

    const unsubProfile = onSnapshot(
      userRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const role = data.role as Exclude<UserRole, 'outsider'>;
          setFirebaseProfile({
            id: snap.id,
            name: String(data.name || firebaseUser.displayName || 'Paavai Coder'),
            email: String(data.email || firebaseUser.email || ''),
            collegeEmail: data.collegeEmail ? String(data.collegeEmail) : '',
            role: role === 'lead' || role === 'crew' ? role : 'member',
            emailVerified: data.emailVerified !== false,
            regNo: String(data.regNo || data.registerNumber || 'PEC-MEMBER'),
            department: String(data.department || 'CSE'),
            year: String(data.year || '1st Year'),
            phone: String(data.phone || ''),
            photoUrl: sanitizeImageUrl(String(data.photoUrl || '')),
            documentUrl: sanitizeOptionalDocUrl(String(data.documentUrl || '')),
            hackerRankHandle: String(data.hackerRankHandle || '@paavai_coder'),
            hackerRankUrl: data.hackerRankUrl ? String(data.hackerRankUrl) : '',
            githubUrl: data.githubUrl ? String(data.githubUrl) : '',
            linkedinUrl: data.linkedinUrl ? String(data.linkedinUrl) : '',
            bio: String(data.bio || ''),
            skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
            joinedAt: String(data.joinedAt || new Date().toISOString().slice(0, 10)),
            createdAt: data.createdAt ? String(data.createdAt) : undefined,
          });
        } else {
          await ensureUserProfile(firebaseUser);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    const progressPath = `user_progress/${firebaseUser.uid}`;
    const unsubProgress = onSnapshot(
      doc(db, 'user_progress', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCompletedResourceIds(
            Array.isArray(data.completedResourceIds)
              ? data.completedResourceIds.map(String)
              : []
          );
        } else {
          setCompletedResourceIds([]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, progressPath);
      }
    );

    const activitiesQuery = query(
      collection(db, 'coding_activities'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubActivities = onSnapshot(
      activitiesQuery,
      (snap) => {
        const mapped: CodingActivity[] = snap.docs
          .map((d) => {
            const x = d.data();
            const rawPlatform = String(x.platform || 'HackerRank') as CodingPlatform;
            const safePlatform: CodingPlatform = CODING_PLATFORMS.includes(rawPlatform)
              ? rawPlatform
              : 'HackerRank';
            return {
              id: d.id,
              userId: String(x.userId || firebaseUser.uid),
              platform: safePlatform,
              date: String(x.date || ''),
              count: Number(x.count || 1),
              title: String(x.title || ''),
              notesUrl: x.notesUrl ? sanitizeOptionalDocUrl(String(x.notesUrl)) : '',
              createdAt: String(x.createdAt || ''),
            };
          })
          .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)));
        setCodingActivities(mapped);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'coding_activities');
      }
    );

    return () => {
      unsubProfile();
      unsubProgress();
      unsubActivities();
    };
  }, [firebaseUser, isVerifiedAllowedUser, ensureUserProfile]);

  const isRealCampusLead = Boolean(
    isVerifiedAllowedUser &&
      (isBootstrappedAdminEmail(firebaseUser?.email) ||
        firebaseProfile?.role === 'lead')
  );

  const isRealCrewOrLead = Boolean(
    isRealCampusLead || (isVerifiedAllowedUser && firebaseProfile?.role === 'crew')
  );

  // ---------------- FIRESTORE REAL-TIME LISTENERS ----------------
  useEffect(() => {
    if (!authReady) return;

    // 1. Site Settings
    const unsubSettings = onSnapshot(
      doc(db, 'site_settings', 'main'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setSiteSettings({
            chapterName: String(d.chapterName || INITIAL_SITE_SETTINGS.chapterName),
            collegeName: String(d.collegeName || INITIAL_SITE_SETTINGS.collegeName),
            tagline: String(d.tagline || INITIAL_SITE_SETTINGS.tagline),
            contactEmail: String(d.contactEmail || INITIAL_SITE_SETTINGS.contactEmail),
            leadName: String(d.leadName || INITIAL_SITE_SETTINGS.leadName || ''),
            leadPhone: String(d.leadPhone || INITIAL_SITE_SETTINGS.leadPhone || ''),
            campusLocation: String(d.campusLocation || INITIAL_SITE_SETTINGS.campusLocation),
            applicationsOpen: Boolean(d.applicationsOpen ?? true),
            publicLeaderboardLimit: Number(d.publicLeaderboardLimit || 10),
            hackerRankClubUrl: String(
              d.hackerRankClubUrl || INITIAL_SITE_SETTINGS.hackerRankClubUrl
            ),
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'site_settings/main')
    );

    // 2. Public Team Roster (Lead & Crew synced from /users)
    const unsubTeam = onSnapshot(
      collection(db, 'team_members'),
      (snap) => {
        setTeamMembers(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              uid: String(x.uid || d.id),
              name: String(x.name || ''),
              role: x.role === 'lead' ? 'lead' : 'crew',
              designation: String(x.designation || 'Campus Crew Member'),
              department: String(x.department || ''),
              year: String(x.year || ''),
              bio: String(x.bio || ''),
              photoUrl: sanitizeImageUrl(String(x.photoUrl || '')),
              hackerRankHandle: String(x.hackerRankHandle || ''),
              updatedAt: x.updatedAt ? String(x.updatedAt) : undefined,
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'team_members')
    );

    // 3. Events (Crew/Lead see all; others strictly approved)
    const eventsQuery = isRealCrewOrLead
      ? collection(db, 'events')
      : query(collection(db, 'events'), where('status', '==', 'approved'));
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snap) => {
        setEvents(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              title: String(x.title || ''),
              category: (x.category as CampusEvent['category']) || 'Workshop',
              dateISO: String(x.dateISO || new Date().toISOString()),
              venue: String(x.venue || ''),
              description: String(x.description || ''),
              membersOnly: Boolean(x.membersOnly),
              capacity: Number(x.capacity || 100),
              status: (x.status as CampusEvent['status']) || 'approved',
              createdByName: String(x.createdByName || 'Crew'),
              createdByRole: (x.createdByRole as UserRole) || 'crew',
              bannerImage: String(x.bannerImage || ''),
              documentUrl: x.documentUrl ? sanitizeOptionalDocUrl(String(x.documentUrl)) : '',
              unstopUrl: typeof x.unstopUrl === 'string' ? x.unstopUrl : '',
              unstopCompetitionId:
                typeof x.unstopCompetitionId === 'string' ? x.unstopCompetitionId : '',
              unstopRegistrationsCount:
                typeof x.unstopRegistrationsCount === 'number'
                  ? x.unstopRegistrationsCount
                  : undefined,
              unstopViewsCount:
                typeof x.unstopViewsCount === 'number' ? x.unstopViewsCount : undefined,
              unstopDeadline: typeof x.unstopDeadline === 'string' ? x.unstopDeadline : '',
              unstopOrganiser: typeof x.unstopOrganiser === 'string' ? x.unstopOrganiser : '',
              unstopMode: typeof x.unstopMode === 'string' ? x.unstopMode : '',
              unstopPrize: typeof x.unstopPrize === 'string' ? x.unstopPrize : '',
              unstopSyncedAt: typeof x.unstopSyncedAt === 'string' ? x.unstopSyncedAt : '',
              eventMode:
                x.eventMode === 'online' || x.eventMode === 'hybrid' || x.eventMode === 'offline'
                  ? (x.eventMode as EventMode)
                  : undefined,
              attendanceEnabled:
                typeof x.attendanceEnabled === 'boolean' ? x.attendanceEnabled : undefined,
              meetingUrl: typeof x.meetingUrl === 'string' ? x.meetingUrl : '',
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'events')
    );

    // 4. Announcements
    const annQuery = isRealCrewOrLead
      ? collection(db, 'announcements')
      : query(collection(db, 'announcements'), where('status', '==', 'approved'));
    const unsubAnnouncements = onSnapshot(
      annQuery,
      (snap) => {
        setAnnouncements(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              title: String(x.title || ''),
              message: String(x.message || ''),
              date: String(x.date || ''),
              priority: (x.priority as 'Normal' | 'Important') || 'Normal',
              status: (x.status as Announcement['status']) || 'approved',
              createdByName: String(x.createdByName || 'Crew'),
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'announcements')
    );

    // 5. Leaderboard (Dynamically auto-aligned descending by score -> problemsSolved -> eventsAttended)
    const unsubLeaderboard = onSnapshot(
      collection(db, 'leaderboard'),
      (snap) => {
        const mapped: LeaderboardEntry[] = snap.docs.map((d) => {
          const x = d.data();
          const solved = Number(x.solvedCount ?? x.problemsSolved ?? 0);
          return {
            id: d.id,
            uid: x.uid ? String(x.uid) : undefined,
            name: String(x.name || ''),
            registerNumber: String(x.registerNumber || ''),
            department: String(x.department || ''),
            year: String(x.year || ''),
            score: Number(x.score || 0),
            problemsSolved: solved,
            solvedCount: solved,
            eventsAttended: Number(x.eventsAttended || 0),
            rank: typeof x.rank === 'number' ? x.rank : undefined,
            hackerRankHandle: String(x.hackerRankHandle || '@coder'),
          };
        });
        mapped.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
          const evDiff = (b.eventsAttended || 0) - (a.eventsAttended || 0);
          if (evDiff !== 0) return evDiff;
          return a.name.localeCompare(b.name);
        });
        setLeaderboard(
          mapped.map((entry, idx) => ({
            ...entry,
            rank: idx + 1,
          }))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'leaderboard')
    );

    // 6. Resources (Guests & unverified users query only `access == 'basic'`)
    const resourcesQuery = isVerifiedAllowedUser
      ? collection(db, 'resources')
      : query(collection(db, 'resources'), where('access', '==', 'basic'));
    const unsubResources = onSnapshot(
      resourcesQuery,
      (snap) => {
        setResources(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              title: String(x.title || ''),
              track: (x.track as LearningResource['track']) || 'DSA',
              level: (x.level as LearningResource['level']) || 'Beginner',
              access: (x.access as 'basic' | 'full') || 'basic',
              estimatedHours: Number(x.estimatedHours || 5),
              problemCount: Number(x.problemCount || 15),
              summary: String(x.summary || ''),
              url: String(x.url || 'https://www.hackerrank.com'),
              documentUrl: x.documentUrl ? sanitizeOptionalDocUrl(String(x.documentUrl)) : '',
              topics: Array.isArray(x.topics) ? x.topics.map(String) : [],
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'resources')
    );

    // 7. Gallery
    const unsubGallery = onSnapshot(
      collection(db, 'gallery'),
      (snap) => {
        setGallery(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              title: String(x.title || ''),
              category: (x.category as GalleryPhoto['category']) || 'Community',
              date: String(x.date || ''),
              caption: String(x.caption || ''),
              imageUrl: String(x.imageUrl || ''),
              uploadedBy: String(x.uploadedBy || 'Crew'),
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'gallery')
    );

    // 8. Public Non-PII Member Portfolios (for Member Spotlight & Team Member Profiles)
    const unsubPublicProfiles = onSnapshot(
      collection(db, 'public_profiles'),
      (snap) => {
        setPublicProfiles(
          snap.docs.map((d) => {
            const x = d.data();
            const recentRaw = Array.isArray(x.recentPractices) ? x.recentPractices : [];
            const recentPractices: PracticeSummary[] = recentRaw
              .filter((p) => p && typeof p === 'object')
              .slice(0, 10)
              .map((p: Record<string, unknown>) => ({
                title: String(p.title || 'Coding Practice'),
                platform: (CODING_PLATFORMS.includes(String(p.platform) as CodingPlatform)
                  ? String(p.platform)
                  : 'HackerRank') as CodingPlatform,
                date: String(p.date || ''),
                count: Number(p.count || 1),
                ...(p.notesUrl ? { notesUrl: sanitizeOptionalDocUrl(String(p.notesUrl)) } : {}),
              }));
            return {
              id: d.id,
              uid: String(x.uid || d.id),
              name: String(x.name || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              bio: String(x.bio || ''),
              photoUrl: sanitizeImageUrl(String(x.photoUrl || '')),
              documentUrl: sanitizeOptionalDocUrl(String(x.documentUrl || '')),
              skills: Array.isArray(x.skills) ? x.skills.map(String) : [],
              hackerRankHandle: String(x.hackerRankHandle || ''),
              hackerRankUrl: x.hackerRankUrl ? String(x.hackerRankUrl) : '',
              githubUrl: x.githubUrl ? String(x.githubUrl) : '',
              linkedinUrl: x.linkedinUrl ? String(x.linkedinUrl) : '',
              completedDsaCount: Number(x.completedDsaCount || 0),
              completedRoadmapCount: Number(x.completedRoadmapCount || 0),
              hackerRankSolvedCount: Number(x.hackerRankSolvedCount || 0),
              streak: Number(x.streak || 0),
              lastPracticeAt: x.lastPracticeAt ? String(x.lastPracticeAt) : '',
              recentPractices,
              rank: typeof x.rank === 'number' ? x.rank : undefined,
              eventsAttended: Number(x.eventsAttended || 0),
              updatedAt: x.updatedAt ? String(x.updatedAt) : undefined,
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'public_profiles')
    );

    return () => {
      unsubSettings();
      unsubTeam();
      unsubEvents();
      unsubAnnouncements();
      unsubLeaderboard();
      unsubResources();
      unsubGallery();
      unsubPublicProfiles();
    };
  }, [authReady, isVerifiedAllowedUser, isRealCrewOrLead]);

  // Registrations listener (Crew/Lead see all; verified Member sees own)
  useEffect(() => {
    if (!authReady || !firebaseUser || !isVerifiedAllowedUser) {
      setRegistrations([]);
      return;
    }

    const regQuery = isRealCrewOrLead
      ? collection(db, 'registrations')
      : query(collection(db, 'registrations'), where('userId', '==', firebaseUser.uid));

    const unsubRegs = onSnapshot(
      regQuery,
      (snap) => {
        setRegistrations(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              eventId: String(x.eventId || ''),
              userId: String(x.userId || ''),
              userName: String(x.userName || ''),
              userEmail: String(x.userEmail || ''),
              registerNumber: String(x.registerNumber || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              registeredAt: String(x.registeredAt || ''),
              ticketCode: x.ticketCode ? String(x.ticketCode) : undefined,
              ticketEmailStatus:
                x.ticketEmailStatus === 'sent' ||
                x.ticketEmailStatus === 'queued' ||
                x.ticketEmailStatus === 'failed'
                  ? x.ticketEmailStatus
                  : undefined,
              ticketEmailSentAt: x.ticketEmailSentAt ? String(x.ticketEmailSentAt) : undefined,
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'registrations')
    );

    return () => unsubRegs();
  }, [authReady, firebaseUser, isVerifiedAllowedUser, isRealCrewOrLead]);

  // Event Check-In Codes (Crew/Lead only list) & Event Check-Ins (Crew/Lead all; verified Member own)
  useEffect(() => {
    if (!authReady || !firebaseUser || !isVerifiedAllowedUser) {
      setCheckInCodes([]);
      setEventCheckIns([]);
      return;
    }

    let unsubCodes: (() => void) | undefined;
    if (isRealCrewOrLead) {
      unsubCodes = onSnapshot(
        collection(db, 'event_checkin_codes'),
        (snap) => {
          const loaded = snap.docs
            .map((d) => {
              const x = d.data();
              return {
                code: String(x.code || d.id),
                eventId: String(x.eventId || ''),
                eventTitle: String(x.eventTitle || ''),
                venue: String(x.venue || ''),
                isActive: Boolean(x.isActive),
                opensAt: x.opensAt,
                closesAt: x.closesAt,
                createdByUid: String(x.createdByUid || ''),
                createdByName: String(x.createdByName || ''),
                createdAt: String(x.createdAt || ''),
              };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setCheckInCodes(loaded);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'event_checkin_codes')
      );
    } else {
      setCheckInCodes([]);
    }

    const checkInQuery = isRealCrewOrLead
      ? collection(db, 'event_checkins')
      : query(collection(db, 'event_checkins'), where('userId', '==', firebaseUser.uid));

    const unsubCheckIns = onSnapshot(
      checkInQuery,
      (snap) => {
        const loaded = snap.docs
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              checkInCode: String(x.checkInCode || ''),
              eventId: String(x.eventId || ''),
              eventTitle: String(x.eventTitle || ''),
              userId: String(x.userId || ''),
              userName: String(x.userName || ''),
              userEmail: String(x.userEmail || ''),
              collegeEmail: x.collegeEmail ? String(x.collegeEmail) : '',
              registerNumber: String(x.registerNumber || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              phone: x.phone ? String(x.phone) : '',
              checkedInAt: String(x.checkedInAt || ''),
            };
          })
          .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
        setEventCheckIns(loaded);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'event_checkins')
    );

    return () => {
      if (unsubCodes) unsubCodes();
      unsubCheckIns();
    };
  }, [authReady, firebaseUser, isVerifiedAllowedUser, isRealCrewOrLead]);

  // Authenticated listeners: /unstop_participants (Crew/Lead only) & /certificates (Crew/Lead all; Student own)
  useEffect(() => {
    if (!authReady || !firebaseUser || !isVerifiedAllowedUser) {
      setUnstopParticipants([]);
      setCertificates([]);
      return;
    }

    let unsubUnstop: (() => void) | undefined;
    if (isRealCrewOrLead) {
      unsubUnstop = onSnapshot(
        collection(db, 'unstop_participants'),
        (snap) => {
          const loaded: UnstopParticipant[] = snap.docs
            .map((d) => {
              const x = d.data();
              return {
                id: d.id,
                eventId: String(x.eventId || ''),
                eventTitle: String(x.eventTitle || ''),
                name: String(x.name || ''),
                email: String(x.email || ''),
                registerNumber: x.registerNumber ? String(x.registerNumber) : undefined,
                college: x.college ? String(x.college) : undefined,
                teamName: x.teamName ? String(x.teamName) : undefined,
                status: x.status ? String(x.status) : undefined,
                phone: x.phone ? String(x.phone) : undefined,
                matchedUserId: x.matchedUserId ? String(x.matchedUserId) : undefined,
                importedAt: String(x.importedAt || ''),
                importedByUid: String(x.importedByUid || ''),
                importedByName: String(x.importedByName || ''),
              };
            })
            .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
          setUnstopParticipants(loaded);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'unstop_participants')
      );
    } else {
      setUnstopParticipants([]);
    }

    const certQuery = isRealCrewOrLead
      ? collection(db, 'certificates')
      : query(collection(db, 'certificates'), where('recipientUid', '==', firebaseUser.uid));

    const unsubCertificates = onSnapshot(
      certQuery,
      (snap) => {
        const loaded: EventCertificate[] = snap.docs
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              certId: String(x.certId || d.id),
              eventId: String(x.eventId || ''),
              eventTitle: String(x.eventTitle || ''),
              eventDate: String(x.eventDate || ''),
              recipientUid: x.recipientUid ? String(x.recipientUid) : undefined,
              recipientName: String(x.recipientName || ''),
              registerNumber: x.registerNumber ? String(x.registerNumber) : undefined,
              department: x.department ? String(x.department) : undefined,
              awardType: (x.awardType as CertificateAwardType) || 'Participation',
              awardTitle: x.awardTitle ? String(x.awardTitle) : undefined,
              issuedAt: String(x.issuedAt || ''),
              issuedByUid: String(x.issuedByUid || ''),
              issuedByName: String(x.issuedByName || ''),
            };
          })
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
        setCertificates(loaded);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'certificates')
    );

    return () => {
      if (unsubUnstop) unsubUnstop();
      unsubCertificates();
    };
  }, [authReady, firebaseUser, isVerifiedAllowedUser, isRealCrewOrLead]);

  // Lead-only listeners: /users, /join_requests, and /emailSendAttempts
  useEffect(() => {
    if (!authReady || !firebaseUser || !isVerifiedAllowedUser || !isRealCampusLead) {
      setLiveUsers([]);
      setJoinRequests([]);
      setEmailSendAttempts([]);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setLiveUsers(
          snap.docs.map((d) => {
            const x = d.data();
            const role = x.role as Exclude<UserRole, 'outsider'>;
            return {
              id: d.id,
              name: String(x.name || ''),
              email: String(x.email || ''),
              collegeEmail: x.collegeEmail ? String(x.collegeEmail) : '',
              role: role === 'lead' || role === 'crew' ? role : 'member',
              emailVerified: x.emailVerified !== false,
              regNo: String(x.regNo || x.registerNumber || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              phone: String(x.phone || ''),
              photoUrl: sanitizeImageUrl(String(x.photoUrl || '')),
              documentUrl: sanitizeOptionalDocUrl(String(x.documentUrl || '')),
              hackerRankHandle: String(x.hackerRankHandle || ''),
              hackerRankUrl: x.hackerRankUrl ? String(x.hackerRankUrl) : '',
              githubUrl: x.githubUrl ? String(x.githubUrl) : '',
              linkedinUrl: x.linkedinUrl ? String(x.linkedinUrl) : '',
              bio: String(x.bio || ''),
              skills: Array.isArray(x.skills) ? x.skills.map(String) : [],
              joinedAt: String(x.joinedAt || ''),
              createdAt: x.createdAt ? String(x.createdAt) : undefined,
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubJoinReqs = onSnapshot(
      collection(db, 'join_requests'),
      (snap) => {
        setJoinRequests(
          snap.docs
            .map((d) => {
              const x = d.data();
              const rawEmailStatus = x.emailNotificationStatus;
              const emailNotificationStatus: JoinRequest['emailNotificationStatus'] =
                rawEmailStatus === 'sent' ||
                rawEmailStatus === 'queued' ||
                rawEmailStatus === 'failed'
                  ? rawEmailStatus
                  : undefined;
              return {
                id: d.id,
                name: String(x.name || ''),
                registerNumber: String(x.registerNumber || ''),
                department: String(x.department || ''),
                year: String(x.year || ''),
                email: String(x.email || ''),
                phone: String(x.phone || ''),
                skills: String(x.skills || ''),
                submittedAt: String(x.submittedAt || ''),
                status: (x.status as JoinRequest['status']) || 'pending',
                reviewedAt: x.reviewedAt ? String(x.reviewedAt) : undefined,
                reviewedByUid: x.reviewedByUid ? String(x.reviewedByUid) : undefined,
                reviewNote: x.reviewNote ? String(x.reviewNote) : undefined,
                emailNotificationStatus,
                emailSentAt: x.emailSentAt ? String(x.emailSentAt) : undefined,
                emailError: x.emailError ? String(x.emailError) : undefined,
              };
            })
            .sort((a, b) => b.id.localeCompare(a.id))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'join_requests')
    );

    const unsubEmailLogs = onSnapshot(
      collection(db, 'emailSendAttempts'),
      (snap) => {
        const mapped: EmailSendAttempt[] = snap.docs
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              type: normalizeEmailAttemptType(x.type),
              email: String(x.email || ''),
              status: (x.status === 'failed' ? 'failed' : 'sent') as EmailSendAttempt['status'],
              errorCode: x.errorCode ? String(x.errorCode) : undefined,
              errorMessage: x.errorMessage ? String(x.errorMessage) : undefined,
              continueUrl: x.continueUrl ? String(x.continueUrl) : undefined,
              actorUid: x.actorUid ? String(x.actorUid) : undefined,
              attemptedAt: String(x.attemptedAt || ''),
            };
          })
          .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
        setEmailSendAttempts(mapped);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'emailSendAttempts')
    );

    return () => {
      unsubUsers();
      unsubJoinReqs();
      unsubEmailLogs();
    };
  }, [authReady, firebaseUser, isVerifiedAllowedUser, isRealCampusLead]);

  // Once-per-session Lead cleanup: purge any leftover demo records in Firestore & sync team_members
  useEffect(() => {
    if (!authReady || !firebaseUser || !isRealCampusLead) return;
    if (cleanupRanForUidRef.current === firebaseUser.uid) return;
    cleanupRanForUidRef.current = firebaseUser.uid;

    let cancelled = false;

    (async () => {
      try {
        const [
          usersSnap,
          teamSnap,
          publicProfilesSnap,
          regsSnap,
          joinSnap,
          lbSnap,
          eventsSnap,
          annSnap,
          galSnap,
          resSnap,
          emailLogsSnap,
        ] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'team_members')),
          getDocs(collection(db, 'public_profiles')),
          getDocs(collection(db, 'registrations')),
          getDocs(collection(db, 'join_requests')),
          getDocs(collection(db, 'leaderboard')),
          getDocs(collection(db, 'events')),
          getDocs(collection(db, 'announcements')),
          getDocs(collection(db, 'gallery')),
          getDocs(collection(db, 'resources')),
          getDocs(collection(db, 'emailSendAttempts')),
        ]);

        if (cancelled) return;

        const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
        const purgedUserIds = new Set<string>(LEGACY_DEMO_USER_IDS);
        const realTeamMap = new Map<
          string,
          {
            uid: string;
            name: string;
            role: 'lead' | 'crew';
            department: string;
            year: string;
            bio: string;
            photoUrl: string;
            hackerRankHandle: string;
          }
        >();

        const backfillLocks: Array<{
          uid: string;
          email: string;
          phone: string;
          collegeEmail: string;
        }> = [];
        const purgeLocks: Array<{ email: string; phone: string; collegeEmail: string }> = [];

        usersSnap.docs.forEach((d) => {
          const x = d.data();
          const email = String(x.email || '').trim().toLowerCase();
          const rawCollegeEmail = String(
            x.collegeEmail || (isCollegeEmailId(email) ? email : '')
          )
            .trim()
            .toLowerCase();
          const rawPhone = String(x.phone || '');
          const isDemoUser =
            LEGACY_DEMO_USER_IDS.has(d.id) || LEGACY_DEMO_EMAILS.has(email);

          if (isDemoUser && d.id !== firebaseUser.uid) {
            purgedUserIds.add(d.id);
            ops.push((b) => b.delete(d.ref));
            purgeLocks.push({ email, phone: rawPhone, collegeEmail: rawCollegeEmail });
            return;
          }

          backfillLocks.push({
            uid: d.id,
            email,
            phone: rawPhone,
            collegeEmail: rawCollegeEmail,
          });

          const role = x.role as Exclude<UserRole, 'outsider'>;
          if (role === 'lead' || role === 'crew') {
            realTeamMap.set(d.id, {
              uid: d.id,
              name: String(x.name || 'Paavai Coder'),
              role,
              department: String(x.department || 'CSE'),
              year: String(x.year || '1st Year'),
              bio: String(x.bio || ''),
              photoUrl: sanitizeImageUrl(String(x.photoUrl || '')),
              hackerRankHandle: String(x.hackerRankHandle || ''),
            });
          }
        });

        // Backfill missing uniqueness lock docs for active verified users & remove purged locks
        const nowLockISO = new Date().toISOString();
        for (const item of backfillLocks) {
          if (isValidAccountEmail(item.email)) {
            const eId = await getEmailLockId(item.email);
            const eRef = doc(db, 'unique_emails', eId);
            const eSnap = await getDoc(eRef);
            if (!eSnap.exists()) {
              ops.push((b) => b.set(eRef, { uid: item.uid, createdAt: nowLockISO }));
            }
          }
          if (isValidPhoneNumber(item.phone)) {
            const pId = await getPhoneLockId(item.phone);
            const pRef = doc(db, 'unique_phones', pId);
            const pSnap = await getDoc(pRef);
            if (!pSnap.exists()) {
              ops.push((b) => b.set(pRef, { uid: item.uid, createdAt: nowLockISO }));
            }
          }
          if (isCollegeEmailId(item.collegeEmail)) {
            const cId = await getCollegeEmailLockId(item.collegeEmail);
            const cRef = doc(db, 'unique_college_emails', cId);
            const cSnap = await getDoc(cRef);
            if (!cSnap.exists()) {
              ops.push((b) => b.set(cRef, { uid: item.uid, createdAt: nowLockISO }));
            }
          }
        }
        for (const purged of purgeLocks) {
          if (isValidAccountEmail(purged.email)) {
            const eId = await getEmailLockId(purged.email);
            ops.push((b) => b.delete(doc(db, 'unique_emails', eId)));
          }
          if (isValidPhoneNumber(purged.phone)) {
            const pId = await getPhoneLockId(purged.phone);
            ops.push((b) => b.delete(doc(db, 'unique_phones', pId)));
          }
          if (isCollegeEmailId(purged.collegeEmail)) {
            const cId = await getCollegeEmailLockId(purged.collegeEmail);
            ops.push((b) => b.delete(doc(db, 'unique_college_emails', cId)));
          }
        }

        // Remove stale/demo/purged public_profiles docs
        publicProfilesSnap.docs.forEach((d) => {
          if (purgedUserIds.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        // Remove emailSendAttempts for legacy demo accounts
        emailLogsSnap.docs.forEach((d) => {
          const x = d.data();
          const logEmail = String(x.email || '').trim().toLowerCase();
          if (LEGACY_DEMO_EMAILS.has(logEmail)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        // Remove stale/demo team_members docs
        teamSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_TEAM_IDS.has(d.id) || !realTeamMap.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        // Upsert active real Lead & Crew members into team_members
        realTeamMap.forEach((member, uid) => {
          const existingDoc = teamSnap.docs.find((t) => t.id === uid);
          const existingData = existingDoc?.data();
          const needsSync =
            !existingDoc ||
            existingData?.name !== ensureMinLen(member.name, 'Paavai Coder', 2, 100) ||
            existingData?.role !== member.role ||
            existingData?.department !== ensureMinLen(member.department, 'CSE', 2, 40) ||
            existingData?.year !== ensureMinLen(member.year, '1st Year', 2, 20) ||
            existingData?.bio !== clampStr(member.bio || '', 500) ||
            String(existingData?.photoUrl || '') !== sanitizeImageUrl(member.photoUrl) ||
            existingData?.hackerRankHandle !== clampStr(member.hackerRankHandle || '', 60);

          if (needsSync) {
            ops.push((b) =>
              b.set(doc(db, 'team_members', uid), buildTeamMemberPayload(member))
            );
          }
        });

        regsSnap.docs.forEach((d) => {
          const x = d.data();
          const userId = String(x.userId || '');
          const userEmail = String(x.userEmail || '').trim().toLowerCase();
          if (
            LEGACY_DEMO_REGISTRATION_IDS.has(d.id) ||
            purgedUserIds.has(userId) ||
            LEGACY_DEMO_EMAILS.has(userEmail)
          ) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        joinSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_JOIN_REQUEST_IDS.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        lbSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_LEADERBOARD_IDS.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        eventsSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_EVENT_IDS.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        annSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_ANNOUNCEMENT_IDS.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        galSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_GALLERY_IDS.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        resSnap.docs.forEach((d) => {
          if (LEGACY_DEMO_RESOURCE_IDS.has(d.id)) {
            ops.push((b) => b.delete(d.ref));
          }
        });

        // Execute in chunks of 400 operations
        for (let i = 0; i < ops.length; i += 400) {
          const batch = writeBatch(db);
          ops.slice(i, i + 400).forEach((apply) => apply(batch));
          await batch.commit();
        }
      } catch (err) {
        console.warn('Firestore legacy demo cleanup skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser, isRealCampusLead]);

  // Keep public /team_members collection synced automatically whenever Lead or Crew profile data changes
  useEffect(() => {
    if (!authReady || !firebaseUser || !isVerifiedAllowedUser || !firebaseProfile) return;
    if (firebaseProfile.role !== 'lead' && firebaseProfile.role !== 'crew') return;

    const existing = teamMembers.find((tm) => tm.uid === firebaseProfile.id);
    const desiredName = ensureMinLen(firebaseProfile.name, 'Paavai Coder', 2, 100);
    const desiredDept = ensureMinLen(firebaseProfile.department, 'CSE', 2, 40);
    const desiredYear = ensureMinLen(firebaseProfile.year, '1st Year', 2, 20);
    const desiredBio = clampStr(firebaseProfile.bio || '', 500);
    const desiredPhoto = sanitizeImageUrl(firebaseProfile.photoUrl);
    const desiredHandle = clampStr(firebaseProfile.hackerRankHandle || '', 60);

    const outOfSync =
      !existing ||
      existing.name !== desiredName ||
      existing.role !== firebaseProfile.role ||
      existing.department !== desiredDept ||
      existing.year !== desiredYear ||
      existing.bio !== desiredBio ||
      (existing.photoUrl || '') !== desiredPhoto ||
      existing.hackerRankHandle !== desiredHandle;

    if (outOfSync) {
      void setDoc(
        doc(db, 'team_members', firebaseProfile.id),
        buildTeamMemberPayload({
          uid: firebaseProfile.id,
          name: desiredName,
          role: firebaseProfile.role,
          department: desiredDept,
          year: desiredYear,
          bio: desiredBio,
          photoUrl: desiredPhoto,
          hackerRankHandle: desiredHandle,
        })
      ).catch(() => {});
    }
  }, [authReady, firebaseUser, isVerifiedAllowedUser, firebaseProfile, teamMembers]);

  // Lead continuous roster reconciliation: ensures promoted Crew & Lead always exist in public /team_members
  useEffect(() => {
    if (!authReady || !firebaseUser || !isRealCampusLead || liveUsers.length === 0) return;

    const expectedTeam = liveUsers.filter(
      (u) =>
        (u.role === 'lead' || u.role === 'crew') &&
        !LEGACY_DEMO_USER_IDS.has(u.id) &&
        !LEGACY_DEMO_EMAILS.has((u.email || '').toLowerCase())
    );
    const existingByUid = new Map(teamMembers.map((tm) => [tm.uid, tm]));
    const expectedUids = new Set(expectedTeam.map((u) => u.id));

    const toUpsert = expectedTeam.filter((u) => {
      const existing = existingByUid.get(u.id);
      if (!existing) return true;
      return (
        existing.name !== ensureMinLen(u.name, 'Paavai Coder', 2, 100) ||
        existing.role !== u.role ||
        existing.department !== ensureMinLen(u.department, 'CSE', 2, 40) ||
        existing.year !== ensureMinLen(u.year, '1st Year', 2, 20) ||
        existing.bio !== clampStr(u.bio || '', 500) ||
        (existing.photoUrl || '') !== sanitizeImageUrl(u.photoUrl) ||
        existing.hackerRankHandle !== clampStr(u.hackerRankHandle || '', 60)
      );
    });

    const toDelete = teamMembers.filter((tm) => !expectedUids.has(tm.uid));
    if (toUpsert.length === 0 && toDelete.length === 0) return;

    const batch = writeBatch(db);
    toUpsert.forEach((u) => {
      batch.set(
        doc(db, 'team_members', u.id),
        buildTeamMemberPayload({
          uid: u.id,
          name: u.name,
          role: u.role as 'lead' | 'crew',
          department: u.department,
          year: u.year,
          bio: u.bio,
          photoUrl: u.photoUrl,
          hackerRankHandle: u.hackerRankHandle,
        })
      );
    });
    toDelete.forEach((tm) => {
      batch.delete(doc(db, 'team_members', tm.id));
    });
    void batch.commit().catch(() => {});
  }, [authReady, firebaseUser, isRealCampusLead, liveUsers, teamMembers]);

  // ---------------- ACTIVE USER & ROLE RESOLUTION ----------------
  const currentUser = useMemo<UserAccount | null>(() => {
    return isVerifiedAllowedUser ? firebaseProfile : null;
  }, [firebaseProfile, isVerifiedAllowedUser]);

  const currentRole: UserRole = useMemo(() => {
    if (!isVerifiedAllowedUser) return 'outsider';
    if (isBootstrappedAdminEmail(firebaseUser?.email)) {
      return 'lead';
    }
    if (firebaseProfile) return firebaseProfile.role;
    return 'member';
  }, [firebaseProfile, firebaseUser, isVerifiedAllowedUser]);

  const can = useCallback(
    (permission: PermissionKey): boolean => hasPermission(currentRole, permission),
    [currentRole]
  );

  const users = isRealCampusLead ? liveUsers : [];

  const resolvedTeamMembers = useMemo<TeamMember[]>(() => {
    if (!isRealCampusLead || liveUsers.length === 0) {
      return teamMembers;
    }
    const existingByUid = new Map(teamMembers.map((tm) => [tm.uid, tm]));
    return liveUsers
      .filter(
        (u) =>
          (u.role === 'lead' || u.role === 'crew') &&
          !LEGACY_DEMO_USER_IDS.has(u.id) &&
          !LEGACY_DEMO_EMAILS.has((u.email || '').toLowerCase())
      )
      .map((u) => {
        const tm = existingByUid.get(u.id);
        return {
          id: u.id,
          uid: u.id,
          name: ensureMinLen(u.name, tm?.name || 'Paavai Coder', 2, 100),
          role: u.role as 'lead' | 'crew',
          designation:
            u.role === 'lead' ? 'HackerRank Campus Lead' : 'Campus Crew Member',
          department: ensureMinLen(u.department, tm?.department || 'CSE', 2, 40),
          year: ensureMinLen(u.year, tm?.year || '1st Year', 2, 20),
          bio: clampStr(u.bio || tm?.bio || '', 500),
          photoUrl: sanitizeImageUrl(u.photoUrl || tm?.photoUrl || ''),
          hackerRankHandle: clampStr(
            u.hackerRankHandle || tm?.hackerRankHandle || '',
            60
          ),
          updatedAt: tm?.updatedAt,
        };
      });
  }, [isRealCampusLead, liveUsers, teamMembers]);

  // ---------------- FIREBASE AUTH ACTIONS ----------------
  const login = async (email: string, password: string): Promise<AuthActionResult> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidAccountEmail(trimmedEmail)) {
      return {
        ok: false,
        error: 'Enter a valid registered email address.',
      };
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      await reload(cred.user);

      if (!cred.user.emailVerified) {
        setFirebaseUser(cred.user);
        addToast(
          'Email verification required',
          `Check ${cred.user.email} and click the verification link to unlock your dashboard.`,
          'info'
        );
        return { ok: true, needsVerification: true };
      }

      const role = await ensureUserProfile(cred.user);
      addToast('Signed in', `Welcome! Redirecting to ${ROLE_META[role].label} dashboard.`, 'success');
      return { ok: true, role, redirectPath: getDashboardPath(role) };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        return {
          ok: false,
          error:
            'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method.',
        };
      }
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        return { ok: false, error: 'Invalid email or password.' };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to sign in.',
      };
    }
  };

  const signup = async (payload: SignupPayload): Promise<AuthActionResult> => {
    const trimmedEmail = payload.email.trim().toLowerCase();
    const trimmedCollegeEmail = payload.collegeEmail.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(payload.phone);

    if (!isValidAccountEmail(trimmedEmail)) {
      return {
        ok: false,
        error: 'Enter a valid personal email address for your login and verification emails.',
      };
    }
    if (isInstitutionalEmail(trimmedEmail)) {
      return {
        ok: false,
        error:
          'Institutional email addresses (@paavai.edu.in / .edu.in) cannot be used for login. Please enter a personal email address (e.g. @gmail.com, @outlook.com).',
      };
    }
    if (!isCollegeEmailId(trimmedCollegeEmail)) {
      return {
        ok: false,
        error: 'Enter a valid @paavai.edu.in college email ID.',
      };
    }
    if (!isValidPhoneNumber(normalizedPhone)) {
      return {
        ok: false,
        error: 'Enter a valid 10-digit phone number.',
      };
    }
    if (!isValidOptionalImageUrl(payload.photoUrl)) {
      return {
        ok: false,
        error: 'Profile image URL must start with https:// or http:// (max 500 characters).',
      };
    }

    try {
      const [emailLockId, phoneLockId, collegeEmailLockId] = await Promise.all([
        getEmailLockId(trimmedEmail),
        getPhoneLockId(normalizedPhone),
        getCollegeEmailLockId(trimmedCollegeEmail),
      ]);

      const [emailLockSnap, phoneLockSnap, collegeEmailLockSnap] = await Promise.all([
        getDoc(doc(db, 'unique_emails', emailLockId)),
        getDoc(doc(db, 'unique_phones', phoneLockId)),
        getDoc(doc(db, 'unique_college_emails', collegeEmailLockId)),
      ]);

      const emailExists = emailLockSnap.exists();
      const phoneExists = phoneLockSnap.exists();
      const collegeEmailExists = collegeEmailLockSnap.exists();

      if (emailExists || phoneExists || collegeEmailExists) {
        const matchedFields: string[] = [];
        if (emailExists) matchedFields.push('email address');
        if (phoneExists) matchedFields.push('phone number');
        if (collegeEmailExists) matchedFields.push('college email ID');
        const msg = `An account with these credentials (${matchedFields.join(', ')}) already exists in the database. Please sign in or try using other data.`;
        addToast('Account already exists', msg, 'error');
        return { ok: false, error: msg };
      }

      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, payload.password);
      setVerificationDispatchState({
        status: 'sending',
        email: trimmedEmail,
      });

      const nowISO = new Date().toISOString();
      let emailClaimed = false;
      let phoneClaimed = false;
      let collegeEmailClaimed = false;

      // Claim all 3 uniqueness locks in parallel so verification email dispatches without delay
      const [emailLockRes, phoneLockRes, collegeLockRes] = await Promise.allSettled([
        setDoc(doc(db, 'unique_emails', emailLockId), {
          uid: cred.user.uid,
          createdAt: nowISO,
        }),
        setDoc(doc(db, 'unique_phones', phoneLockId), {
          uid: cred.user.uid,
          createdAt: nowISO,
        }),
        setDoc(doc(db, 'unique_college_emails', collegeEmailLockId), {
          uid: cred.user.uid,
          createdAt: nowISO,
        }),
      ]);

      emailClaimed = emailLockRes.status === 'fulfilled';
      phoneClaimed = phoneLockRes.status === 'fulfilled';
      collegeEmailClaimed = collegeLockRes.status === 'fulfilled';

      if (!emailClaimed || !phoneClaimed || !collegeEmailClaimed) {
        setVerificationDispatchState({ status: 'idle', email: '' });
        await Promise.all([
          emailClaimed
            ? deleteDoc(doc(db, 'unique_emails', emailLockId)).catch(() => {})
            : Promise.resolve(),
          phoneClaimed
            ? deleteDoc(doc(db, 'unique_phones', phoneLockId)).catch(() => {})
            : Promise.resolve(),
          collegeEmailClaimed
            ? deleteDoc(doc(db, 'unique_college_emails', collegeEmailLockId)).catch(() => {})
            : Promise.resolve(),
        ]);
        await cred.user.delete().catch(() => {});
        const duplicateField = !emailClaimed
          ? 'email address'
          : !phoneClaimed
            ? 'phone number'
            : 'college email ID';
        const dupMsg = `An account with these credentials (${duplicateField}) already exists in the database. Please sign in or try using other data.`;
        addToast('Account already exists', dupMsg, 'error');
        return { ok: false, error: dupMsg };
      }

      const pendingMeta: PendingSignupMeta = {
        name: ensureMinLen(payload.name, 'Paavai Student', 2, 100),
        collegeEmail: clampStr(trimmedCollegeEmail, 160),
        regNo: clampStr((payload.regNo || 'PEC-MEMBER').toUpperCase(), 20),
        department: ensureMinLen(payload.department, 'CSE', 2, 40),
        year: ensureMinLen(payload.year, '1st Year', 2, 20),
        phone: clampStr(normalizedPhone, 20),
        photoUrl: sanitizeImageUrl(payload.photoUrl),
        hackerRankHandle: clampStr(
          payload.hackerRankHandle || `@${trimmedEmail.split('@')[0].slice(0, 20)}`,
          60
        ),
        ...(payload.joinReqId ? { joinReqId: sanitizeId(payload.joinReqId) } : {}),
      };

      savePendingMeta(cred.user.uid, pendingMeta);

      // Dispatch verification email immediately alongside Auth profile update and unverified user persistence
      const verifyPromise = (async () => {
        try {
          const dispatchOutcome = await sendVerificationWithRedirect(cred.user);
          const dispatchedAt = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setResendCooldownTimestamp(trimmedEmail);
          setVerificationDispatchState({
            status: 'sent',
            email: trimmedEmail,
            dispatchedAt,
            fallbackWarning: dispatchOutcome.fallbackMessage,
          });
          void logEmailSendAttempt({
            type: 'verification',
            email: trimmedEmail,
            status: 'sent',
            errorCode: dispatchOutcome.fallbackCode,
            errorMessage: dispatchOutcome.fallbackMessage,
            continueUrl: dispatchOutcome.continueUrl,
            actorUid: cred.user.uid,
          });
          return { sent: true as const, errorMsg: '' };
        } catch (mailErr: unknown) {
          console.error('Failed to send initial verification email:', mailErr);
          const mailCode = (mailErr as { code?: string })?.code || 'unknown';
          if (mailCode === 'auth/too-many-requests') {
            setResendCooldownTimestamp(trimmedEmail);
          }
          const emailErrorMsg =
            mailCode === 'auth/too-many-requests'
              ? 'Too many verification requests. Please wait a few minutes and try again.'
              : mailErr instanceof Error
                ? mailErr.message
                : 'Could not send verification email.';
          setVerificationDispatchState({
            status: 'failed',
            email: trimmedEmail,
            error: emailErrorMsg,
          });
          void logEmailSendAttempt({
            type: 'verification',
            email: trimmedEmail,
            status: 'failed',
            errorCode: mailCode,
            errorMessage: emailErrorMsg,
            continueUrl:
              typeof window !== 'undefined' && window.location?.origin
                ? `${window.location.origin}/verified?verified=true`
                : 'default',
            actorUid: cred.user.uid,
          });
          return { sent: false as const, errorMsg: emailErrorMsg };
        }
      })();

      const profileSavePromise = Promise.all([
        updateProfile(cred.user, { displayName: clampStr(payload.name, 100) }).catch(() => {}),
        setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: clampStr(trimmedEmail, 160),
          collegeEmail: pendingMeta.collegeEmail,
          name: pendingMeta.name,
          regNo: pendingMeta.regNo,
          department: pendingMeta.department,
          year: pendingMeta.year,
          role: 'member',
          emailVerified: false,
          phone: pendingMeta.phone,
          photoUrl: pendingMeta.photoUrl || '',
          hackerRankHandle: pendingMeta.hackerRankHandle,
          bio: 'Student Community Member at Paavai Engineering College.',
          skills: ['Problem Solving'],
          joinedAt: nowISO.slice(0, 10),
          createdAt: nowISO,
          updatedAt: nowISO,
        }).catch((writeErr) => {
          console.warn('Could not persist unverified user record:', writeErr);
        }),
      ]);

      const [emailResult] = await Promise.all([verifyPromise, profileSavePromise]);

      setFirebaseUser(cred.user);

      if (emailResult.sent) {
        addToast(
          'Verification email sent',
          `Check ${trimmedEmail} (including Spam/Promotions) for your verification link to activate your account within 12 hours.`,
          'success'
        );
      } else {
        addToast(
          'Failed to send verification email',
          `${emailResult.errorMsg} Click "Resend Verification Email" to send it again.`,
          'error'
        );
      }
      return { ok: true, needsVerification: true };
    } catch (err: unknown) {
      setVerificationDispatchState({ status: 'idle', email: '' });
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        return {
          ok: false,
          error:
            'Email/Password sign-up is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method.',
        };
      }
      if (code === 'auth/email-already-in-use') {
        return {
          ok: false,
          error:
            'A user with this personal email is already found in the database. Try using other data or sign in.',
        };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not create account.',
      };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ ok: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidAccountEmail(trimmedEmail)) {
      return {
        ok: false,
        error: 'Enter your registered personal email address.',
      };
    }
    const continueUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/login?reset=success`
        : 'default';
    let fallbackCode: string | undefined;
    let fallbackMessage: string | undefined;

    try {
      auth.useDeviceLanguage();
      if (continueUrl !== 'default') {
        const resetActionSettings: ActionCodeSettings = {
          url: continueUrl,
          handleCodeInApp: false,
        };
        try {
          await sendPasswordResetEmail(auth, trimmedEmail, resetActionSettings);
        } catch (continueErr: unknown) {
          const cCode = (continueErr as { code?: string })?.code || '';
          if (
            cCode === 'auth/unauthorized-continue-uri' ||
            cCode === 'auth/invalid-continue-uri' ||
            cCode === 'auth/missing-continue-uri'
          ) {
            fallbackCode = `${cCode} (fallback_without_continue_url)`;
            fallbackMessage =
              'Continue URL domain is not in Firebase Authorized Domains; sent using default Firebase reset flow.';
            await sendPasswordResetEmail(auth, trimmedEmail);
          } else {
            throw continueErr;
          }
        }
      } else {
        await sendPasswordResetEmail(auth, trimmedEmail);
      }
      await logEmailSendAttempt({
        type: 'password_reset',
        email: trimmedEmail,
        status: 'sent',
        errorCode: fallbackCode,
        errorMessage: fallbackMessage,
        continueUrl,
        actorUid: auth.currentUser?.uid || '',
      });
      addToast(
        'Password reset email sent',
        `Check ${trimmedEmail} (including Spam/Promotions) for your password reset link.`,
        'success'
      );
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || 'unknown';
      const errMsg =
        code === 'auth/user-not-found'
          ? 'No account found with this email address.'
          : code === 'auth/invalid-email'
            ? 'Enter a valid registered email address.'
            : code === 'auth/too-many-requests'
              ? 'Too many requests. Please wait a few minutes and try again.'
              : err instanceof Error
                ? err.message
                : 'Could not send password reset email.';
      await logEmailSendAttempt({
        type: 'password_reset',
        email: trimmedEmail,
        status: 'failed',
        errorCode: code,
        errorMessage: errMsg,
        continueUrl,
        actorUid: auth.currentUser?.uid || '',
      });
      addToast('Password reset failed', errMsg, 'error');
      return { ok: false, error: errMsg };
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      const msg = 'No active account session found. Please sign in first.';
      addToast('Failed to send verification email', msg, 'error');
      return { ok: false, error: msg };
    }

    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
        setFirebaseUser(auth.currentUser);
        await ensureUserProfile(auth.currentUser);
        addToast('Email already verified!', 'Your account is now active.', 'success');
        return { ok: true, alreadyVerified: true };
      }
    } catch {
      // Proceed to send attempt even if reload check fails
    }

    const targetEmail = (auth.currentUser.email || '').trim().toLowerCase();
    const dispatchedAt = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setVerificationDispatchState({
      status: 'sending',
      email: targetEmail,
    });

    try {
      const dispatchOutcome = await sendVerificationWithRedirect(auth.currentUser);
      setResendCooldownTimestamp(auth.currentUser.email);
      setVerificationDispatchState({
        status: 'sent',
        email: targetEmail,
        dispatchedAt,
        fallbackWarning: dispatchOutcome.fallbackMessage,
      });
      if (targetEmail && isValidAccountEmail(targetEmail)) {
        await logEmailSendAttempt({
          type: 'verification',
          email: targetEmail,
          status: 'sent',
          errorCode: dispatchOutcome.fallbackCode,
          errorMessage: dispatchOutcome.fallbackMessage,
          continueUrl: dispatchOutcome.continueUrl,
          actorUid: auth.currentUser.uid,
        });
      }
      addToast(
        'Verification email requested',
        `Firebase Auth accepted the request for ${auth.currentUser.email} at ${dispatchedAt}.`,
        'success'
      );
      return {
        ok: true,
        fallbackWarning: dispatchOutcome.fallbackMessage,
        dispatchedAt,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || 'unknown';
      const rateLimited = code === 'auth/too-many-requests';
      if (rateLimited) {
        setResendCooldownTimestamp(auth.currentUser.email);
      }
      const errMsg = rateLimited
        ? 'Firebase Auth blocked this request (auth/too-many-requests) because multiple verification emails were sent recently. Wait a few minutes before retrying.'
        : err instanceof Error
          ? err.message
          : 'Could not resend verification email.';
      setVerificationDispatchState({
        status: 'failed',
        email: targetEmail,
        error: errMsg,
      });
      if (targetEmail && isValidAccountEmail(targetEmail)) {
        await logEmailSendAttempt({
          type: 'verification',
          email: targetEmail,
          status: 'failed',
          errorCode: code,
          errorMessage: errMsg,
          continueUrl:
            typeof window !== 'undefined' && window.location?.origin
              ? `${window.location.origin}/verified?verified=true`
              : 'default',
          actorUid: auth.currentUser.uid,
        });
      }
      addToast('Failed to send verification email', errMsg, 'error');
      return {
        ok: false,
        error: errMsg,
        rateLimited,
        dispatchedAt,
      };
    }
  };

  const refreshEmailVerification = async (): Promise<AuthActionResult> => {
    if (!auth.currentUser) {
      return { ok: false, error: 'Please sign in first.' };
    }
    try {
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setFirebaseUser(refreshed);

      if (!refreshed.emailVerified) {
        return {
          ok: false,
          needsVerification: true,
          error: 'Email is not verified yet. Please click the verification link in your inbox.',
        };
      }

      if (!isValidAccountEmail(refreshed.email)) {
        await signOut(auth);
        return { ok: false, error: 'A valid registered email address is required.' };
      }

      const role = await ensureUserProfile(refreshed);
      addToast('Email verified', 'Welcome to HackerRank Campus Crew Paavai!', 'success');
      return { ok: true, role, redirectPath: getDashboardPath(role) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not verify status.',
      };
    }
  };

  const verifyActionCode = async (oobCode: string): Promise<AuthActionResult> => {
    try {
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await reload(auth.currentUser);
        await auth.currentUser.getIdToken(true);
        const refreshed = auth.currentUser;
        setFirebaseUser(refreshed);
        if (refreshed.emailVerified && isValidAccountEmail(refreshed.email)) {
          const role = await ensureUserProfile(refreshed);
          return { ok: true, role, redirectPath: getDashboardPath(role) };
        }
      }
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const errMsg =
        code === 'auth/expired-action-code'
          ? 'This verification link has expired. Request a new verification email.'
          : code === 'auth/invalid-action-code'
            ? 'This verification link is invalid or has already been used.'
            : err instanceof Error
              ? err.message
              : 'Could not verify your email link.';
      return { ok: false, error: errMsg };
    }
  };

  const verifyPasswordResetActionCode = async (
    oobCode: string
  ): Promise<{ ok: boolean; email?: string; error?: string }> => {
    try {
      const email = await verifyPasswordResetCode(auth, oobCode);
      return { ok: true, email };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const errMsg =
        code === 'auth/expired-action-code'
          ? 'This password reset link has expired. Request a new reset link from Sign In.'
          : code === 'auth/invalid-action-code'
            ? 'This password reset link is invalid or has already been used.'
            : err instanceof Error
              ? err.message
              : 'Could not validate password reset link.';
      return { ok: false, error: errMsg };
    }
  };

  const confirmPasswordResetAction = async (
    oobCode: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      addToast('Password updated', 'Sign in with your new password.', 'success');
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const errMsg =
        code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : code === 'auth/expired-action-code' || code === 'auth/invalid-action-code'
            ? 'This reset link is invalid or expired. Request a fresh reset email.'
            : err instanceof Error
              ? err.message
              : 'Could not update password.';
      addToast('Password reset error', errMsg, 'error');
      return { ok: false, error: errMsg };
    }
  };

  const syncVerificationAfterRedirect = async (): Promise<{
    verified: boolean;
    role?: Exclude<UserRole, 'outsider'>;
    redirectPath?: string;
  }> => {
    if (!auth.currentUser) {
      return { verified: true };
    }
    try {
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setFirebaseUser(refreshed);
      if (refreshed.emailVerified && isValidAccountEmail(refreshed.email)) {
        const role = await ensureUserProfile(refreshed);
        return { verified: true, role, redirectPath: getDashboardPath(role) };
      }
      return { verified: refreshed.emailVerified };
    } catch {
      return { verified: Boolean(auth.currentUser?.emailVerified) };
    }
  };

  const logout = async () => {
    setVerificationDispatchState({ status: 'idle', email: '' });
    if (firebaseUser) {
      await signOut(auth);
    }
    addToast('Signed out', 'You are now browsing as Guest.', 'info');
  };

  // ---------------- EVENTS CRUD ----------------
  const buildAutoEventCheckInCodeId = (eventId: string) =>
    sanitizeId(`HRCC-${eventId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`);

  const sanitizeOptionalMeetingUrl = (raw?: string): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    return /^https?:\/\/.+/.test(trimmed) ? clampStr(trimmed, 500) : '';
  };

  const createEvent: AppContextValue['createEvent'] = async (eventInput) => {
    if (!can('canCreateEvents') || !currentUser || !firebaseUser) return;
    const autoApprove = can('canPublishEventsDirectly');
    const id = `evt_${Date.now()}`;
    const path = `events/${id}`;
    const nowISO = new Date().toISOString();
    const safeTitle = ensureMinLen(eventInput.title, 'Campus Coding Event', 3, 140);
    const resolvedMode: EventMode =
      eventInput.eventMode === 'online' ||
      eventInput.eventMode === 'hybrid' ||
      eventInput.eventMode === 'offline'
        ? eventInput.eventMode
        : getEffectiveEventMode(eventInput);
    const onlineEvent = resolvedMode === 'online';
    const resolvedAttendanceEnabled = onlineEvent ? Boolean(eventInput.attendanceEnabled) : true;
    const safeVenue = ensureMinLen(
      eventInput.venue,
      onlineEvent ? 'Online (Virtual Session)' : 'Paavai Campus',
      2,
      160
    );
    const safeDateISO = clampStr(eventInput.dateISO, 40);
    const safeDocUrl = sanitizeOptionalDocUrl(eventInput.documentUrl);
    const safeMeetingUrl = sanitizeOptionalMeetingUrl(eventInput.meetingUrl);
    const rawUnstopUrl = (eventInput.unstopUrl || '').trim();
    const safeUnstopUrl = /^https:\/\/(www\.)?unstop\.com\/.+$/.test(rawUnstopUrl)
      ? clampStr(rawUnstopUrl, 500)
      : '';
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'events', id), {
        title: safeTitle,
        category: eventInput.category,
        dateISO: safeDateISO,
        venue: safeVenue,
        description: ensureMinLen(eventInput.description, 'Campus Crew event', 5, 1000),
        membersOnly: Boolean(eventInput.membersOnly),
        capacity: Math.min(5000, Math.max(1, Number(eventInput.capacity) || 100)),
        status: autoApprove ? 'approved' : 'pending',
        createdByUid: firebaseUser.uid,
        createdByName: ensureMinLen(currentUser.name, 'Campus Crew', 2, 100),
        createdByRole: currentUser.role,
        bannerImage: clampStr(
          eventInput.bannerImage || '/src/assets/images/gallery_hackathon_arena_1795100082455.jpg',
          500
        ),
        eventMode: resolvedMode,
        attendanceEnabled: resolvedAttendanceEnabled,
        ...(safeMeetingUrl ? { meetingUrl: safeMeetingUrl } : {}),
        ...(safeDocUrl ? { documentUrl: safeDocUrl } : {}),
        ...(safeUnstopUrl ? { unstopUrl: safeUnstopUrl } : {}),
        ...(eventInput.unstopCompetitionId
          ? { unstopCompetitionId: clampStr(eventInput.unstopCompetitionId, 40) }
          : {}),
        ...(typeof eventInput.unstopRegistrationsCount === 'number' &&
        Number.isFinite(eventInput.unstopRegistrationsCount)
          ? {
              unstopRegistrationsCount: Math.min(
                1000000,
                Math.max(0, Math.round(eventInput.unstopRegistrationsCount))
              ),
            }
          : {}),
        ...(typeof eventInput.unstopViewsCount === 'number' &&
        Number.isFinite(eventInput.unstopViewsCount)
          ? {
              unstopViewsCount: Math.min(
                10000000,
                Math.max(0, Math.round(eventInput.unstopViewsCount))
              ),
            }
          : {}),
        ...(eventInput.unstopDeadline
          ? { unstopDeadline: clampStr(eventInput.unstopDeadline, 60) }
          : {}),
        ...(eventInput.unstopOrganiser
          ? { unstopOrganiser: clampStr(eventInput.unstopOrganiser, 140) }
          : {}),
        ...(eventInput.unstopMode ? { unstopMode: clampStr(eventInput.unstopMode, 60) } : {}),
        ...(eventInput.unstopPrize ? { unstopPrize: clampStr(eventInput.unstopPrize, 140) } : {}),
        ...(eventInput.unstopSyncedAt
          ? { unstopSyncedAt: clampStr(eventInput.unstopSyncedAt, 40) }
          : {}),
        updatedAt: nowISO,
      });

      if (autoApprove) {
        const annId = sanitizeId(`ann_evt_${id}`);
        if (!onlineEvent) {
          const autoCode = buildAutoEventCheckInCodeId(id);
          const { opensAt, closesAt } = computeEventCheckInWindow(safeDateISO);
          batch.set(doc(db, 'event_checkin_codes', autoCode), {
            code: autoCode,
            eventId: id,
            eventTitle: safeTitle,
            venue: safeVenue,
            isActive: true,
            opensAt,
            closesAt,
            createdByUid: sanitizeId(firebaseUser.uid),
            createdByName: ensureMinLen(currentUser.name, 'Campus Lead', 2, 100),
            createdAt: nowISO,
          });

          batch.set(doc(db, 'announcements', annId), {
            title: ensureMinLen(`New Event: ${safeTitle}`, 'New Campus Event', 3, 140),
            message: ensureMinLen(
              `${safeTitle} (${eventInput.category}) is live! Venue: ${safeVenue}. Register now and use check-in QR code ${autoCode} at the venue to earn +50 leaderboard pts.`,
              'New event published on the HRCC Paavai portal.',
              5,
              1000
            ),
            date: nowISO.slice(0, 10),
            priority: 'Important',
            status: 'approved',
            createdByUid: sanitizeId(firebaseUser.uid),
            createdByName: ensureMinLen(currentUser.name, 'Campus Lead', 2, 100),
            updatedAt: nowISO,
          });
        } else {
          batch.set(doc(db, 'announcements', annId), {
            title: ensureMinLen(`New Online Event: ${safeTitle}`, 'New Online Event', 3, 140),
            message: ensureMinLen(
              `${safeTitle} (${eventInput.category} · Online) is live! Register on the event page — no QR check-in is required.${
                resolvedAttendanceEnabled
                  ? ' Online attendance marking is enabled for participants.'
                  : ''
              }`,
              'New online event published on the HRCC Paavai portal.',
              5,
              1000
            ),
            date: nowISO.slice(0, 10),
            priority: 'Important',
            status: 'approved',
            createdByUid: sanitizeId(firebaseUser.uid),
            createdByName: ensureMinLen(currentUser.name, 'Campus Lead', 2, 100),
            updatedAt: nowISO,
          });
        }
      }

      await batch.commit();
      addToast(
        autoApprove
          ? onlineEvent
            ? 'Online event published (no QR check-in)'
            : 'Event published with auto QR & announcement'
          : 'Event submitted for approval',
        eventInput.title,
        autoApprove ? 'success' : 'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateEvent = async (id: string, updates: Partial<CampusEvent>) => {
    if (!can('canEditDeleteAnyEvent') || !firebaseUser) return;
    const path = `events/${id}`;
    const sanitizedUpdates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.title !== undefined) {
      sanitizedUpdates.title = ensureMinLen(updates.title, 'Campus Coding Event', 3, 140);
    }
    if (updates.category !== undefined) sanitizedUpdates.category = updates.category;
    if (updates.dateISO !== undefined) sanitizedUpdates.dateISO = clampStr(updates.dateISO, 40);
    if (updates.venue !== undefined) {
      sanitizedUpdates.venue = ensureMinLen(updates.venue, 'Paavai Campus', 2, 160);
    }
    if (updates.description !== undefined) {
      sanitizedUpdates.description = ensureMinLen(updates.description, 'Campus Crew event', 5, 1000);
    }
    if (updates.membersOnly !== undefined) {
      sanitizedUpdates.membersOnly = Boolean(updates.membersOnly);
    }
    if (updates.capacity !== undefined) {
      sanitizedUpdates.capacity = Math.min(5000, Math.max(1, Number(updates.capacity) || 100));
    }
    if (updates.status !== undefined) sanitizedUpdates.status = updates.status;
    if (updates.bannerImage !== undefined && updates.bannerImage.trim()) {
      sanitizedUpdates.bannerImage = clampStr(updates.bannerImage, 500);
    }
    if (updates.documentUrl !== undefined) {
      sanitizedUpdates.documentUrl = sanitizeOptionalDocUrl(updates.documentUrl);
    }
    if (
      updates.eventMode === 'offline' ||
      updates.eventMode === 'online' ||
      updates.eventMode === 'hybrid'
    ) {
      sanitizedUpdates.eventMode = updates.eventMode;
    }
    if (updates.attendanceEnabled !== undefined) {
      sanitizedUpdates.attendanceEnabled = Boolean(updates.attendanceEnabled);
    }
    if (updates.meetingUrl !== undefined) {
      sanitizedUpdates.meetingUrl = sanitizeOptionalMeetingUrl(updates.meetingUrl);
    }
    if (updates.unstopUrl !== undefined) {
      const trimmed = updates.unstopUrl.trim();
      sanitizedUpdates.unstopUrl =
        trimmed === ''
          ? ''
          : /^https:\/\/(www\.)?unstop\.com\/.+$/.test(trimmed)
            ? clampStr(trimmed, 500)
            : '';
    }
    if (updates.unstopCompetitionId !== undefined) {
      sanitizedUpdates.unstopCompetitionId = clampStr(updates.unstopCompetitionId, 40);
    }
    if (
      updates.unstopRegistrationsCount !== undefined &&
      Number.isFinite(updates.unstopRegistrationsCount)
    ) {
      sanitizedUpdates.unstopRegistrationsCount = Math.min(
        1000000,
        Math.max(0, Math.round(updates.unstopRegistrationsCount))
      );
    }
    if (updates.unstopViewsCount !== undefined && Number.isFinite(updates.unstopViewsCount)) {
      sanitizedUpdates.unstopViewsCount = Math.min(
        10000000,
        Math.max(0, Math.round(updates.unstopViewsCount))
      );
    }
    if (updates.unstopDeadline !== undefined) {
      sanitizedUpdates.unstopDeadline = clampStr(updates.unstopDeadline, 60);
    }
    if (updates.unstopOrganiser !== undefined) {
      sanitizedUpdates.unstopOrganiser = clampStr(updates.unstopOrganiser, 140);
    }
    if (updates.unstopMode !== undefined) {
      sanitizedUpdates.unstopMode = clampStr(updates.unstopMode, 60);
    }
    if (updates.unstopPrize !== undefined) {
      sanitizedUpdates.unstopPrize = clampStr(updates.unstopPrize, 140);
    }
    if (updates.unstopSyncedAt !== undefined) {
      sanitizedUpdates.unstopSyncedAt = clampStr(updates.unstopSyncedAt, 40);
    }

    try {
      await updateDoc(doc(db, 'events', id), sanitizedUpdates);
      addToast('Event updated', 'Saved to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const toggleOnlineEventAttendance: AppContextValue['toggleOnlineEventAttendance'] = async (
    eventId,
    enabled
  ) => {
    if (!can('canEditDeleteAnyEvent') || !firebaseUser) {
      addToast(
        'Admin access required',
        'Only the Campus Lead / Admin can toggle online attendance for participants.',
        'error'
      );
      return;
    }
    const targetEvent = events.find((e) => e.id === eventId);
    const path = `events/${eventId}`;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        eventMode: 'online',
        attendanceEnabled: enabled,
        updatedAt: new Date().toISOString(),
      });
      addToast(
        enabled ? 'Online attendance enabled' : 'Online attendance disabled',
        enabled
          ? `Registered participants for "${targetEvent?.title || 'this event'}" can now mark attendance directly on the event page.`
          : `Participant attendance marking is turned off for "${targetEvent?.title || 'this event'}".`,
        enabled ? 'success' : 'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const fetchUnstopEventDetails: AppContextValue['fetchUnstopEventDetails'] = async (unstopUrl) => {
    if (!can('canCreateEvents') || !firebaseUser) {
      return { ok: false, error: 'Only verified Campus Crew or Campus Lead can fetch Unstop data.' };
    }
    const trimmed = unstopUrl.trim();
    if (!trimmed) {
      return { ok: false, error: 'Enter an Unstop event link (https://unstop.com/...).' };
    }
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/unstop/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ unstopUrl: trimmed }),
      });
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? ((await res.json()) as { ok?: boolean; data?: UnstopSyncedEventDetails; error?: string })
        : null;

      if (!res.ok || !payload?.ok || !payload.data) {
        const msg =
          payload?.error || `Unstop sync request failed (HTTP ${res.status}). Check the link and try again.`;
        addToast('Unstop sync failed', msg, 'error');
        return { ok: false, error: msg };
      }

      addToast(
        'Unstop details fetched',
        `${payload.data.title || 'Event'} · ${payload.data.unstopRegistrationsCount.toLocaleString('en-IN')} Unstop registrations`,
        'success'
      );
      return { ok: true, data: payload.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to Unstop proxy.';
      addToast('Unstop sync error', msg, 'error');
      return { ok: false, error: msg };
    }
  };

  const syncEventFromUnstop: AppContextValue['syncEventFromUnstop'] = async (
    eventId,
    unstopUrlOverride
  ) => {
    if (!can('canCreateEvents') || !firebaseUser) {
      return { ok: false, error: 'Only verified Campus Crew or Campus Lead can sync Unstop events.' };
    }
    const targetEvent = events.find((e) => e.id === eventId);
    const urlToSync = (unstopUrlOverride || targetEvent?.unstopUrl || '').trim();
    if (!urlToSync) {
      return { ok: false, error: 'No Unstop URL linked to this event.' };
    }

    const fetched = await fetchUnstopEventDetails(urlToSync);
    if (!fetched.ok || !fetched.data) {
      return fetched;
    }

    const data = fetched.data;
    const path = `events/${eventId}`;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        unstopUrl: clampStr(data.unstopUrl, 500),
        unstopCompetitionId: clampStr(data.unstopCompetitionId, 40),
        unstopRegistrationsCount: Math.min(
          1000000,
          Math.max(0, Math.round(data.unstopRegistrationsCount))
        ),
        unstopViewsCount: Math.min(10000000, Math.max(0, Math.round(data.unstopViewsCount))),
        unstopDeadline: clampStr(data.unstopDeadline || '', 60),
        unstopOrganiser: clampStr(data.unstopOrganiser || '', 140),
        unstopMode: clampStr(data.unstopMode || '', 60),
        unstopPrize: clampStr(data.unstopPrize || '', 140),
        unstopSyncedAt: clampStr(data.unstopSyncedAt, 40),
        updatedAt: new Date().toISOString(),
      });
      addToast(
        'Event synced with Unstop',
        `${data.unstopRegistrationsCount.toLocaleString('en-IN')} registrations · Updated in Firestore.`,
        'success'
      );
      return { ok: true, data };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      return { ok: false, error: 'Failed to save Unstop sync data to Firestore.' };
    }
  };

  const deleteEvent = async (id: string) => {
    if (!can('canEditDeleteAnyEvent') || !firebaseUser) return;
    const path = `events/${id}`;
    try {
      await deleteDoc(doc(db, 'events', id));
      addToast('Event removed', 'Deleted from Firestore.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const approveEvent = async (id: string) => {
    if (!can('canApproveContent') || !firebaseUser || !currentUser) return;
    const targetEvent = events.find((e) => e.id === id);
    const nowISO = new Date().toISOString();
    const path = `events/${id}`;
    const onlineEvent = isOnlineEvent(targetEvent);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'events', id), {
        status: 'approved',
        updatedAt: nowISO,
      });

      if (targetEvent) {
        const safeTitle = ensureMinLen(targetEvent.title, 'Campus Event', 2, 140);
        const safeVenue = ensureMinLen(
          targetEvent.venue,
          onlineEvent ? 'Online (Virtual Session)' : 'Paavai Campus',
          2,
          160
        );
        const annId = sanitizeId(`ann_evt_${id}`);

        if (!onlineEvent) {
          const autoCode = buildAutoEventCheckInCodeId(id);
          const { opensAt, closesAt } = computeEventCheckInWindow(targetEvent.dateISO);

          batch.set(doc(db, 'event_checkin_codes', autoCode), {
            code: autoCode,
            eventId: sanitizeId(id),
            eventTitle: safeTitle,
            venue: safeVenue,
            isActive: true,
            opensAt,
            closesAt,
            createdByUid: sanitizeId(firebaseUser.uid),
            createdByName: ensureMinLen(currentUser.name, 'Campus Lead', 2, 100),
            createdAt: nowISO,
          });

          batch.set(doc(db, 'announcements', annId), {
            title: ensureMinLen(`Event Approved: ${safeTitle}`, 'Campus Event Live', 3, 140),
            message: ensureMinLen(
              `${safeTitle} (${targetEvent.category}) is now open for registration at ${safeVenue}. Scan QR code ${autoCode} during the event window to earn +50 leaderboard pts.`,
              'New event approved and published.',
              5,
              1000
            ),
            date: nowISO.slice(0, 10),
            priority: 'Important',
            status: 'approved',
            createdByUid: sanitizeId(firebaseUser.uid),
            createdByName: ensureMinLen(currentUser.name, 'Campus Lead', 2, 100),
            updatedAt: nowISO,
          });
        } else {
          batch.set(doc(db, 'announcements', annId), {
            title: ensureMinLen(`Online Event Approved: ${safeTitle}`, 'Online Event Live', 3, 140),
            message: ensureMinLen(
              `${safeTitle} (${targetEvent.category} · Online) is now open for registration. No QR check-in is needed.${
                isOnlineAttendanceEnabled(targetEvent)
                  ? ' Online attendance marking is enabled for participants.'
                  : ''
              }`,
              'New online event approved and published.',
              5,
              1000
            ),
            date: nowISO.slice(0, 10),
            priority: 'Important',
            status: 'approved',
            createdByUid: sanitizeId(firebaseUser.uid),
            createdByName: ensureMinLen(currentUser.name, 'Campus Lead', 2, 100),
            updatedAt: nowISO,
          });
        }
      }

      await batch.commit();
      addToast(
        'Event approved',
        onlineEvent
          ? 'Online event published with campus announcement (QR check-in skipped).'
          : 'Auto-generated time-windowed QR code & campus announcement.',
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const rejectEvent = async (id: string) => {
    if (!can('canApproveContent')) return;
    await updateEvent(id, { status: 'rejected' });
  };

  // ---------------- ANNOUNCEMENTS CRUD ----------------
  const createAnnouncement: AppContextValue['createAnnouncement'] = async ({
    title,
    message,
    priority,
  }) => {
    if (!can('canCreateAnnouncements') || !currentUser || !firebaseUser) return;
    const autoApprove = can('canPublishAnnouncementsDirectly');
    const id = `ann_${Date.now()}`;
    const path = `announcements/${id}`;
    try {
      await setDoc(doc(db, 'announcements', id), {
        title: ensureMinLen(title, 'Campus Update', 3, 140),
        message: ensureMinLen(message, 'Details coming soon.', 5, 1000),
        date: new Date().toISOString().slice(0, 10),
        priority,
        status: autoApprove ? 'approved' : 'pending',
        createdByUid: firebaseUser.uid,
        createdByName: ensureMinLen(currentUser.name, 'Campus Crew', 2, 100),
        updatedAt: new Date().toISOString(),
      });
      addToast(
        autoApprove ? 'Announcement published' : 'Announcement queued for approval',
        undefined,
        autoApprove ? 'success' : 'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!can('canDeleteAnnouncements') || !firebaseUser) return;
    const path = `announcements/${id}`;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      addToast('Announcement deleted', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const approveAnnouncement = async (id: string) => {
    if (!can('canApproveContent') || !firebaseUser) return;
    const path = `announcements/${id}`;
    try {
      await updateDoc(doc(db, 'announcements', id), {
        status: 'approved',
        updatedAt: new Date().toISOString(),
      });
      addToast('Announcement approved', 'Now live on the Home page.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const rejectAnnouncement = async (id: string) => {
    if (!can('canApproveContent') || !firebaseUser) return;
    const path = `announcements/${id}`;
    try {
      await updateDoc(doc(db, 'announcements', id), {
        status: 'rejected',
        updatedAt: new Date().toISOString(),
      });
      addToast('Announcement rejected', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // ---------------- REGISTRATIONS ----------------
  const dispatchTicketEmailRequest = async (params: {
    registrationId: string;
    event: CampusEvent;
    userId: string;
    userName: string;
    userEmail: string;
    registerNumber: string;
    department: string;
    year: string;
    ticketCode: string;
  }): Promise<{ ok: boolean; delivered: boolean; reason?: string; message?: string }> => {
    if (!firebaseUser) {
      return { ok: false, delivered: false, reason: 'unauthorized', message: 'Not authenticated.' };
    }
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/events/send-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          eventId: params.event.id,
          eventTitle: params.event.title,
          eventCategory: params.event.category,
          eventDateISO: params.event.dateISO,
          venue: params.event.venue,
          attendeeUid: params.userId,
          attendeeName: params.userName,
          attendeeEmail: params.userEmail,
          registerNumber: params.registerNumber,
          department: params.department,
          year: params.year,
          ticketCode: params.ticketCode,
          portalUrl: typeof window !== 'undefined' ? window.location.origin : '',
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        reason?: string;
        message?: string;
      };
      const delivered = Boolean(response.ok && data.delivered);
      const statusToSave: 'sent' | 'failed' = delivered ? 'sent' : 'failed';
      await updateDoc(doc(db, 'registrations', params.registrationId), {
        ticketCode: params.ticketCode,
        ticketEmailStatus: statusToSave,
        ticketEmailSentAt: delivered ? new Date().toISOString() : '',
      }).catch(() => {});

      return {
        ok: delivered,
        delivered,
        reason: data.reason,
        message: data.message,
      };
    } catch (err) {
      await updateDoc(doc(db, 'registrations', params.registrationId), {
        ticketCode: params.ticketCode,
        ticketEmailStatus: 'failed',
        ticketEmailSentAt: '',
      }).catch(() => {});
      return {
        ok: false,
        delivered: false,
        reason: 'network_error',
        message: err instanceof Error ? err.message : 'Network error sending QR pass email.',
      };
    }
  };

  const registerForEvent = async (eventId: string) => {
    if (!currentUser || !firebaseUser || !can('canRegisterForEvents')) {
      addToast(
        'Sign in required',
        'Sign in with a verified student account to register for events.',
        'error'
      );
      return;
    }
    const target = events.find((e) => e.id === eventId && e.status === 'approved');
    if (!target) {
      addToast('Unavailable', 'Only published events can accept registrations.', 'error');
      return;
    }

    const alreadyRegistered = registrations.some(
      (r) => r.eventId === eventId && r.userId === currentUser.id
    );
    if (alreadyRegistered) {
      addToast('Already registered', `You are already registered for ${target.title}.`, 'info');
      return;
    }

    const safeEventId = sanitizeId(eventId);
    const safeUserId = sanitizeId(currentUser.id);
    const regId = sanitizeId(`reg_${safeEventId}_${safeUserId}`);
    const onlineEvent = isOnlineEvent(target);
    const basePayload = {
      eventId: safeEventId,
      userId: safeUserId,
      userName: ensureMinLen(currentUser.name, 'Paavai Student', 2, 100),
      userEmail: clampStr(currentUser.email, 160),
      registerNumber: ensureMinLen(currentUser.regNo || 'PEC-MEMBER', 'PEC-MEMBER', 4, 20),
      department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
      year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
      registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    const ticketCode = onlineEvent ? '' : buildAttendeeTicketCode(safeEventId, safeUserId);
    const payload = onlineEvent
      ? basePayload
      : {
          ...basePayload,
          ticketCode,
          ticketEmailStatus: 'queued' as const,
          ticketEmailSentAt: '',
        };

    const path = `registrations/${regId}`;
    try {
      await setDoc(doc(db, 'registrations', regId), payload);

      if (onlineEvent) {
        addToast(
          'RSVP confirmed (Online Event)',
          `Seat reserved for "${target.title}". No QR check-in is needed for this online event.`,
          'success'
        );
        return;
      }

      addToast(
        'Registration confirmed',
        `Seat reserved for "${target.title}". Sending your unique Entry Pass QR (${ticketCode}) to ${payload.userEmail}...`,
        'success'
      );

      const mailRes = await dispatchTicketEmailRequest({
        registrationId: regId,
        event: target,
        userId: safeUserId,
        userName: payload.userName,
        userEmail: payload.userEmail,
        registerNumber: payload.registerNumber,
        department: payload.department,
        year: payload.year,
        ticketCode,
      });

      if (mailRes.delivered) {
        addToast(
          'Unique QR Pass Emailed',
          `Check ${payload.userEmail} for your scannable entry pass (${ticketCode}). Also saved on your Profile.`,
          'success'
        );
      } else {
        addToast(
          'Entry QR Pass Ready on Profile',
          mailRes.reason === 'mail_not_configured'
            ? `Email transport is not configured yet — open your unique QR pass (${ticketCode}) anytime on your Profile page.`
            : `Could not email QR pass right now — open or download ${ticketCode} anytime from your Profile page.`,
          'info'
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const resendEventTicketEmail: AppContextValue['resendEventTicketEmail'] = async (
    registrationId
  ) => {
    if (!firebaseUser || !currentUser) {
      return { ok: false, delivered: false, message: 'Sign in required.' };
    }
    const reg = registrations.find((r) => r.id === registrationId);
    if (!reg) {
      addToast('Registration not found', 'Could not locate that registration record.', 'error');
      return { ok: false, delivered: false, message: 'Registration not found.' };
    }
    if (!can('canAccessCrewDashboard') && reg.userId !== firebaseUser.uid) {
      addToast('Permission denied', 'You can only email your own Event Entry Pass QR.', 'error');
      return { ok: false, delivered: false, message: 'Permission denied.' };
    }
    const targetEvent = events.find((e) => e.id === reg.eventId);
    if (!targetEvent) {
      addToast('Event not found', 'Associated campus event could not be loaded.', 'error');
      return { ok: false, delivered: false, message: 'Event not found.' };
    }
    if (isOnlineEvent(targetEvent)) {
      addToast('No QR pass needed', 'Online events do not require QR check-in passes.', 'info');
      return {
        ok: false,
        delivered: false,
        message: 'Online events do not require QR check-in passes.',
      };
    }

    const ticketCode = reg.ticketCode || buildAttendeeTicketCode(reg.eventId, reg.userId);
    const mailRes = await dispatchTicketEmailRequest({
      registrationId: reg.id,
      event: targetEvent,
      userId: reg.userId,
      userName: reg.userName,
      userEmail: reg.userEmail,
      registerNumber: reg.registerNumber,
      department: reg.department,
      year: reg.year,
      ticketCode,
    });

    if (mailRes.delivered) {
      addToast(
        'Entry Pass QR Sent',
        `Emailed unique QR pass (${ticketCode}) to ${reg.userEmail}.`,
        'success'
      );
    } else {
      addToast(
        'Email Not Delivered',
        mailRes.message || 'Mail server not configured yet. Download the QR directly from the pass modal.',
        'error'
      );
    }
    return mailRes;
  };

  const cancelRegistration = async (eventId: string) => {
    if (!currentUser || !firebaseUser) return;
    const existingReg = registrations.find(
      (r) => r.eventId === eventId && r.userId === firebaseUser.uid
    );
    if (!existingReg) return;
    const path = `registrations/${existingReg.id}`;
    try {
      await deleteDoc(doc(db, 'registrations', existingReg.id));
      addToast('Registration cancelled', 'Your seat has been released.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const exportRegistrationsCSV = () => {
    if (!can('canExportRegistrations')) {
      addToast('Export restricted', 'Only the Campus Lead can export registration data.', 'error');
      return;
    }
    const headers = [
      'Registration ID',
      'Event',
      'Student Name',
      'Register Number',
      'Department',
      'Year',
      'Email',
      'Registered At',
    ];
    const rows = registrations.map((r) => {
      const ev = events.find((e) => e.id === r.eventId);
      return [
        r.id,
        `"${(ev?.title ?? r.eventId).replace(/"/g, '""')}"`,
        `"${r.userName.replace(/"/g, '""')}"`,
        r.registerNumber,
        r.department,
        r.year,
        r.userEmail,
        r.registeredAt,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hrcc-paavai-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('CSV exported', `Downloaded ${registrations.length} registration records.`, 'success');
  };

  // ---------------- EVENT QR CHECK-INS ----------------
  const extractCheckInCode = (rawInput: string): string => {
    const trimmed = rawInput.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('code=')) {
      try {
        const parsedUrl = trimmed.startsWith('http')
          ? new URL(trimmed)
          : new URL(trimmed, window.location.origin);
        const param = parsedUrl.searchParams.get('code');
        if (param) {
          return param.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        }
      } catch {
        // Fallback to raw sanitization
      }
    }
    return trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  };

  const generateEventCheckInCode: AppContextValue['generateEventCheckInCode'] = async (
    eventId
  ) => {
    if (!can('canAccessCrewDashboard') || !firebaseUser || !currentUser) {
      return { ok: false, error: 'Only Campus Crew or Campus Lead can generate check-in QR codes.' };
    }
    const targetEvent = events.find((ev) => ev.id === eventId);
    if (!targetEvent) {
      return { ok: false, error: 'Selected event was not found.' };
    }
    if (isOnlineEvent(targetEvent)) {
      return {
        ok: false,
        error:
          'QR check-in is disabled for online events. Use the Admin Online Attendance toggle on the event instead.',
      };
    }

    const eventSlug = targetEvent.title
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toUpperCase()
      .slice(0, 6) || 'EVENT';
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    const uniqueCode = sanitizeId(`HRCC-${eventSlug}-${randomHex}`).slice(0, 64);

    const { opensAt, closesAt } = computeEventCheckInWindow(targetEvent.dateISO);
    const payload: EventCheckInCode = {
      code: uniqueCode,
      eventId: sanitizeId(targetEvent.id),
      eventTitle: ensureMinLen(targetEvent.title, 'Campus Event', 2, 140),
      venue: ensureMinLen(targetEvent.venue, 'Paavai Campus', 2, 160),
      isActive: true,
      opensAt,
      closesAt,
      createdByUid: sanitizeId(firebaseUser.uid),
      createdByName: ensureMinLen(currentUser.name, 'Campus Organizer', 2, 100),
      createdAt: new Date().toISOString(),
    };

    const path = `event_checkin_codes/${uniqueCode}`;
    try {
      await setDoc(doc(db, 'event_checkin_codes', uniqueCode), payload);
      addToast(
        'Check-in QR generated',
        `Unique event ID ${uniqueCode} created for "${targetEvent.title}".`,
        'success'
      );
      return { ok: true, codeDoc: payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return { ok: false, error: 'Failed to create event check-in QR code.' };
    }
  };

  const toggleEventCheckInCodeActive: AppContextValue['toggleEventCheckInCodeActive'] = async (
    code,
    isActive
  ) => {
    if (!can('canAccessCrewDashboard') || !firebaseUser) return;
    const sanitized = extractCheckInCode(code);
    if (!sanitized) return;
    const path = `event_checkin_codes/${sanitized}`;
    try {
      await updateDoc(doc(db, 'event_checkin_codes', sanitized), { isActive });
      addToast(
        isActive ? 'Check-in QR activated' : 'Check-in QR paused',
        `Event check-in code ${sanitized} is now ${isActive ? 'active' : 'paused'}.`,
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteEventCheckInCode: AppContextValue['deleteEventCheckInCode'] = async (code) => {
    if (!can('canEditDeleteAnyEvent') || !firebaseUser) return;
    const sanitized = extractCheckInCode(code);
    if (!sanitized) return;
    const path = `event_checkin_codes/${sanitized}`;
    try {
      await deleteDoc(doc(db, 'event_checkin_codes', sanitized));
      addToast('Check-in QR removed', `Deleted event check-in code ${sanitized}.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const lookupEventCheckInCode: AppContextValue['lookupEventCheckInCode'] = async (rawCode) => {
    const code = extractCheckInCode(rawCode);
    if (!code || code.length < 6) {
      return { ok: false, error: 'Enter or scan a valid unique event check-in ID.' };
    }
    const path = `event_checkin_codes/${code}`;
    try {
      const snap = await getDoc(doc(db, 'event_checkin_codes', code));
      if (!snap.exists()) {
        return { ok: false, error: `No event check-in found for code "${code}".` };
      }
      const x = snap.data();
      const codeDoc: EventCheckInCode = {
        code: String(x.code || snap.id),
        eventId: String(x.eventId || ''),
        eventTitle: String(x.eventTitle || ''),
        venue: String(x.venue || ''),
        isActive: Boolean(x.isActive),
        opensAt: x.opensAt,
        closesAt: x.closesAt,
        createdByUid: String(x.createdByUid || ''),
        createdByName: String(x.createdByName || ''),
        createdAt: String(x.createdAt || ''),
      };
      return { ok: true, codeDoc };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return { ok: false, error: 'Could not verify the event check-in QR code.' };
    }
  };

  const checkInAttendeeWithCode: AppContextValue['checkInAttendeeWithCode'] = async (rawCode) => {
    if (!currentUser || !firebaseUser) {
      return {
        ok: false,
        error: 'Please sign in with your verified student account to complete event check-in.',
      };
    }

    const lookup = await lookupEventCheckInCode(rawCode);
    if (!lookup.ok || !lookup.codeDoc) {
      return { ok: false, error: lookup.error || 'Invalid event check-in QR code.' };
    }
    const codeDoc = lookup.codeDoc;
    if (!codeDoc.isActive) {
      return {
        ok: false,
        error: `Check-in code ${codeDoc.code} has been paused by the event organizer.`,
      };
    }

    const nowMs = Date.now();
    const opensMs = toTimestampMs(codeDoc.opensAt);
    const closesMs = toTimestampMs(codeDoc.closesAt);
    if (opensMs !== null && nowMs < opensMs) {
      return {
        ok: false,
        error: `Check-in opens at ${new Date(opensMs).toLocaleString('en-IN')} (30 mins before event start).`,
      };
    }
    if (closesMs !== null && nowMs > closesMs) {
      return {
        ok: false,
        error: `Check-in window closed at ${new Date(closesMs).toLocaleString('en-IN')}.`,
      };
    }

    const safeEventId = sanitizeId(codeDoc.eventId);
    const checkInId = sanitizeId(`${safeEventId}_${firebaseUser.uid}`);
    const path = `event_checkins/${checkInId}`;

    try {
      const existingSnap = await getDoc(doc(db, 'event_checkins', checkInId));
      if (existingSnap.exists()) {
        const x = existingSnap.data();
        return {
          ok: true,
          alreadyCheckedIn: true,
          checkIn: {
            id: existingSnap.id,
            checkInCode: String(x.checkInCode || codeDoc.code),
            eventId: String(x.eventId || codeDoc.eventId),
            eventTitle: String(x.eventTitle || codeDoc.eventTitle),
            userId: String(x.userId || firebaseUser.uid),
            userName: String(x.userName || currentUser.name),
            userEmail: String(x.userEmail || currentUser.email),
            collegeEmail: x.collegeEmail ? String(x.collegeEmail) : '',
            registerNumber: String(x.registerNumber || currentUser.regNo),
            department: String(x.department || currentUser.department),
            year: String(x.year || currentUser.year),
            phone: x.phone ? String(x.phone) : '',
            checkedInAt: String(x.checkedInAt || ''),
          },
        };
      }

      const nowISO = new Date().toISOString();
      const payload = {
        checkInCode: codeDoc.code,
        eventId: safeEventId,
        eventTitle: ensureMinLen(codeDoc.eventTitle, 'Campus Event', 2, 140),
        userId: sanitizeId(firebaseUser.uid),
        userName: ensureMinLen(currentUser.name, 'Paavai Student', 2, 100),
        userEmail: clampStr(currentUser.email, 160),
        collegeEmail: currentUser.collegeEmail ? clampStr(currentUser.collegeEmail, 160) : '',
        registerNumber: ensureMinLen(
          (currentUser.regNo || 'PEC-MEMBER').replace(/[^A-Za-z0-9-]/g, ''),
          'PEC-MEMBER',
          4,
          20
        ),
        department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
        year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
        phone: clampStr(currentUser.phone || '', 20),
        checkedInAt: nowISO,
      };

      const [lbSnap, pubSnap] = await Promise.all([
        getDoc(doc(db, 'leaderboard', firebaseUser.uid)).catch(() => null),
        getDoc(doc(db, 'public_profiles', firebaseUser.uid)).catch(() => null),
      ]);
      const prevLb = lbSnap?.exists() ? lbSnap.data() : null;
      const prevPub = pubSnap?.exists() ? pubSnap.data() : null;

      const prevScore = Number(prevLb?.score || 0);
      const prevSolved = Number(prevLb?.problemsSolved ?? prevLb?.solvedCount ?? 0);
      const prevEventsLb = Number(prevLb?.eventsAttended || 0);
      const prevEventsPub = Number(prevPub?.eventsAttended || 0);

      const batch = writeBatch(db);
      batch.set(doc(db, 'event_checkins', checkInId), payload);

      batch.set(
        doc(db, 'leaderboard', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: payload.userName,
          registerNumber: payload.registerNumber,
          department: payload.department,
          year: payload.year,
          score: Math.min(1000000, prevScore + 50),
          problemsSolved: prevSolved,
          solvedCount: prevSolved,
          eventsAttended: Math.min(1000, prevEventsLb + 1),
          hackerRankHandle: clampStr(currentUser.hackerRankHandle || '@coder_pec', 60),
          updatedAt: nowISO,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'public_profiles', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: payload.userName,
          department: payload.department,
          year: payload.year,
          photoUrl: sanitizeImageUrl(currentUser.photoUrl),
          eventsAttended: Math.min(1000, prevEventsPub + 1),
          updatedAt: nowISO,
        },
        { merge: true }
      );

      await batch.commit();
      addToast(
        'Check-in recorded (+50 pts)',
        `Checked into "${codeDoc.eventTitle}" and awarded +50 leaderboard points.`,
        'success'
      );
      return {
        ok: true,
        alreadyCheckedIn: false,
        checkIn: { id: checkInId, ...payload },
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return {
        ok: false,
        error: 'Check-in rejected (outside active event window or already checked in).',
      };
    }
  };

  const markOnlineEventAttendance: AppContextValue['markOnlineEventAttendance'] = async (
    eventId
  ) => {
    if (!currentUser || !firebaseUser) {
      return {
        ok: false,
        error: 'Please sign in with your verified student account to mark attendance.',
      };
    }

    const targetEvent = events.find((ev) => ev.id === eventId && ev.status === 'approved');
    if (!targetEvent) {
      return { ok: false, error: 'Event not found or not yet published.' };
    }
    if (!isOnlineEvent(targetEvent)) {
      return {
        ok: false,
        error: 'This is an in-person event. Please use venue QR check-in.',
      };
    }
    if (!isOnlineAttendanceEnabled(targetEvent)) {
      return {
        ok: false,
        error: 'Attendance marking is not currently enabled by the admin for this online event.',
      };
    }

    const myReg = registrations.find(
      (r) => r.eventId === targetEvent.id && r.userId === firebaseUser.uid
    );
    if (!myReg) {
      return {
        ok: false,
        error: 'Please RSVP for this online event before marking your attendance.',
      };
    }

    const safeEventId = sanitizeId(targetEvent.id);
    const checkInId = sanitizeId(`${safeEventId}_${firebaseUser.uid}`);
    const path = `event_checkins/${checkInId}`;

    try {
      const existingSnap = await getDoc(doc(db, 'event_checkins', checkInId));
      if (existingSnap.exists()) {
        const x = existingSnap.data();
        return {
          ok: true,
          alreadyMarked: true,
          checkIn: {
            id: existingSnap.id,
            checkInCode: String(x.checkInCode || 'ONLINE-ATTENDANCE'),
            eventId: String(x.eventId || targetEvent.id),
            eventTitle: String(x.eventTitle || targetEvent.title),
            userId: String(x.userId || firebaseUser.uid),
            userName: String(x.userName || currentUser.name),
            userEmail: String(x.userEmail || currentUser.email),
            collegeEmail: x.collegeEmail ? String(x.collegeEmail) : '',
            registerNumber: String(x.registerNumber || currentUser.regNo),
            department: String(x.department || currentUser.department),
            year: String(x.year || currentUser.year),
            phone: x.phone ? String(x.phone) : '',
            checkedInAt: String(x.checkedInAt || ''),
          },
        };
      }

      const nowISO = new Date().toISOString();
      const payload = {
        checkInCode: 'ONLINE-ATTENDANCE',
        eventId: safeEventId,
        eventTitle: ensureMinLen(targetEvent.title, 'Online Event', 2, 140),
        userId: sanitizeId(firebaseUser.uid),
        userName: ensureMinLen(currentUser.name, 'Paavai Student', 2, 100),
        userEmail: clampStr(currentUser.email, 160),
        collegeEmail: currentUser.collegeEmail ? clampStr(currentUser.collegeEmail, 160) : '',
        registerNumber: ensureMinLen(
          (currentUser.regNo || 'PEC-MEMBER').replace(/[^A-Za-z0-9-]/g, ''),
          'PEC-MEMBER',
          4,
          20
        ),
        department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
        year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
        phone: clampStr(currentUser.phone || '', 20),
        checkedInAt: nowISO,
      };

      const [lbSnap, pubSnap] = await Promise.all([
        getDoc(doc(db, 'leaderboard', firebaseUser.uid)).catch(() => null),
        getDoc(doc(db, 'public_profiles', firebaseUser.uid)).catch(() => null),
      ]);
      const prevLb = lbSnap?.exists() ? lbSnap.data() : null;
      const prevPub = pubSnap?.exists() ? pubSnap.data() : null;

      const prevScore = Number(prevLb?.score || 0);
      const prevSolved = Number(prevLb?.problemsSolved ?? prevLb?.solvedCount ?? 0);
      const prevEventsLb = Number(prevLb?.eventsAttended || 0);
      const prevEventsPub = Number(prevPub?.eventsAttended || 0);

      const batch = writeBatch(db);
      batch.set(doc(db, 'event_checkins', checkInId), payload);

      batch.set(
        doc(db, 'leaderboard', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: payload.userName,
          registerNumber: payload.registerNumber,
          department: payload.department,
          year: payload.year,
          score: Math.min(1000000, prevScore + 50),
          problemsSolved: prevSolved,
          solvedCount: prevSolved,
          eventsAttended: Math.min(1000, prevEventsLb + 1),
          hackerRankHandle: clampStr(currentUser.hackerRankHandle || '@coder_pec', 60),
          updatedAt: nowISO,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'public_profiles', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: payload.userName,
          department: payload.department,
          year: payload.year,
          photoUrl: sanitizeImageUrl(currentUser.photoUrl),
          eventsAttended: Math.min(1000, prevEventsPub + 1),
          updatedAt: nowISO,
        },
        { merge: true }
      );

      await batch.commit();
      addToast(
        'Attendance marked (+50 pts)',
        `Online attendance recorded for "${targetEvent.title}" and +50 leaderboard points awarded.`,
        'success'
      );
      return {
        ok: true,
        alreadyMarked: false,
        checkIn: { id: checkInId, ...payload },
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return {
        ok: false,
        error: 'Could not mark online attendance right now. Make sure you have RSVPed and attendance is enabled.',
      };
    }
  };

  const crewCheckInAttendeeByTicket: AppContextValue['crewCheckInAttendeeByTicket'] = async (
    rawInput,
    expectedEventId
  ) => {
    if (!can('canAccessCrewDashboard') || !firebaseUser || !currentUser) {
      return {
        ok: false,
        error: 'Sign in with a Campus Crew or Campus Lead account to scan student QR passes.',
      };
    }

    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { ok: false, error: 'Scan a student Entry Pass QR or enter a Ticket Code / Register No.' };
    }

    let parsedEventId = '';
    let parsedUserId = '';
    let parsedTicketCode = '';

    // Format 1: HRCC-PASS|<eventId>|<userId>|<ticketCode>
    if (trimmed.startsWith('HRCC-PASS|')) {
      const parts = trimmed.split('|').map((p) => p.trim());
      parsedEventId = sanitizeId(parts[1] || '');
      parsedUserId = sanitizeId(parts[2] || '');
      parsedTicketCode = (parts[3] || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    } else if (/^https?:\/\//i.test(trimmed) && trimmed.includes('ticket=')) {
      try {
        const u = new URL(trimmed);
        parsedTicketCode = (u.searchParams.get('ticket') || '')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 64);
      } catch {
        parsedTicketCode = trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      }
    }

    const normalizedQuery = trimmed.toUpperCase();

    // Locate matching registration
    let matchedReg: EventRegistration | undefined;

    if (parsedEventId && parsedUserId) {
      matchedReg = registrations.find(
        (r) => r.eventId === parsedEventId && r.userId === parsedUserId
      );
    }

    if (!matchedReg && parsedTicketCode) {
      matchedReg = registrations.find((r) => {
        const expectedCode = (r.ticketCode || buildAttendeeTicketCode(r.eventId, r.userId)).toUpperCase();
        return expectedCode === parsedTicketCode.toUpperCase();
      });
    }

    if (!matchedReg) {
      // Match directly by ticketCode, registerNumber, or email
      const candidatePool =
        expectedEventId && expectedEventId !== 'all'
          ? registrations.filter((r) => r.eventId === expectedEventId)
          : registrations;

      matchedReg = candidatePool.find((r) => {
        const code = (r.ticketCode || buildAttendeeTicketCode(r.eventId, r.userId)).toUpperCase();
        return (
          code === normalizedQuery ||
          r.registerNumber.toUpperCase() === normalizedQuery ||
          r.userEmail.toUpperCase() === normalizedQuery
        );
      });
    }

    if (!matchedReg) {
      return {
        ok: false,
        error:
          expectedEventId && expectedEventId !== 'all'
            ? `No registration found for "${trimmed}" in the selected event.`
            : `No student registration matched "${trimmed}". Verify the QR pass or select the target event.`,
      };
    }

    if (expectedEventId && expectedEventId !== 'all' && matchedReg.eventId !== expectedEventId) {
      const regEv = events.find((e) => e.id === matchedReg?.eventId);
      return {
        ok: false,
        error: `This QR pass belongs to "${regEv?.title || matchedReg.eventId}", not the selected event.`,
      };
    }

    const targetEvent = events.find((e) => e.id === matchedReg.eventId);
    if (!targetEvent) {
      return { ok: false, error: 'Event associated with this registration was not found.' };
    }
    const onlineTarget = isOnlineEvent(targetEvent);
    if (onlineTarget && !isOnlineAttendanceEnabled(targetEvent)) {
      return {
        ok: false,
        error:
          'Attendance is disabled for this online event. Enable Participant Attendance on the event if you want to track attendance.',
      };
    }

    const safeEventId = sanitizeId(matchedReg.eventId);
    const safeUserId = sanitizeId(matchedReg.userId);
    const checkInId = sanitizeId(`${safeEventId}_${safeUserId}`);
    const resolvedTicketCode = onlineTarget
      ? 'ONLINE-ATTENDANCE'
      : (matchedReg.ticketCode || buildAttendeeTicketCode(safeEventId, safeUserId))
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 64);

    const path = `event_checkins/${checkInId}`;
    try {
      const existingSnap = await getDoc(doc(db, 'event_checkins', checkInId));
      if (existingSnap.exists()) {
        const x = existingSnap.data();
        const existingCheckIn: EventCheckIn = {
          id: existingSnap.id,
          checkInCode: String(x.checkInCode || resolvedTicketCode),
          eventId: String(x.eventId || safeEventId),
          eventTitle: String(x.eventTitle || targetEvent.title),
          userId: String(x.userId || safeUserId),
          userName: String(x.userName || matchedReg.userName),
          userEmail: String(x.userEmail || matchedReg.userEmail),
          collegeEmail: x.collegeEmail ? String(x.collegeEmail) : '',
          registerNumber: String(x.registerNumber || matchedReg.registerNumber),
          department: String(x.department || matchedReg.department),
          year: String(x.year || matchedReg.year),
          phone: x.phone ? String(x.phone) : '',
          checkedInAt: String(x.checkedInAt || ''),
        };
        return {
          ok: true,
          alreadyCheckedIn: true,
          checkIn: existingCheckIn,
        };
      }

      const matchedUserProfile = users.find((u) => u.id === safeUserId);
      const nowISO = new Date().toISOString();
      const cleanRegNo = ensureMinLen(
        (matchedReg.registerNumber || matchedUserProfile?.regNo || 'PEC-MEMBER').replace(
          /[^A-Za-z0-9-]/g,
          ''
        ),
        'PEC-MEMBER',
        4,
        20
      );

      const payload = {
        checkInCode: resolvedTicketCode.length >= 6 ? resolvedTicketCode : `PASS-${safeEventId.slice(0, 6)}`,
        eventId: safeEventId,
        eventTitle: ensureMinLen(targetEvent.title, 'Campus Event', 2, 140),
        userId: safeUserId,
        userName: ensureMinLen(matchedReg.userName, 'Paavai Student', 2, 100),
        userEmail: clampStr(matchedReg.userEmail, 160),
        collegeEmail: matchedUserProfile?.collegeEmail
          ? clampStr(matchedUserProfile.collegeEmail, 160)
          : '',
        registerNumber: cleanRegNo,
        department: ensureMinLen(matchedReg.department || 'CSE', 'CSE', 2, 40),
        year: ensureMinLen(matchedReg.year || '1st Year', '1st Year', 2, 20),
        phone: clampStr(matchedUserProfile?.phone || '', 20),
        checkedInAt: nowISO,
      };

      const lbSnap = await getDoc(doc(db, 'leaderboard', safeUserId)).catch(() => null);
      const prevLb = lbSnap?.exists() ? lbSnap.data() : null;
      const prevScore = Number(prevLb?.score || 0);
      const prevSolved = Number(prevLb?.problemsSolved ?? prevLb?.solvedCount ?? 0);
      const prevEventsLb = Number(prevLb?.eventsAttended || 0);

      const batch = writeBatch(db);
      batch.set(doc(db, 'event_checkins', checkInId), payload);
      batch.set(
        doc(db, 'leaderboard', safeUserId),
        {
          uid: safeUserId,
          name: payload.userName,
          registerNumber: payload.registerNumber,
          department: payload.department,
          year: payload.year,
          score: Math.min(1000000, prevScore + 50),
          problemsSolved: prevSolved,
          solvedCount: prevSolved,
          eventsAttended: Math.min(1000, prevEventsLb + 1),
          hackerRankHandle: clampStr(
            matchedUserProfile?.hackerRankHandle ||
              String(prevLb?.hackerRankHandle || `@${cleanRegNo.toLowerCase()}`),
            60
          ),
          updatedAt: nowISO,
        },
        { merge: true }
      );

      await batch.commit();
      addToast(
        'Attendee Checked In (+50 pts)',
        `${payload.userName} (${payload.registerNumber}) verified for "${targetEvent.title}".`,
        'success'
      );

      return {
        ok: true,
        alreadyCheckedIn: false,
        checkIn: { id: checkInId, ...payload },
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return {
        ok: false,
        error: 'Could not save gate check-in. Verify Firestore permissions and try again.',
      };
    }
  };

  const exportEventCheckInsCSV: AppContextValue['exportEventCheckInsCSV'] = (filterEventId) => {
    if (!can('canExportRegistrations')) {
      addToast('Export restricted', 'Only the Campus Lead can export check-in attendance.', 'error');
      return;
    }
    const result = buildAttendanceCsvContent({
      events,
      registrations,
      checkIns: eventCheckIns,
      filterEventId,
      mode: 'checkins_only',
    });
    if (result.totalRows === 0) {
      addToast(
        'No check-in records found',
        'Attendance CSV export becomes available once attendees check in.',
        'info'
      );
      return;
    }
    downloadCsvFile(result.csv, result.filename);
    addToast(
      'CSV exported',
      `Downloaded ${result.totalRows} verified attendance record${result.totalRows === 1 ? '' : 's'}.`,
      'success'
    );
  };

  // ---------------- LEADERBOARD CRUD ----------------
  const upsertLeaderboardEntry: AppContextValue['upsertLeaderboardEntry'] = async (entry) => {
    if (!can('canUpdateLeaderboard') || !firebaseUser) return;
    const id = entry.id || `lb_${Date.now()}`;
    const docPayload = {
      name: ensureMinLen(entry.name, 'Paavai Coder', 2, 100),
      registerNumber: ensureMinLen(entry.registerNumber, 'PEC0000', 4, 20),
      department: ensureMinLen(entry.department, 'CSE', 2, 40),
      year: ensureMinLen(entry.year, '1st Year', 2, 20),
      score: Math.min(1000000, Math.max(0, Number(entry.score) || 0)),
      problemsSolved: Math.min(50000, Math.max(0, Number(entry.problemsSolved) || 0)),
      hackerRankHandle: clampStr(entry.hackerRankHandle || '@coder_pec', 60),
      updatedAt: new Date().toISOString(),
    };

    const path = `leaderboard/${id}`;
    try {
      await setDoc(doc(db, 'leaderboard', id), docPayload);
      addToast('Leaderboard updated', `${entry.name}: ${entry.score} pts`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteLeaderboardEntry = async (id: string) => {
    if (!can('canUpdateLeaderboard') || !firebaseUser) return;
    const path = `leaderboard/${id}`;
    try {
      await deleteDoc(doc(db, 'leaderboard', id));
      addToast('Entry removed from leaderboard', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // ---------------- GALLERY & RESOURCES ----------------
  const addGalleryPhoto: AppContextValue['addGalleryPhoto'] = async (photo) => {
    if (!can('canUploadGallery') || !currentUser || !firebaseUser) return;
    const id = `gal_${Date.now()}`;
    const path = `gallery/${id}`;
    try {
      await setDoc(doc(db, 'gallery', id), {
        title: ensureMinLen(photo.title, 'Campus Event Photo', 2, 140),
        category: photo.category,
        date: clampStr(photo.date, 30),
        caption: ensureMinLen(photo.caption, 'Campus Crew snapshot', 3, 500),
        imageUrl: clampStr(photo.imageUrl, 500),
        uploadedByUid: firebaseUser.uid,
        uploadedBy: ensureMinLen(currentUser.name, 'Campus Crew', 2, 100),
      });
      addToast('Photo uploaded', `"${photo.title}" saved to Firestore gallery.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteGalleryPhoto = async (id: string) => {
    if (!can('canDeleteGallery') || !firebaseUser) return;
    const path = `gallery/${id}`;
    try {
      await deleteDoc(doc(db, 'gallery', id));
      addToast('Photo deleted', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addResource: AppContextValue['addResource'] = async (res) => {
    if (!can('canManageResources') || !firebaseUser) return;
    const id = `res_${Date.now()}`;
    const path = `resources/${id}`;
    const safeDocUrl = sanitizeOptionalDocUrl(res.documentUrl);
    try {
      await setDoc(doc(db, 'resources', id), {
        title: ensureMinLen(res.title, 'Practice Module', 3, 140),
        track: res.track,
        level: res.level,
        access: res.access,
        estimatedHours: Math.min(500, Math.max(1, Number(res.estimatedHours) || 6)),
        problemCount: Math.min(2000, Math.max(1, Number(res.problemCount) || 20)),
        summary: ensureMinLen(res.summary, 'Curated HackerRank problem set.', 5, 600),
        url: ensureMinLen(res.url, 'https://www.hackerrank.com', 8, 500),
        ...(safeDocUrl ? { documentUrl: safeDocUrl } : {}),
        topics: (res.topics.length ? res.topics : ['Problem Solving']).slice(0, 10),
      });
      addToast('Resource published', `"${res.title}" added to roadmap.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteResource = async (id: string) => {
    if (!can('canManageResources') || !firebaseUser) return;
    const path = `resources/${id}`;
    try {
      await deleteDoc(doc(db, 'resources', id));
      addToast('Resource removed', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const toggleResourceCompleted = async (resourceId: string) => {
    if (!currentUser || !firebaseUser) {
      addToast('Sign in to track progress', 'Log in to save completed modules.', 'info');
      return;
    }
    const wasCompleted = completedResourceIds.includes(resourceId);
    const next = wasCompleted
      ? completedResourceIds.filter((id) => id !== resourceId)
      : [...completedResourceIds, resourceId];

    const path = `user_progress/${firebaseUser.uid}`;
    try {
      const sliced = next.slice(0, 200);
      const nowISO = new Date().toISOString();
      const dsaCount = resources.filter(
        (r) => r.track === 'DSA' && sliced.includes(r.id)
      ).length;

      const batch = writeBatch(db);
      batch.set(doc(db, 'user_progress', firebaseUser.uid), {
        uid: firebaseUser.uid,
        completedResourceIds: sliced,
        updatedAt: nowISO,
      });

      const matched = resources.find((r) => r.id === resourceId);
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const existingPub = publicProfiles.find((p) => p.uid === firebaseUser.uid);

      const newRecent: PracticeSummary[] = !wasCompleted
        ? [
            {
              title: ensureMinLen(
                matched ? `Completed: ${matched.title}` : 'Completed roadmap module',
                'Completed roadmap module',
                2,
                140
              ),
              platform: 'DSA Roadmap' as CodingPlatform,
              date: localDate,
              count: 1,
            },
            ...(existingPub?.recentPractices || []),
          ].slice(0, 10)
        : existingPub?.recentPractices || [];

      batch.set(
        doc(db, 'public_profiles', firebaseUser.uid),
        {
          uid: firebaseUser.uid,
          name: ensureMinLen(currentUser.name, 'Paavai Coder', 2, 100),
          department: ensureMinLen(currentUser.department, 'CSE', 2, 40),
          year: ensureMinLen(currentUser.year, '1st Year', 2, 20),
          bio: clampStr(currentUser.bio || '', 500),
          photoUrl: sanitizeImageUrl(currentUser.photoUrl),
          skills: (currentUser.skills || []).slice(0, 12),
          hackerRankHandle: clampStr(currentUser.hackerRankHandle || '', 60),
          hackerRankUrl: clampStr(currentUser.hackerRankUrl || '', 300),
          githubUrl: clampStr(currentUser.githubUrl || '', 300),
          linkedinUrl: clampStr(currentUser.linkedinUrl || '', 300),
          completedDsaCount: dsaCount,
          completedRoadmapCount: sliced.length,
          streak: computeCodingStreak(codingActivities, !wasCompleted ? localDate : undefined),
          ...(!wasCompleted ? { lastPracticeAt: nowISO } : {}),
          recentPractices: newRecent,
          updatedAt: nowISO,
        },
        { merge: true }
      );

      if (!wasCompleted) {
        const actId = sanitizeId(`act_rm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        batch.set(doc(db, 'coding_activities', actId), {
          userId: sanitizeId(firebaseUser.uid),
          platform: 'DSA Roadmap',
          date: localDate,
          count: 1,
          title: ensureMinLen(
            matched ? `Completed: ${matched.title}` : 'Completed roadmap module',
            'Completed roadmap module',
            2,
            140
          ),
          createdAt: nowISO,
        });

        const lbSnap = await getDoc(doc(db, 'leaderboard', firebaseUser.uid)).catch(() => null);
        const prevLb = lbSnap?.exists() ? lbSnap.data() : null;
        const prevScore = Number(prevLb?.score || 0);
        const prevSolved = Number(prevLb?.problemsSolved ?? prevLb?.solvedCount ?? 0);

        batch.set(
          doc(db, 'leaderboard', firebaseUser.uid),
          {
            uid: sanitizeId(firebaseUser.uid),
            name: ensureMinLen(currentUser.name, 'Paavai Coder', 2, 100),
            registerNumber: ensureMinLen(
              (currentUser.regNo || 'PEC-MEMBER').replace(/[^A-Za-z0-9-]/g, ''),
              'PEC-MEMBER',
              4,
              20
            ),
            department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
            year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
            score: Math.min(1000000, prevScore + 10),
            problemsSolved: prevSolved,
            solvedCount: prevSolved,
            hackerRankHandle: clampStr(currentUser.hackerRankHandle || '@coder_pec', 60),
            updatedAt: nowISO,
          },
          { merge: true }
        );
      }

      await batch.commit();
      if (!wasCompleted) {
        addToast('Module completed (+10 pts)', 'Leaderboard & public profile updated.', 'success');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const logCodingActivity: AppContextValue['logCodingActivity'] = async (payload) => {
    if (!currentUser || !firebaseUser || !isVerifiedAllowedUser) {
      const msg = 'Sign in with a verified account to log coding activity.';
      addToast('Sign in required', msg, 'error');
      return { ok: false, error: msg };
    }
    const safePlatform: CodingPlatform = CODING_PLATFORMS.includes(payload.platform)
      ? payload.platform
      : 'HackerRank';
    const trimmedDate = payload.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      return { ok: false, error: 'Select a valid YYYY-MM-DD date.' };
    }
    const numericCount = Math.floor(Number(payload.count));
    if (!Number.isFinite(numericCount) || numericCount < 1 || numericCount > 500) {
      return { ok: false, error: 'Completion count must be between 1 and 500.' };
    }
    const cleanedTitle = clampStr(payload.title, 140);
    if (cleanedTitle.length < 2) {
      return { ok: false, error: 'Enter an activity title (at least 2 characters).' };
    }
    const safeNotesUrl = sanitizeOptionalDocUrl(payload.notesUrl);
    if (payload.notesUrl && payload.notesUrl.trim() && !safeNotesUrl) {
      return {
        ok: false,
        error: 'Solution/notes link must be a valid Google Drive or https:// URL.',
      };
    }

    const actId = sanitizeId(`act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const path = `coding_activities/${actId}`;
    const nowISO = new Date().toISOString();

    try {
      const [lbSnap, pubSnap] = await Promise.all([
        getDoc(doc(db, 'leaderboard', firebaseUser.uid)).catch(() => null),
        getDoc(doc(db, 'public_profiles', firebaseUser.uid)).catch(() => null),
      ]);
      const prevLb = lbSnap?.exists() ? lbSnap.data() : null;
      const prevPub = pubSnap?.exists() ? pubSnap.data() : null;

      const cappedDeltaProblems = Math.min(20, numericCount);
      const pointsDelta = cappedDeltaProblems * 10;

      const prevScore = Number(prevLb?.score || 0);
      const prevSolved = Number(prevLb?.problemsSolved ?? prevLb?.solvedCount ?? 0);
      const prevHrSolved = Number(prevPub?.hackerRankSolvedCount || prevSolved || 0);
      const nextSolved = Math.min(50000, prevSolved + cappedDeltaProblems);
      const nextHrSolved =
        safePlatform === 'HackerRank'
          ? Math.min(50000, prevHrSolved + cappedDeltaProblems)
          : prevHrSolved;

      const prevRecentRaw = Array.isArray(prevPub?.recentPractices)
        ? (prevPub.recentPractices as PracticeSummary[])
        : [];
      const nextRecent: PracticeSummary[] = [
        {
          title: cleanedTitle,
          platform: safePlatform,
          date: trimmedDate,
          count: numericCount,
          ...(safeNotesUrl ? { notesUrl: safeNotesUrl } : {}),
        },
        ...prevRecentRaw,
      ].slice(0, 10);

      const dsaCount = resources.filter(
        (r) => r.track === 'DSA' && completedResourceIds.includes(r.id)
      ).length;

      const batch = writeBatch(db);
      batch.set(doc(db, 'coding_activities', actId), {
        userId: sanitizeId(firebaseUser.uid),
        platform: safePlatform,
        date: trimmedDate,
        count: numericCount,
        title: cleanedTitle,
        ...(safeNotesUrl ? { notesUrl: safeNotesUrl } : {}),
        createdAt: nowISO,
      });

      batch.set(
        doc(db, 'public_profiles', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: ensureMinLen(currentUser.name, 'Paavai Coder', 2, 100),
          department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
          year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
          bio: clampStr(currentUser.bio || '', 500),
          photoUrl: sanitizeImageUrl(currentUser.photoUrl),
          skills: (currentUser.skills || []).slice(0, 12),
          hackerRankHandle: clampStr(currentUser.hackerRankHandle || '', 60),
          hackerRankUrl: clampStr(currentUser.hackerRankUrl || '', 300),
          githubUrl: clampStr(currentUser.githubUrl || '', 300),
          linkedinUrl: clampStr(currentUser.linkedinUrl || '', 300),
          completedDsaCount: dsaCount,
          completedRoadmapCount: completedResourceIds.length,
          hackerRankSolvedCount: nextHrSolved,
          streak: computeCodingStreak(codingActivities, trimmedDate),
          lastPracticeAt: nowISO,
          recentPractices: nextRecent,
          updatedAt: nowISO,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'leaderboard', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: ensureMinLen(currentUser.name, 'Paavai Coder', 2, 100),
          registerNumber: ensureMinLen(
            (currentUser.regNo || 'PEC-MEMBER').replace(/[^A-Za-z0-9-]/g, ''),
            'PEC-MEMBER',
            4,
            20
          ),
          department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
          year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
          score: Math.min(1000000, prevScore + pointsDelta),
          problemsSolved: nextSolved,
          solvedCount: nextSolved,
          hackerRankHandle: clampStr(currentUser.hackerRankHandle || '@coder_pec', 60),
          updatedAt: nowISO,
        },
        { merge: true }
      );

      await batch.commit();
      addToast(
        `Activity logged (+${pointsDelta} pts)`,
        `${numericCount} ${safePlatform} completion${numericCount === 1 ? '' : 's'} synced to your profile & leaderboard.`,
        'success'
      );
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return { ok: false, error: 'Could not save coding activity to Firestore.' };
    }
  };

  const syncHackerRankPractice: AppContextValue['syncHackerRankPractice'] = async (
    manualSolvedTotal
  ) => {
    if (!currentUser || !firebaseUser || !isVerifiedAllowedUser) {
      return { ok: false, error: 'Sign in with a verified student account to sync HackerRank practice.' };
    }

    const cleanHandle = (currentUser.hackerRankHandle || '').trim().replace(/^@+/, '');
    if (!cleanHandle) {
      return {
        ok: false,
        error: 'Set your HackerRank handle in your profile before syncing.',
      };
    }

    let resolvedTotal: number | null =
      typeof manualSolvedTotal === 'number' && Number.isFinite(manualSolvedTotal)
        ? Math.max(0, Math.floor(manualSolvedTotal))
        : null;
    let source: 'hackerrank_api' | 'manual_sync' = 'manual_sync';
    let corsBlocked = false;

    if (resolvedTotal === null) {
      try {
        const res = await fetch(
          `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(cleanHandle)}/badges`,
          { mode: 'cors' }
        );
        if (res.ok) {
          const json = (await res.json()) as {
            models?: Array<{ solved?: number }>;
          };
          if (Array.isArray(json.models)) {
            resolvedTotal = json.models.reduce(
              (acc, badge) => acc + Math.max(0, Number(badge.solved || 0)),
              0
            );
            source = 'hackerrank_api';
          }
        }
      } catch {
        corsBlocked = true;
      }
    }

    const [lbSnap, pubSnap] = await Promise.all([
      getDoc(doc(db, 'leaderboard', firebaseUser.uid)).catch(() => null),
      getDoc(doc(db, 'public_profiles', firebaseUser.uid)).catch(() => null),
    ]);
    const prevLb = lbSnap?.exists() ? lbSnap.data() : null;
    const prevPub = pubSnap?.exists() ? pubSnap.data() : null;

    const prevSolved = Number(prevLb?.problemsSolved ?? prevLb?.solvedCount ?? 0);
    const prevHrSolved = Number(prevPub?.hackerRankSolvedCount ?? prevSolved);
    const prevScore = Number(prevLb?.score || 0);

    // If browser CORS prevented live HackerRank fetch and no manual total was supplied,
    // sync existing logged HackerRank activities into public_profiles & leaderboard cleanly.
    const loggedHrSum = codingActivities
      .filter((a) => a.platform === 'HackerRank')
      .reduce((sum, a) => sum + Math.max(0, a.count), 0);

    const targetTotal =
      resolvedTotal !== null
        ? Math.max(prevHrSolved, resolvedTotal)
        : Math.max(prevHrSolved, loggedHrSum);

    const rawDelta = Math.max(0, targetTotal - prevSolved);
    const cappedDelta = Math.min(20, rawDelta);
    const pointsDelta = cappedDelta * 10;
    const nextSolved = prevSolved + cappedDelta;
    const nowISO = new Date().toISOString();
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const dsaCount = resources.filter(
      (r) => r.track === 'DSA' && completedResourceIds.includes(r.id)
    ).length;

    const prevRecentRaw = Array.isArray(prevPub?.recentPractices)
      ? (prevPub.recentPractices as PracticeSummary[])
      : [];
    const nextRecent: PracticeSummary[] =
      cappedDelta > 0
        ? [
            {
              title: `HackerRank Sync (@${cleanHandle})`,
              platform: 'HackerRank' as CodingPlatform,
              date: localDate,
              count: cappedDelta,
            },
            ...prevRecentRaw,
          ].slice(0, 10)
        : prevRecentRaw;

    try {
      const batch = writeBatch(db);
      if (cappedDelta > 0) {
        const actId = sanitizeId(`act_hr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        batch.set(doc(db, 'coding_activities', actId), {
          userId: sanitizeId(firebaseUser.uid),
          platform: 'HackerRank',
          date: localDate,
          count: cappedDelta,
          title: clampStr(`HackerRank Sync (@${cleanHandle})`, 140),
          createdAt: nowISO,
        });
      }

      batch.set(
        doc(db, 'public_profiles', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: ensureMinLen(currentUser.name, 'Paavai Coder', 2, 100),
          department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
          year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
          bio: clampStr(currentUser.bio || '', 500),
          photoUrl: sanitizeImageUrl(currentUser.photoUrl),
          skills: (currentUser.skills || []).slice(0, 12),
          hackerRankHandle: `@${cleanHandle}`,
          hackerRankUrl: clampStr(
            currentUser.hackerRankUrl || `https://www.hackerrank.com/profile/${cleanHandle}`,
            300
          ),
          githubUrl: clampStr(currentUser.githubUrl || '', 300),
          linkedinUrl: clampStr(currentUser.linkedinUrl || '', 300),
          completedDsaCount: dsaCount,
          completedRoadmapCount: completedResourceIds.length,
          hackerRankSolvedCount: Math.max(prevHrSolved, nextSolved),
          streak: computeCodingStreak(codingActivities, cappedDelta > 0 ? localDate : undefined),
          lastPracticeAt: nowISO,
          recentPractices: nextRecent,
          updatedAt: nowISO,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'leaderboard', firebaseUser.uid),
        {
          uid: sanitizeId(firebaseUser.uid),
          name: ensureMinLen(currentUser.name, 'Paavai Coder', 2, 100),
          registerNumber: ensureMinLen(
            (currentUser.regNo || 'PEC-MEMBER').replace(/[^A-Za-z0-9-]/g, ''),
            'PEC-MEMBER',
            4,
            20
          ),
          department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
          year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
          score: Math.min(1000000, prevScore + pointsDelta),
          problemsSolved: nextSolved,
          solvedCount: nextSolved,
          hackerRankHandle: `@${cleanHandle}`,
          updatedAt: nowISO,
        },
        { merge: true }
      );

      await batch.commit();

      if (cappedDelta > 0) {
        addToast(
          `HackerRank synced (+${pointsDelta} pts)`,
          `Added ${cappedDelta} new solved problem${cappedDelta === 1 ? '' : 's'} for @${cleanHandle}. Leaderboard updated immediately.`,
          'success'
        );
      } else if (corsBlocked && manualSolvedTotal === undefined) {
        addToast(
          'Profile aligned with local logs',
          'Browser CORS blocks direct HackerRank API reads. Nightly GitHub sync updates @' +
            cleanHandle +
            ' automatically, or enter your solved count to sync immediately.',
          'info'
        );
      } else {
        addToast(
          'HackerRank profile up to date',
          `@${cleanHandle} is synced (${nextSolved} solved problems).`,
          'info'
        );
      }

      return {
        ok: true,
        delta: cappedDelta,
        totalSolved: nextSolved,
        source,
        corsBlocked,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaderboard/${firebaseUser.uid}`);
      return { ok: false, error: 'Failed to sync HackerRank practice to Firestore.' };
    }
  };

  const deleteCodingActivity: AppContextValue['deleteCodingActivity'] = async (activityId) => {
    if (!currentUser || !firebaseUser) return;
    const sanitized = sanitizeId(activityId);
    const path = `coding_activities/${sanitized}`;
    try {
      await deleteDoc(doc(db, 'coding_activities', sanitized));
      addToast('Activity removed', 'Removed entry from your coding heatmap.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // ---------------- USERS, JOIN REQUESTS & SITE SETTINGS ----------------
  const updateUserRole = async (userId: string, newRole: Exclude<UserRole, 'outsider'>) => {
    if (!can('canAssignRoles') || !firebaseUser) return;
    if (userId === currentUser?.id) {
      addToast('Action blocked', 'You cannot change your own role.', 'error');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    const displayName = targetUser?.name || 'Member';
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });

      if (newRole === 'lead' || newRole === 'crew') {
        const userSnap = targetUser ? null : await getDoc(doc(db, 'users', userId));
        const src = targetUser
          ? {
              name: targetUser.name,
              department: targetUser.department,
              year: targetUser.year,
              bio: targetUser.bio,
              photoUrl: targetUser.photoUrl || '',
              hackerRankHandle: targetUser.hackerRankHandle,
            }
          : {
              name: String(userSnap?.data()?.name || displayName),
              department: String(userSnap?.data()?.department || 'CSE'),
              year: String(userSnap?.data()?.year || '1st Year'),
              bio: String(userSnap?.data()?.bio || ''),
              photoUrl: String(userSnap?.data()?.photoUrl || ''),
              hackerRankHandle: String(userSnap?.data()?.hackerRankHandle || ''),
            };

        await setDoc(
          doc(db, 'team_members', userId),
          buildTeamMemberPayload({
            uid: userId,
            name: src.name,
            role: newRole,
            department: src.department,
            year: src.year,
            bio: src.bio,
            photoUrl: src.photoUrl,
            hackerRankHandle: src.hackerRankHandle,
          })
        );
      } else {
        await deleteDoc(doc(db, 'team_members', userId));
      }

      addToast(
        'Role updated',
        `${displayName} is now ${ROLE_META[newRole].label}.`,
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const updateMemberPhotoUrl = async (
    userId: string,
    photoUrl: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!can('canManageUsers') || !firebaseUser) {
      return { ok: false, error: 'Only the Campus Lead can update member photo URLs.' };
    }
    if (!isValidOptionalImageUrl(photoUrl)) {
      const msg = 'Image URL must start with https:// or http:// (max 500 characters).';
      addToast('Invalid image URL', msg, 'error');
      return { ok: false, error: msg };
    }
    const cleanUrl = sanitizeImageUrl(photoUrl);
    const nowISO = new Date().toISOString();
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        photoUrl: cleanUrl,
        updatedAt: nowISO,
      });

      const targetUser = users.find((u) => u.id === userId);
      const userSnap = targetUser ? null : await getDoc(doc(db, 'users', userId));
      const role = (targetUser?.role || userSnap?.data()?.role) as Exclude<UserRole, 'outsider'>;
      const targetName = targetUser?.name || String(userSnap?.data()?.name || 'Member');

      if (role === 'lead' || role === 'crew') {
        await setDoc(
          doc(db, 'team_members', userId),
          buildTeamMemberPayload({
            uid: userId,
            name: targetName,
            role,
            department: targetUser?.department || String(userSnap?.data()?.department || 'CSE'),
            year: targetUser?.year || String(userSnap?.data()?.year || '1st Year'),
            bio: targetUser?.bio || String(userSnap?.data()?.bio || ''),
            photoUrl: cleanUrl,
            hackerRankHandle:
              targetUser?.hackerRankHandle || String(userSnap?.data()?.hackerRankHandle || ''),
          })
        );
      }

      addToast(
        cleanUrl ? 'Profile photo updated' : 'Profile photo cleared',
        `${targetName}'s photo is synced in Firestore.`,
        'success'
      );
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      return { ok: false, error: 'Failed to update member photo URL.' };
    }
  };

  const deleteUser = async (userId: string) => {
    if (!can('canDeleteUsers') || !firebaseUser) return;
    if (userId === currentUser?.id) {
      addToast('Cannot remove active session', 'You cannot delete your own active account.', 'error');
      return;
    }
    const path = `users/${userId}`;
    try {
      const knownUser = users.find((u) => u.id === userId);
      const userSnap = knownUser ? null : await getDoc(doc(db, 'users', userId));
      const emailVal = knownUser?.email ?? String(userSnap?.data()?.email || '');
      const phoneVal = knownUser?.phone ?? String(userSnap?.data()?.phone || '');
      const collegeEmailVal =
        knownUser?.collegeEmail ??
        String(
          userSnap?.data()?.collegeEmail ||
            (isCollegeEmailId(String(userSnap?.data()?.email || ''))
              ? userSnap?.data()?.email
              : '')
        );

      await deleteDoc(doc(db, 'users', userId));
      await deleteDoc(doc(db, 'team_members', userId));
      await deleteDoc(doc(db, 'public_profiles', userId)).catch(() => {});

      if (isValidAccountEmail(emailVal)) {
        const emailLockId = await getEmailLockId(emailVal);
        await deleteDoc(doc(db, 'unique_emails', emailLockId)).catch(() => {});
      }
      if (isValidPhoneNumber(phoneVal)) {
        const phoneLockId = await getPhoneLockId(phoneVal);
        await deleteDoc(doc(db, 'unique_phones', phoneLockId)).catch(() => {});
      }
      if (isCollegeEmailId(collegeEmailVal)) {
        const collegeEmailLockId = await getCollegeEmailLockId(collegeEmailVal);
        await deleteDoc(doc(db, 'unique_college_emails', collegeEmailLockId)).catch(() => {});
      }

      addToast('User removed', 'Deleted from Firestore directory and uniqueness locks.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const submitJoinRequest: AppContextValue['submitJoinRequest'] = async (req) => {
    const id = `req_${Date.now()}`;
    const docPayload = {
      name: ensureMinLen(req.name, 'Student Applicant', 3, 100),
      registerNumber: ensureMinLen(req.registerNumber.toUpperCase(), 'PEC0000', 4, 20),
      department: ensureMinLen(req.department, 'CSE', 2, 40),
      year: ensureMinLen(req.year, '1st Year', 2, 20),
      email: clampStr(req.email.toLowerCase(), 160),
      phone: ensureMinLen(req.phone, '0000000000', 8, 20),
      skills: ensureMinLen(req.skills, 'Programming', 2, 400),
      submittedAt: new Date().toISOString().slice(0, 10),
      status: 'pending' as const,
    };

    const path = `join_requests/${id}`;
    try {
      await setDoc(doc(db, 'join_requests', id), docPayload);
      try {
        localStorage.setItem(PENDING_JOIN_REQ_KEY, id);
      } catch {
        // Ignore storage errors
      }
      addToast(
        'Application submitted',
        'Saved to Firestore. Complete your verified signup to activate immediately.',
        'success'
      );
      return { ok: true, id };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return { ok: false };
    }
  };

  const dispatchJoinRequestNotificationEmail = async (
    reqDoc: JoinRequest,
    decision: 'approved' | 'rejected',
    options?: { reviewNote?: string; leadPhoneOverride?: string }
  ): Promise<{
    emailStatus: 'sent' | 'queued' | 'failed';
    emailMessage?: string;
    emailSentAt?: string;
  }> => {
    if (!firebaseUser) {
      return { emailStatus: 'failed', emailMessage: 'Sign in required.' };
    }

    const leadUser =
      users.find((u) => u.role === 'lead') ||
      (currentUser?.role === 'lead' ? currentUser : null);
    const resolvedLeadName =
      (siteSettings.leadName || '').trim() || leadUser?.name || currentUser?.name || 'Campus Lead';
    const resolvedLeadPhone =
      (options?.leadPhoneOverride ?? '').trim() ||
      (siteSettings.leadPhone || '').trim() ||
      (leadUser?.phone || '').trim() ||
      (currentUser?.phone || '').trim();
    const resolvedLeadEmail =
      (siteSettings.contactEmail || '').trim() ||
      leadUser?.email ||
      CAMPUS_LEAD_EMAIL;
    const cleanedNote = clampStr((options?.reviewNote ?? reqDoc.reviewNote ?? '').trim(), 400);
    const logType: EmailSendAttempt['type'] =
      decision === 'approved' ? 'join_request_approved' : 'join_request_rejected';

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/join-requests/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          requestId: reqDoc.id,
          applicantName: reqDoc.name,
          applicantEmail: reqDoc.email,
          registerNumber: reqDoc.registerNumber,
          department: reqDoc.department,
          year: reqDoc.year,
          decision,
          reviewNote: cleanedNote,
          leadName: resolvedLeadName,
          leadPhone: resolvedLeadPhone,
          leadEmail: resolvedLeadEmail,
          chapterName: siteSettings.chapterName,
          collegeName: siteSettings.collegeName,
          portalUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? ((await response.json()) as {
            ok?: boolean;
            delivered?: boolean;
            provider?: string;
            reason?: string;
            message?: string;
          })
        : null;

      if (response.ok && result?.delivered) {
        const sentAt = new Date().toISOString();
        await logEmailSendAttempt({
          type: logType,
          email: reqDoc.email,
          status: 'sent',
          errorCode: result.provider ? `provider_${result.provider}` : '',
          errorMessage:
            decision === 'approved'
              ? `Approval mail sent (Lead call contact: ${resolvedLeadPhone || resolvedLeadName})`
              : 'Rejection notification mail sent.',
          actorUid: firebaseUser.uid,
        });
        return {
          emailStatus: 'sent',
          emailSentAt: sentAt,
          emailMessage:
            decision === 'approved'
              ? `Automated acceptance email sent to ${reqDoc.email} (instructing them to call the Campus Lead).`
              : `Automated rejection email sent to ${reqDoc.email}.`,
        };
      }

      const isNotConfigured =
        result?.reason === 'mail_not_configured' || !contentType.includes('application/json');
      const fallbackStatus: 'queued' | 'failed' = isNotConfigured ? 'queued' : 'failed';
      const errMsg = clampStr(
        result?.message ||
          (isNotConfigured
            ? 'SMTP_USER / SMTP_PASS (or RESEND_API_KEY) not configured on server yet.'
            : `Email API returned HTTP ${response.status}.`),
        290
      );

      await logEmailSendAttempt({
        type: logType,
        email: reqDoc.email,
        status: 'failed',
        errorCode: clampStr(result?.reason || (isNotConfigured ? 'mail_not_configured' : `http_${response.status}`), 160),
        errorMessage: errMsg,
        actorUid: firebaseUser.uid,
      });

      return {
        emailStatus: fallbackStatus,
        emailMessage: errMsg,
      };
    } catch (err) {
      const errMsg = clampStr(
        err instanceof Error ? err.message : 'Network error calling mail automation endpoint.',
        290
      );
      await logEmailSendAttempt({
        type: logType,
        email: reqDoc.email,
        status: 'failed',
        errorCode: 'network_error',
        errorMessage: errMsg,
        actorUid: firebaseUser.uid,
      });
      return {
        emailStatus: 'queued',
        emailMessage: errMsg,
      };
    }
  };

  const reviewJoinRequest: AppContextValue['reviewJoinRequest'] = async (
    requestId,
    decision,
    options
  ) => {
    if (!can('canManageUsers') || !firebaseUser) {
      return { ok: false, emailStatus: 'failed', emailMessage: 'Campus Lead access required.' };
    }
    const targetReq = joinRequests.find((r) => r.id === requestId);
    const path = `join_requests/${requestId}`;
    const reviewedAt = new Date().toISOString();
    const cleanedNote = clampStr((options?.reviewNote || '').trim(), 400);

    try {
      await updateDoc(doc(db, 'join_requests', requestId), {
        status: decision,
        reviewedAt,
        reviewedByUid: firebaseUser.uid,
        reviewNote: cleanedNote,
        emailNotificationStatus: 'queued',
        emailError: '',
      });

      if (!targetReq) {
        addToast(
          decision === 'approved' ? 'Join request approved' : 'Join request declined',
          'Status updated in Firestore.',
          decision === 'approved' ? 'success' : 'info'
        );
        return { ok: true, emailStatus: 'queued' };
      }

      const mailRes = await dispatchJoinRequestNotificationEmail(targetReq, decision, options);

      await updateDoc(doc(db, 'join_requests', requestId), {
        emailNotificationStatus: mailRes.emailStatus,
        emailSentAt: mailRes.emailSentAt || '',
        emailError: mailRes.emailStatus === 'sent' ? '' : clampStr(mailRes.emailMessage || '', 290),
      });

      if (mailRes.emailStatus === 'sent') {
        addToast(
          decision === 'approved' ? 'Approved & Automated Mail Sent' : 'Rejected & Automated Mail Sent',
          mailRes.emailMessage,
          decision === 'approved' ? 'success' : 'info'
        );
      } else {
        addToast(
          decision === 'approved' ? 'Approved (Mail Queued)' : 'Rejected (Mail Queued)',
          mailRes.emailMessage ||
            'Configure SMTP_USER & SMTP_PASS in Secrets for automatic delivery, or use Open Email Draft.',
          'info'
        );
      }

      return {
        ok: true,
        emailStatus: mailRes.emailStatus,
        emailMessage: mailRes.emailMessage,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      return { ok: false, emailStatus: 'failed', emailMessage: 'Could not update join request.' };
    }
  };

  const resendJoinRequestEmail: AppContextValue['resendJoinRequestEmail'] = async (
    requestId,
    options
  ) => {
    if (!can('canManageUsers') || !firebaseUser) {
      return { ok: false, emailStatus: 'failed', emailMessage: 'Campus Lead access required.' };
    }
    const targetReq = joinRequests.find((r) => r.id === requestId);
    if (!targetReq || (targetReq.status !== 'approved' && targetReq.status !== 'rejected')) {
      return {
        ok: false,
        emailStatus: 'failed',
        emailMessage: 'Only approved or rejected join requests can resend decision emails.',
      };
    }

    const path = `join_requests/${requestId}`;
    try {
      const mailRes = await dispatchJoinRequestNotificationEmail(
        targetReq,
        targetReq.status,
        options
      );
      await updateDoc(doc(db, 'join_requests', requestId), {
        emailNotificationStatus: mailRes.emailStatus,
        emailSentAt: mailRes.emailSentAt || targetReq.emailSentAt || '',
        emailError: mailRes.emailStatus === 'sent' ? '' : clampStr(mailRes.emailMessage || '', 290),
      });

      addToast(
        mailRes.emailStatus === 'sent' ? 'Automated Mail Resent' : 'Mail Still Queued / Failed',
        mailRes.emailMessage,
        mailRes.emailStatus === 'sent' ? 'success' : 'error'
      );

      return {
        ok: mailRes.emailStatus === 'sent',
        emailStatus: mailRes.emailStatus,
        emailMessage: mailRes.emailMessage,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      return { ok: false, emailStatus: 'failed', emailMessage: 'Failed to update mail status.' };
    }
  };

  const deleteJoinRequest: AppContextValue['deleteJoinRequest'] = async (requestId) => {
    if (!can('canManageUsers') || !firebaseUser) return;
    const path = `join_requests/${requestId}`;
    try {
      await deleteDoc(doc(db, 'join_requests', requestId));
      addToast('Join inquiry deleted', 'Removed from Firestore.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const refreshEmailSendAttempts = async () => {
    if (!can('canAccessAdminPanel') || !firebaseUser) return;
    try {
      const snap = await getDocs(collection(db, 'emailSendAttempts'));
      const mapped: EmailSendAttempt[] = snap.docs
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            type: normalizeEmailAttemptType(x.type),
            email: String(x.email || ''),
            status: (x.status === 'failed' ? 'failed' : 'sent') as EmailSendAttempt['status'],
            errorCode: x.errorCode ? String(x.errorCode) : undefined,
            errorMessage: x.errorMessage ? String(x.errorMessage) : undefined,
            continueUrl: x.continueUrl ? String(x.continueUrl) : undefined,
            actorUid: x.actorUid ? String(x.actorUid) : undefined,
            attemptedAt: String(x.attemptedAt || ''),
          };
        })
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
      setEmailSendAttempts(mapped);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'emailSendAttempts');
    }
  };

  const deleteEmailSendAttempt = async (id: string) => {
    if (!can('canAccessAdminPanel') || !firebaseUser) return;
    const path = `emailSendAttempts/${id}`;
    try {
      await deleteDoc(doc(db, 'emailSendAttempts', id));
      addToast('Log entry deleted', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const updateSiteSettings = async (updates: Partial<SiteSettings>) => {
    if (!can('canManageSiteSettings') || !firebaseUser) return;
    const merged = { ...siteSettings, ...updates };
    const path = 'site_settings/main';
    try {
      await setDoc(doc(db, 'site_settings', 'main'), {
        chapterName: ensureMinLen(merged.chapterName, INITIAL_SITE_SETTINGS.chapterName, 2, 100),
        collegeName: ensureMinLen(merged.collegeName, INITIAL_SITE_SETTINGS.collegeName, 2, 120),
        tagline: ensureMinLen(merged.tagline, INITIAL_SITE_SETTINGS.tagline, 2, 120),
        contactEmail: clampStr(merged.contactEmail || INITIAL_SITE_SETTINGS.contactEmail, 160),
        leadName: clampStr(merged.leadName || '', 100),
        leadPhone: clampStr(merged.leadPhone || '', 25),
        campusLocation: ensureMinLen(
          merged.campusLocation,
          INITIAL_SITE_SETTINGS.campusLocation,
          4,
          200
        ),
        applicationsOpen: Boolean(merged.applicationsOpen),
        publicLeaderboardLimit: Math.min(
          50,
          Math.max(3, Number(merged.publicLeaderboardLimit) || 10)
        ),
        hackerRankClubUrl: ensureMinLen(
          merged.hackerRankClubUrl,
          INITIAL_SITE_SETTINGS.hackerRankClubUrl,
          8,
          300
        ),
        updatedAt: new Date().toISOString(),
      });
      addToast('Site settings saved', 'Persisted to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const updateOwnProfile: AppContextValue['updateOwnProfile'] = async (updates) => {
    if (!currentUser || !firebaseUser || !can('canEditOwnProfile')) return;
    const path = `users/${firebaseUser.uid}`;
    const nextName =
      updates.name !== undefined
        ? ensureMinLen(updates.name, currentUser.name || 'Paavai Coder', 2, 100)
        : currentUser.name;
    const nextDepartment =
      updates.department !== undefined
        ? ensureMinLen(updates.department, currentUser.department || 'CSE', 2, 40)
        : currentUser.department;
    const nextYear =
      updates.year !== undefined
        ? ensureMinLen(updates.year, currentUser.year || '1st Year', 2, 20)
        : currentUser.year;
    const nextHandle =
      updates.hackerRankHandle !== undefined
        ? clampStr(updates.hackerRankHandle, 60)
        : currentUser.hackerRankHandle;
    const nextHackerRankUrl =
      updates.hackerRankUrl !== undefined
        ? clampStr(updates.hackerRankUrl, 300)
        : currentUser.hackerRankUrl || '';
    const nextGithubUrl =
      updates.githubUrl !== undefined
        ? clampStr(updates.githubUrl, 300)
        : currentUser.githubUrl || '';
    const nextLinkedinUrl =
      updates.linkedinUrl !== undefined
        ? clampStr(updates.linkedinUrl, 300)
        : currentUser.linkedinUrl || '';
    if (updates.photoUrl !== undefined && !isValidOptionalImageUrl(updates.photoUrl)) {
      addToast(
        'Invalid image URL',
        'Profile image URL must start with https:// or http:// (max 500 characters).',
        'error'
      );
      return;
    }
    const nextPhotoUrl =
      updates.photoUrl !== undefined
        ? sanitizeImageUrl(updates.photoUrl)
        : sanitizeImageUrl(currentUser.photoUrl);
    if (
      updates.documentUrl !== undefined &&
      updates.documentUrl.trim() &&
      !sanitizeOptionalDocUrl(updates.documentUrl)
    ) {
      addToast(
        'Invalid document URL',
        'Portfolio/document URL must be a valid Google Drive or https:// link.',
        'error'
      );
      return;
    }
    const nextDocumentUrl =
      updates.documentUrl !== undefined
        ? sanitizeOptionalDocUrl(updates.documentUrl)
        : sanitizeOptionalDocUrl(currentUser.documentUrl);
    const nextBio =
      updates.bio !== undefined ? clampStr(updates.bio, 500) : currentUser.bio;
    const nextSkills =
      updates.skills !== undefined
        ? updates.skills.slice(0, 12)
        : currentUser.skills;
    const nowISO = new Date().toISOString();

    let nextPhoneStr: string | undefined;
    let newPhoneLockId: string | null = null;
    let oldPhoneLockId: string | null = null;

    if (updates.phone !== undefined) {
      const trimmedPhone = updates.phone.trim();
      if (trimmedPhone) {
        if (!isValidPhoneNumber(trimmedPhone)) {
          addToast(
            'Invalid phone number',
            'Enter a valid 10-digit phone number.',
            'error'
          );
          return;
        }
        const normalizedNew = normalizePhoneNumber(trimmedPhone);
        const normalizedPrev = normalizePhoneNumber(currentUser.phone);
        nextPhoneStr = clampStr(normalizedNew, 20);
        if (normalizedNew !== normalizedPrev) {
          newPhoneLockId = await getPhoneLockId(normalizedNew);
          const lockSnap = await getDoc(doc(db, 'unique_phones', newPhoneLockId));
          if (lockSnap.exists() && lockSnap.data()?.uid !== firebaseUser.uid) {
            addToast(
              'Duplicate phone number',
              'A user with this phone number is already found in the database. Try using other data.',
              'error'
            );
            return;
          }
          if (!lockSnap.exists()) {
            try {
              await setDoc(doc(db, 'unique_phones', newPhoneLockId), {
                uid: firebaseUser.uid,
                createdAt: nowISO,
              });
            } catch {
              addToast(
                'Duplicate phone number',
                'A user with this phone number is already found in the database. Try using other data.',
                'error'
              );
              return;
            }
          }
          if (isValidPhoneNumber(normalizedPrev)) {
            oldPhoneLockId = await getPhoneLockId(normalizedPrev);
          }
        }
      } else {
        nextPhoneStr = '';
      }
    }

    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        ...(updates.name !== undefined ? { name: nextName } : {}),
        ...(updates.regNo !== undefined
          ? { regNo: clampStr(updates.regNo.toUpperCase(), 20) }
          : {}),
        ...(updates.department !== undefined ? { department: nextDepartment } : {}),
        ...(updates.year !== undefined ? { year: nextYear } : {}),
        ...(updates.phone !== undefined ? { phone: nextPhoneStr } : {}),
        ...(updates.photoUrl !== undefined ? { photoUrl: nextPhotoUrl } : {}),
        ...(updates.documentUrl !== undefined ? { documentUrl: nextDocumentUrl } : {}),
        ...(updates.hackerRankHandle !== undefined ? { hackerRankHandle: nextHandle } : {}),
        ...(updates.hackerRankUrl !== undefined ? { hackerRankUrl: nextHackerRankUrl } : {}),
        ...(updates.githubUrl !== undefined ? { githubUrl: nextGithubUrl } : {}),
        ...(updates.linkedinUrl !== undefined ? { linkedinUrl: nextLinkedinUrl } : {}),
        ...(updates.bio !== undefined ? { bio: nextBio } : {}),
        ...(updates.skills !== undefined ? { skills: nextSkills } : {}),
        updatedAt: nowISO,
      });

      if (oldPhoneLockId && oldPhoneLockId !== newPhoneLockId) {
        const oldSnap = await getDoc(doc(db, 'unique_phones', oldPhoneLockId)).catch(() => null);
        if (oldSnap?.exists() && oldSnap.data()?.uid === firebaseUser.uid) {
          await deleteDoc(doc(db, 'unique_phones', oldPhoneLockId)).catch(() => {});
        }
      }

      const dsaCount = resources.filter(
        (r) => r.track === 'DSA' && completedResourceIds.includes(r.id)
      ).length;

      await setDoc(
        doc(db, 'public_profiles', firebaseUser.uid),
        {
          uid: firebaseUser.uid,
          name: nextName,
          department: nextDepartment,
          year: nextYear,
          bio: nextBio,
          photoUrl: nextPhotoUrl,
          documentUrl: nextDocumentUrl,
          skills: nextSkills,
          hackerRankHandle: nextHandle,
          hackerRankUrl: nextHackerRankUrl,
          githubUrl: nextGithubUrl,
          linkedinUrl: nextLinkedinUrl,
          completedDsaCount: dsaCount,
          completedRoadmapCount: completedResourceIds.length,
          updatedAt: nowISO,
        },
        { merge: true }
      );

      if (currentUser.role === 'lead' || currentUser.role === 'crew') {
        await setDoc(
          doc(db, 'team_members', firebaseUser.uid),
          buildTeamMemberPayload({
            uid: firebaseUser.uid,
            name: nextName,
            role: currentUser.role,
            department: nextDepartment,
            year: nextYear,
            bio: nextBio,
            photoUrl: nextPhotoUrl,
            hackerRankHandle: nextHandle,
          })
        );
      }

      addToast('Profile saved', 'Updated in Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // ---------------- UNSTOP CSV PARTICIPANT IMPORT ACTIONS ----------------
  const importUnstopParticipants: AppContextValue['importUnstopParticipants'] = async (
    eventId,
    rows
  ) => {
    if (!currentUser || !can('canAccessCrewDashboard')) {
      return { ok: false, error: 'Only Campus Crew and Campus Lead can import Unstop CSVs.' };
    }
    const targetEvent = events.find((e) => e.id === eventId);
    if (!targetEvent) {
      return { ok: false, error: 'Selected event was not found.' };
    }
    if (rows.length === 0) {
      return { ok: false, error: 'No valid participant rows to import.' };
    }

    const nowIso = new Date().toISOString();
    const importerName = ensureMinLen(currentUser.name, 'Campus Organizer', 2, 100);
    const eventTitle = ensureMinLen(targetEvent.title, 'Campus Event', 2, 140);

    try {
      // Write in Firestore batches of 400 (limit is 500 per batch)
      for (let i = 0; i < rows.length; i += 400) {
        const chunk = rows.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const row of chunk) {
          const docId = sanitizeId(buildUnstopParticipantDocId(targetEvent.id, row.email));
          const payload: Record<string, string> = {
            eventId: targetEvent.id,
            eventTitle,
            name: clampStr(row.name || 'Participant', 100),
            email: clampStr(row.email.trim().toLowerCase(), 120),
            importedAt: nowIso,
            importedByUid: currentUser.id,
            importedByName: importerName,
          };
          if (row.registerNumber) payload.registerNumber = clampStr(row.registerNumber, 32);
          if (row.college) payload.college = clampStr(row.college, 160);
          if (row.teamName) payload.teamName = clampStr(row.teamName, 100);
          if (row.status) payload.status = clampStr(row.status, 60);
          if (row.phone) payload.phone = clampStr(row.phone, 20);
          if (row.matchedUserId) payload.matchedUserId = clampStr(row.matchedUserId, 128);

          batch.set(doc(db, 'unstop_participants', docId), payload);
        }
        await batch.commit();
      }

      addToast(
        'Unstop CSV Imported',
        `Saved ${rows.length} participant${rows.length === 1 ? '' : 's'} for "${targetEvent.title}".`,
        'success'
      );
      return { ok: true, importedCount: rows.length };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'unstop_participants');
      return { ok: false, error: 'Could not save imported participants to Firestore.' };
    }
  };

  const deleteUnstopParticipant: AppContextValue['deleteUnstopParticipant'] = async (id) => {
    if (!can('canApproveContent')) {
      addToast('Permission Denied', 'Only the Campus Lead can remove imported records.', 'error');
      return;
    }
    const cleanId = sanitizeId(id);
    try {
      await deleteDoc(doc(db, 'unstop_participants', cleanId));
      addToast('Participant Removed', 'Unstop participant record deleted.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `unstop_participants/${cleanId}`);
    }
  };

  const clearEventUnstopParticipants: AppContextValue['clearEventUnstopParticipants'] = async (
    eventId
  ) => {
    if (!can('canApproveContent')) {
      addToast('Permission Denied', 'Only the Campus Lead can clear imported rosters.', 'error');
      return;
    }
    const targets = unstopParticipants.filter((p) => p.eventId === eventId);
    if (targets.length === 0) return;

    try {
      for (let i = 0; i < targets.length; i += 400) {
        const chunk = targets.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((p) => batch.delete(doc(db, 'unstop_participants', p.id)));
        await batch.commit();
      }
      addToast(
        'Unstop Roster Cleared',
        `Removed ${targets.length} imported record${targets.length === 1 ? '' : 's'}.`,
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'unstop_participants');
    }
  };

  // ---------------- VERIFIABLE E-CERTIFICATE ACTIONS ----------------
  const claimParticipationCertificate: AppContextValue['claimParticipationCertificate'] = async (
    eventId
  ) => {
    if (!currentUser || !firebaseUser) {
      return { ok: false, error: 'Sign in with a verified student account to claim certificates.' };
    }
    const targetEvent = events.find((e) => e.id === eventId);
    if (!targetEvent) {
      return { ok: false, error: 'Event details were not found.' };
    }

    const checkInRecord = eventCheckIns.find(
      (c) => c.eventId === eventId && c.userId === currentUser.id
    );
    if (!checkInRecord) {
      return {
        ok: false,
        error: 'Verified QR event check-in is required before claiming a Participation E-Certificate.',
      };
    }

    const certId = `CERT-${eventId}-${currentUser.id}`;
    const path = `certificates/${certId}`;

    try {
      const existingSnap = await getDoc(doc(db, 'certificates', certId));
      if (existingSnap.exists()) {
        const x = existingSnap.data();
        const existingCert: EventCertificate = {
          id: existingSnap.id,
          certId: String(x.certId || existingSnap.id),
          eventId: String(x.eventId || eventId),
          eventTitle: String(x.eventTitle || targetEvent.title),
          eventDate: String(x.eventDate || targetEvent.dateISO),
          recipientUid: x.recipientUid ? String(x.recipientUid) : undefined,
          recipientName: String(x.recipientName || currentUser.name),
          registerNumber: x.registerNumber ? String(x.registerNumber) : undefined,
          department: x.department ? String(x.department) : undefined,
          awardType: (x.awardType as CertificateAwardType) || 'Participation',
          awardTitle: x.awardTitle ? String(x.awardTitle) : undefined,
          issuedAt: String(x.issuedAt || new Date().toISOString()),
          issuedByUid: String(x.issuedByUid || currentUser.id),
          issuedByName: String(x.issuedByName || siteSettings.leadName || 'Campus Lead'),
        };
        return { ok: true, certificate: existingCert, alreadyIssued: true };
      }

      const nowIso = new Date().toISOString();
      const payload: Record<string, string> = {
        certId,
        eventId: targetEvent.id,
        eventTitle: ensureMinLen(targetEvent.title, 'Campus Event', 2, 140),
        eventDate: ensureMinLen(targetEvent.dateISO, nowIso.slice(0, 10), 4, 40),
        recipientUid: currentUser.id,
        recipientName: ensureMinLen(currentUser.name, 'Student Member', 2, 100),
        awardType: 'Participation',
        awardTitle: 'for active participation and verified QR attendance in',
        issuedAt: nowIso,
        issuedByUid: currentUser.id,
        issuedByName: ensureMinLen(
          siteSettings.leadName || 'HRCC Paavai Campus Lead',
          'Campus Lead',
          2,
          100
        ),
      };
      if (currentUser.regNo) {
        payload.registerNumber = clampStr(currentUser.regNo, 32);
      }
      if (currentUser.department) {
        payload.department = clampStr(currentUser.department, 60);
      }

      await setDoc(doc(db, 'certificates', certId), payload);

      const created: EventCertificate = {
        id: certId,
        certId,
        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        eventDate: payload.eventDate,
        recipientUid: payload.recipientUid,
        recipientName: payload.recipientName,
        registerNumber: payload.registerNumber,
        department: payload.department,
        awardType: 'Participation',
        awardTitle: payload.awardTitle,
        issuedAt: payload.issuedAt,
        issuedByUid: payload.issuedByUid,
        issuedByName: payload.issuedByName,
      };

      addToast(
        'E-Certificate Issued',
        `Participation certificate ${certId} is ready to download and verify.`,
        'success'
      );
      return { ok: true, certificate: created, alreadyIssued: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      return {
        ok: false,
        error: 'Could not issue E-Certificate. Ensure your QR check-in is verified.',
      };
    }
  };

  const issueEventCertificate: AppContextValue['issueEventCertificate'] = async (payload) => {
    if (!currentUser || !can('canAccessCrewDashboard')) {
      return { ok: false, error: 'Only Campus Crew and Campus Lead can issue certificates.' };
    }
    const targetEvent = events.find((e) => e.id === payload.eventId);
    if (!targetEvent) {
      return { ok: false, error: 'Selected event was not found.' };
    }
    const cleanName = payload.recipientName.trim();
    if (cleanName.length < 2) {
      return { ok: false, error: 'Recipient name must be at least 2 characters.' };
    }

    const shortEvent = targetEvent.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'EVT';
    const randSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const certId =
      payload.awardType === 'Participation' && payload.recipientUid
        ? `CERT-${targetEvent.id}-${payload.recipientUid}`
        : `CERT-${shortEvent}-${Date.now().toString(36).toUpperCase()}-${randSuffix}`;

    try {
      // Certificates are immutable (allow update: if false) — return cleanly if deterministic Participation cert already exists
      if (payload.awardType === 'Participation' && payload.recipientUid) {
        const existingSnap = await getDoc(doc(db, 'certificates', certId));
        if (existingSnap.exists()) {
          const x = existingSnap.data();
          const existingCert: EventCertificate = {
            id: existingSnap.id,
            certId: String(x.certId || existingSnap.id),
            eventId: String(x.eventId || targetEvent.id),
            eventTitle: String(x.eventTitle || targetEvent.title),
            eventDate: String(x.eventDate || targetEvent.dateISO),
            recipientUid: x.recipientUid ? String(x.recipientUid) : undefined,
            recipientName: String(x.recipientName || cleanName),
            registerNumber: x.registerNumber ? String(x.registerNumber) : undefined,
            department: x.department ? String(x.department) : undefined,
            awardType: (x.awardType as CertificateAwardType) || 'Participation',
            awardTitle: x.awardTitle ? String(x.awardTitle) : undefined,
            issuedAt: String(x.issuedAt || new Date().toISOString()),
            issuedByUid: String(x.issuedByUid || currentUser.id),
            issuedByName: String(x.issuedByName || siteSettings.leadName || currentUser.name),
          };
          addToast(
            'Certificate Already Issued',
            `${existingCert.recipientName} already has Participation certificate ${certId}.`,
            'info'
          );
          return { ok: true, certificate: existingCert };
        }
      }

      const nowIso = new Date().toISOString();
      const docData: Record<string, string> = {
        certId,
        eventId: targetEvent.id,
        eventTitle: ensureMinLen(targetEvent.title, 'Campus Event', 2, 140),
        eventDate: ensureMinLen(targetEvent.dateISO, nowIso.slice(0, 10), 4, 40),
        recipientName: ensureMinLen(cleanName, 'Student Member', 2, 100),
        awardType: payload.awardType,
        issuedAt: nowIso,
        issuedByUid: currentUser.id,
        issuedByName: ensureMinLen(
          siteSettings.leadName || currentUser.name,
          'Campus Lead',
          2,
          100
        ),
      };
      if (payload.recipientUid) docData.recipientUid = clampStr(payload.recipientUid, 128);
      if (payload.registerNumber?.trim()) {
        docData.registerNumber = clampStr(payload.registerNumber.trim().toUpperCase(), 32);
      }
      if (payload.department?.trim()) {
        docData.department = clampStr(payload.department.trim(), 60);
      }
      if (payload.awardTitle?.trim()) {
        docData.awardTitle = clampStr(payload.awardTitle.trim(), 140);
      }

      await setDoc(doc(db, 'certificates', certId), docData);
      const created: EventCertificate = {
        id: certId,
        certId,
        eventId: docData.eventId,
        eventTitle: docData.eventTitle,
        eventDate: docData.eventDate,
        recipientUid: docData.recipientUid,
        recipientName: docData.recipientName,
        registerNumber: docData.registerNumber,
        department: docData.department,
        awardType: payload.awardType,
        awardTitle: docData.awardTitle,
        issuedAt: docData.issuedAt,
        issuedByUid: docData.issuedByUid,
        issuedByName: docData.issuedByName,
      };
      addToast(
        'Certificate Issued',
        `${payload.awardType} certificate issued to ${created.recipientName} (${certId}).`,
        'success'
      );
      return { ok: true, certificate: created };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `certificates/${certId}`);
      return { ok: false, error: 'Could not issue certificate in Firestore.' };
    }
  };

  const issueCertificatesForEventCheckIns: AppContextValue['issueCertificatesForEventCheckIns'] =
    async (eventId) => {
      if (!currentUser || !can('canAccessCrewDashboard')) {
        return { ok: false, error: 'Only Campus Crew and Campus Lead can bulk-issue certificates.' };
      }
      const targetEvent = events.find((e) => e.id === eventId);
      if (!targetEvent) {
        return { ok: false, error: 'Selected event was not found.' };
      }

      const attendees = eventCheckIns.filter((c) => c.eventId === eventId);
      if (attendees.length === 0) {
        return { ok: false, error: 'No verified QR check-ins found for this event yet.' };
      }

      const existingIds = new Set(certificates.map((c) => c.certId));
      const pending = attendees.filter(
        (a) => !existingIds.has(`CERT-${targetEvent.id}-${a.userId}`)
      );

      if (pending.length === 0) {
        addToast(
          'All Attendees Already Certified',
          `All ${attendees.length} QR checked-in attendees already have Participation certificates.`,
          'info'
        );
        return { ok: true, issuedCount: 0, skippedCount: attendees.length };
      }

      const nowIso = new Date().toISOString();
      const issuerName = ensureMinLen(
        siteSettings.leadName || currentUser.name,
        'Campus Lead',
        2,
        100
      );
      const eventTitle = ensureMinLen(targetEvent.title, 'Campus Event', 2, 140);
      const eventDate = ensureMinLen(targetEvent.dateISO, nowIso.slice(0, 10), 4, 40);

      try {
        for (let i = 0; i < pending.length; i += 400) {
          const chunk = pending.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const attendee of chunk) {
            const certId = `CERT-${targetEvent.id}-${attendee.userId}`;
            const docData: Record<string, string> = {
              certId,
              eventId: targetEvent.id,
              eventTitle,
              eventDate,
              recipientUid: attendee.userId,
              recipientName: ensureMinLen(attendee.userName, 'Student Member', 2, 100),
              awardType: 'Participation',
              awardTitle: 'for active participation and verified QR attendance in',
              issuedAt: nowIso,
              issuedByUid: currentUser.id,
              issuedByName: issuerName,
            };
            if (attendee.registerNumber) {
              docData.registerNumber = clampStr(attendee.registerNumber, 32);
            }
            if (attendee.department) {
              docData.department = clampStr(attendee.department, 60);
            }
            batch.set(doc(db, 'certificates', certId), docData);
          }
          await batch.commit();
        }

        const skippedCount = attendees.length - pending.length;
        addToast(
          'Bulk Certificates Issued',
          `Issued ${pending.length} Participation certificate${pending.length === 1 ? '' : 's'} for "${targetEvent.title}".`,
          'success'
        );
        return { ok: true, issuedCount: pending.length, skippedCount };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'certificates');
        return { ok: false, error: 'Bulk issuance failed. Please try again.' };
      }
    };

  const deleteCertificate: AppContextValue['deleteCertificate'] = async (certId) => {
    if (!can('canApproveContent')) {
      addToast('Permission Denied', 'Only the Campus Lead can revoke certificates.', 'error');
      return;
    }
    const cleanId = sanitizeId(certId);
    try {
      await deleteDoc(doc(db, 'certificates', cleanId));
      addToast('Certificate Revoked', `Removed certificate ${cleanId}.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `certificates/${cleanId}`);
    }
  };

  const getCertificateById: AppContextValue['getCertificateById'] = useCallback(async (certId) => {
    const cleanId = certId.trim();
    if (!cleanId || !/^[a-zA-Z0-9_-]{4,128}$/.test(cleanId)) {
      return { ok: false, error: 'Invalid certificate ID format.' };
    }
    try {
      const snap = await getDoc(doc(db, 'certificates', cleanId));
      if (!snap.exists()) {
        return {
          ok: false,
          error: 'No verified E-Certificate matches this ID in the HRCC Paavai registry.',
        };
      }
      const x = snap.data();
      const cert: EventCertificate = {
        id: snap.id,
        certId: String(x.certId || snap.id),
        eventId: String(x.eventId || ''),
        eventTitle: String(x.eventTitle || ''),
        eventDate: String(x.eventDate || ''),
        recipientUid: x.recipientUid ? String(x.recipientUid) : undefined,
        recipientName: String(x.recipientName || ''),
        registerNumber: x.registerNumber ? String(x.registerNumber) : undefined,
        department: x.department ? String(x.department) : undefined,
        awardType: (x.awardType as CertificateAwardType) || 'Participation',
        awardTitle: x.awardTitle ? String(x.awardTitle) : undefined,
        issuedAt: String(x.issuedAt || ''),
        issuedByUid: String(x.issuedByUid || ''),
        issuedByName: String(x.issuedByName || ''),
      };
      return { ok: true, certificate: cert };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `certificates/${cleanId}`);
      return { ok: false, error: 'Unable to verify certificate right now.' };
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        authReady,
        firebaseUser,
        needsEmailVerification,
        unverifiedEmail,
        verificationDispatchState,
        currentUser,
        currentRole,
        can,
        login,
        signup,
        sendPasswordReset,
        resendVerificationEmail,
        refreshEmailVerification,
        verifyActionCode,
        verifyPasswordResetActionCode,
        confirmPasswordResetAction,
        syncVerificationAfterRedirect,
        logout,
        siteSettings,
        users,
        publicProfiles,
        teamMembers: resolvedTeamMembers,
        events,
        announcements,
        leaderboard,
        resources,
        gallery,
        registrations,
        unstopParticipants,
        checkInCodes,
        eventCheckIns,
        certificates,
        joinRequests,
        completedResourceIds,
        codingActivities,
        emailSendAttempts,
        refreshEmailSendAttempts,
        deleteEmailSendAttempt,
        createEvent,
        updateEvent,
        deleteEvent,
        approveEvent,
        rejectEvent,
        toggleOnlineEventAttendance,
        fetchUnstopEventDetails,
        syncEventFromUnstop,
        createAnnouncement,
        deleteAnnouncement,
        approveAnnouncement,
        rejectAnnouncement,
        registerForEvent,
        cancelRegistration,
        resendEventTicketEmail,
        exportRegistrationsCSV,
        importUnstopParticipants,
        deleteUnstopParticipant,
        clearEventUnstopParticipants,
        generateEventCheckInCode,
        toggleEventCheckInCodeActive,
        deleteEventCheckInCode,
        lookupEventCheckInCode,
        checkInAttendeeWithCode,
        markOnlineEventAttendance,
        crewCheckInAttendeeByTicket,
        exportEventCheckInsCSV,
        claimParticipationCertificate,
        issueEventCertificate,
        issueCertificatesForEventCheckIns,
        deleteCertificate,
        getCertificateById,
        upsertLeaderboardEntry,
        deleteLeaderboardEntry,
        addGalleryPhoto,
        deleteGalleryPhoto,
        addResource,
        deleteResource,
        toggleResourceCompleted,
        logCodingActivity,
        syncHackerRankPractice,
        deleteCodingActivity,
        updateUserRole,
        updateMemberPhotoUrl,
        deleteUser,
        submitJoinRequest,
        reviewJoinRequest,
        resendJoinRequestEmail,
        deleteJoinRequest,
        updateSiteSettings,
        updateOwnProfile,
        toasts,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
