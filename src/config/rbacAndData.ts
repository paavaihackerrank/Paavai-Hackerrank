/**
 * ============================================================================
 * HACKERRANK CAMPUS CREW – PAAVAI ENGINEERING COLLEGE
 * CENTRAL RBAC PERMISSIONS CONFIG & EDITABLE SAMPLE DATA
 * ============================================================================
 *
 * HOW TO EDIT ACCESS RULES:
 * Update the `ROLE_PERMISSIONS` object below to grant or revoke any capability
 * for any role. Both Route Protection (<ProtectedRoute />) and UI Gating
 * (hiding/showing buttons, tabs, and sections) read directly from this map.
 *
 * BACKEND INTEGRATION NOTE:
 * Replace the sample constants below with API / Firestore / Supabase queries
 * when connecting a production backend.
 */

export type UserRole = 'lead' | 'crew' | 'member' | 'outsider';

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export type PermissionKey =
  | 'canAccessCrewDashboard'
  | 'canAccessAdminPanel'
  | 'canApproveContent'
  | 'canManageUsers'
  | 'canAssignRoles'
  | 'canDeleteUsers'
  | 'canManageSiteSettings'
  | 'canCreateEvents'
  | 'canPublishEventsDirectly'
  | 'canEditDeleteAnyEvent'
  | 'canCreateAnnouncements'
  | 'canPublishAnnouncementsDirectly'
  | 'canDeleteAnnouncements'
  | 'canUploadGallery'
  | 'canDeleteGallery'
  | 'canManageResources'
  | 'canUpdateLeaderboard'
  | 'canViewRegistrations'
  | 'canExportRegistrations'
  | 'canRegisterForEvents'
  | 'canViewFullLeaderboard'
  | 'canViewFullResources'
  | 'canEditOwnProfile'
  | 'canSubmitJoinRequest';

/**
 * ============================================================================
 * 1. SINGLE-SOURCE PERMISSIONS MAP (EDIT HERE TO CHANGE ACCESS RULES)
 * ============================================================================
 */
export const ROLE_PERMISSIONS: Record<UserRole, Record<PermissionKey, boolean>> = {
  lead: {
    canAccessCrewDashboard: true,
    canAccessAdminPanel: true,
    canApproveContent: true,
    canManageUsers: true,
    canAssignRoles: true,
    canDeleteUsers: true,
    canManageSiteSettings: true,
    canCreateEvents: true,
    canPublishEventsDirectly: true, // Lead creations publish immediately
    canEditDeleteAnyEvent: true,
    canCreateAnnouncements: true,
    canPublishAnnouncementsDirectly: true,
    canDeleteAnnouncements: true,
    canUploadGallery: true,
    canDeleteGallery: true,
    canManageResources: true,
    canUpdateLeaderboard: true,
    canViewRegistrations: true,
    canExportRegistrations: true, // Export CSV allowed ONLY for Lead
    canRegisterForEvents: true,
    canViewFullLeaderboard: true,
    canViewFullResources: true,
    canEditOwnProfile: true,
    canSubmitJoinRequest: false,
  },
  crew: {
    canAccessCrewDashboard: true,
    canAccessAdminPanel: false,
    canApproveContent: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeleteUsers: false,
    canManageSiteSettings: false,
    canCreateEvents: true,
    canPublishEventsDirectly: false, // Crew events go to "Pending approval"
    canEditDeleteAnyEvent: false,
    canCreateAnnouncements: true,
    canPublishAnnouncementsDirectly: false, // Crew announcements go to "Pending approval"
    canDeleteAnnouncements: false,
    canUploadGallery: true,
    canDeleteGallery: false,
    canManageResources: true,
    canUpdateLeaderboard: true,
    canViewRegistrations: true,
    canExportRegistrations: false, // View only — cannot export
    canRegisterForEvents: true,
    canViewFullLeaderboard: true,
    canViewFullResources: true,
    canEditOwnProfile: true,
    canSubmitJoinRequest: false,
  },
  member: {
    canAccessCrewDashboard: false,
    canAccessAdminPanel: false,
    canApproveContent: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeleteUsers: false,
    canManageSiteSettings: false,
    canCreateEvents: false,
    canPublishEventsDirectly: false,
    canEditDeleteAnyEvent: false,
    canCreateAnnouncements: false,
    canPublishAnnouncementsDirectly: false,
    canDeleteAnnouncements: false,
    canUploadGallery: false,
    canDeleteGallery: false,
    canManageResources: false,
    canUpdateLeaderboard: false,
    canViewRegistrations: false,
    canExportRegistrations: false,
    canRegisterForEvents: true,
    canViewFullLeaderboard: true,
    canViewFullResources: true,
    canEditOwnProfile: true,
    canSubmitJoinRequest: false,
  },
  outsider: {
    canAccessCrewDashboard: false,
    canAccessAdminPanel: false,
    canApproveContent: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeleteUsers: false,
    canManageSiteSettings: false,
    canCreateEvents: false,
    canPublishEventsDirectly: false,
    canEditDeleteAnyEvent: false,
    canCreateAnnouncements: false,
    canPublishAnnouncementsDirectly: false,
    canDeleteAnnouncements: false,
    canUploadGallery: false,
    canDeleteGallery: false,
    canManageResources: false,
    canUpdateLeaderboard: false,
    canViewRegistrations: false,
    canExportRegistrations: false,
    canRegisterForEvents: false,
    canViewFullLeaderboard: false, // Top 10 only
    canViewFullResources: false, // Basic tracks only
    canEditOwnProfile: false,
    canSubmitJoinRequest: true,
  },
};

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  return Boolean(ROLE_PERMISSIONS[role]?.[permission]);
}

export function getDashboardPath(role: UserRole): string {
  if (role === 'lead') return '/dashboard/lead';
  if (role === 'crew') return '/dashboard/crew';
  if (role === 'member') return '/dashboard/member';
  return '/';
}

export const ROLE_META: Record<
  UserRole,
  { label: string; shortLabel: string; description: string }
> = {
  lead: {
    label: 'Campus Lead',
    shortLabel: 'Lead',
    description: 'Full chapter administrator with approval, role management, export, and settings control.',
  },
  crew: {
    label: 'Campus Crew Member',
    shortLabel: 'Crew',
    description: 'Core organizer who drafts events/announcements for Lead approval, uploads media, and updates rankings.',
  },
  member: {
    label: 'Student Community Member',
    shortLabel: 'Member',
    description: 'Verified Paavai student with full leaderboard, roadmap access, and event registration privileges.',
  },
  outsider: {
    label: 'Outsider (Guest)',
    shortLabel: 'Guest',
    description: 'Public visitor with preview access to Top 10 rankings, basic resources, and the Join Us form.',
  },
};

/**
 * ============================================================================
 * 2. DATA INTERFACES
 * ============================================================================
 */

export interface PracticeSummary {
  title: string;
  platform: CodingPlatform;
  date: string;
  count: number;
  notesUrl?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  collegeEmail?: string;
  role: Exclude<UserRole, 'outsider'>;
  emailVerified?: boolean;
  regNo: string;
  department: string;
  year: string;
  phone: string;
  photoUrl?: string;
  documentUrl?: string;
  hackerRankHandle: string;
  hackerRankUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  bio: string;
  skills: string[];
  joinedAt: string;
  createdAt?: string;
}

export interface PublicProfile {
  id: string;
  uid: string;
  name: string;
  department: string;
  year: string;
  bio: string;
  photoUrl?: string;
  documentUrl?: string;
  skills: string[];
  hackerRankHandle: string;
  hackerRankUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  completedDsaCount: number;
  completedRoadmapCount: number;
  hackerRankSolvedCount?: number;
  streak?: number;
  lastPracticeAt?: string;
  recentPractices?: PracticeSummary[];
  rank?: number;
  eventsAttended?: number;
  updatedAt?: string;
}

export interface TeamMember {
  id: string;
  uid: string;
  name: string;
  role: 'lead' | 'crew';
  designation: string;
  department: string;
  year: string;
  bio: string;
  photoUrl?: string;
  hackerRankHandle: string;
  updatedAt?: string;
}

export interface UnstopSyncedEventDetails {
  unstopUrl: string;
  unstopCompetitionId: string;
  title?: string;
  description?: string;
  category?: 'Contest' | 'Workshop' | 'Hackathon' | 'Bootcamp';
  dateISO?: string;
  venue?: string;
  bannerImage?: string;
  unstopRegistrationsCount: number;
  unstopViewsCount: number;
  unstopDeadline?: string;
  unstopOrganiser?: string;
  unstopMode?: string;
  unstopPrize?: string;
  unstopSyncedAt: string;
  source: 'unstop_api' | 'unstop_html';
}

export type EventMode = 'offline' | 'online' | 'hybrid';

export interface CampusEvent {
  id: string;
  title: string;
  category: 'Contest' | 'Workshop' | 'Hackathon' | 'Bootcamp';
  eventMode?: EventMode;
  attendanceEnabled?: boolean;
  meetingUrl?: string;
  dateISO: string;
  venue: string;
  description: string;
  membersOnly: boolean;
  capacity: number;
  status: ApprovalStatus;
  createdByName: string;
  createdByRole: UserRole;
  bannerImage: string;
  documentUrl?: string;
  unstopUrl?: string;
  unstopCompetitionId?: string;
  unstopRegistrationsCount?: number;
  unstopViewsCount?: number;
  unstopDeadline?: string;
  unstopOrganiser?: string;
  unstopMode?: string;
  unstopPrize?: string;
  unstopSyncedAt?: string;
}

export function getEffectiveEventMode(ev?: Partial<CampusEvent> | null): EventMode {
  if (!ev) return 'offline';
  if (ev.eventMode === 'online' || ev.eventMode === 'offline' || ev.eventMode === 'hybrid') {
    return ev.eventMode;
  }
  const unstopMode = (ev.unstopMode || '').trim().toLowerCase();
  if (unstopMode) {
    if (unstopMode.includes('hybrid')) return 'hybrid';
    if (unstopMode.includes('online') && !unstopMode.includes('offline')) return 'online';
  }
  const venue = (ev.venue || '').trim().toLowerCase();
  if (
    /^(online|virtual|remote)\b/.test(venue) ||
    venue.includes('google meet') ||
    venue.includes('zoom') ||
    venue.includes('microsoft teams') ||
    venue.includes('hackerrank online')
  ) {
    return 'online';
  }
  return 'offline';
}

export function isOnlineEvent(ev?: Partial<CampusEvent> | null): boolean {
  return getEffectiveEventMode(ev) === 'online';
}

export function isQrCheckInRequired(ev?: Partial<CampusEvent> | null): boolean {
  return !isOnlineEvent(ev);
}

export function isOnlineAttendanceEnabled(ev?: Partial<CampusEvent> | null): boolean {
  if (!isOnlineEvent(ev)) return true;
  return Boolean(ev?.attendanceEnabled);
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  date: string;
  priority: 'Normal' | 'Important';
  status: ApprovalStatus;
  createdByName: string;
}

export interface LeaderboardEntry {
  id: string;
  uid?: string;
  name: string;
  registerNumber: string;
  department: string;
  year: string;
  score: number;
  problemsSolved: number;
  solvedCount?: number;
  eventsAttended?: number;
  rank?: number;
  hackerRankHandle: string;
}

export type ResourceTrack = 'DSA' | 'Python' | 'Java' | 'SQL' | 'Problem Solving';

export interface LearningResource {
  id: string;
  title: string;
  track: ResourceTrack;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  access: 'basic' | 'full';
  estimatedHours: number;
  problemCount: number;
  summary: string;
  url: string;
  documentUrl?: string;
  topics: string[];
}

export interface GalleryPhoto {
  id: string;
  title: string;
  category: 'Hackathon' | 'Workshop' | 'Awards' | 'Community';
  date: string;
  caption: string;
  imageUrl: string;
  uploadedBy: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  registerNumber: string;
  department: string;
  year: string;
  registeredAt: string;
  ticketCode?: string;
  ticketEmailStatus?: 'sent' | 'queued' | 'failed';
  ticketEmailSentAt?: string;
}

export function buildAttendeeTicketCode(eventId: string, userId: string): string {
  const cleanEvent = (eventId || 'EVENT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'EVENT';
  const cleanUser = (userId || 'USER')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10) || 'USER';
  return `PASS-${cleanEvent}-${cleanUser}`;
}

export function buildAttendeeQrPayload(
  eventId: string,
  userId: string,
  ticketCode?: string
): string {
  const code = ticketCode && ticketCode.trim().length >= 6
    ? ticketCode.trim()
    : buildAttendeeTicketCode(eventId, userId);
  return `HRCC-PASS|${eventId}|${userId}|${code}`;
}

export interface EventCheckInCode {
  code: string;
  eventId: string;
  eventTitle: string;
  venue: string;
  isActive: boolean;
  opensAt?: unknown;
  closesAt?: unknown;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
}

export interface EventCheckIn {
  id: string;
  checkInCode: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  collegeEmail?: string;
  registerNumber: string;
  department: string;
  year: string;
  phone?: string;
  checkedInAt: string;
}

export interface UnstopParticipant {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  email: string;
  registerNumber?: string;
  college?: string;
  teamName?: string;
  status?: string;
  phone?: string;
  matchedUserId?: string;
  importedAt: string;
  importedByUid: string;
  importedByName: string;
}

export type CertificateAwardType =
  | 'Participation'
  | 'Winner'
  | 'Runner-Up'
  | 'Top Performer'
  | 'Crew Recognition';

export const CERTIFICATE_AWARD_TYPES: CertificateAwardType[] = [
  'Participation',
  'Winner',
  'Runner-Up',
  'Top Performer',
  'Crew Recognition',
];

export interface EventCertificate {
  id: string;
  certId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  recipientUid?: string;
  recipientName: string;
  registerNumber?: string;
  department?: string;
  awardType: CertificateAwardType;
  awardTitle?: string;
  issuedAt: string;
  issuedByUid: string;
  issuedByName: string;
}

export interface JoinRequest {
  id: string;
  name: string;
  registerNumber: string;
  department: string;
  year: string;
  email: string;
  phone: string;
  skills: string;
  submittedAt: string;
  status: ApprovalStatus;
  reviewedAt?: string;
  reviewedByUid?: string;
  reviewNote?: string;
  emailNotificationStatus?: 'sent' | 'queued' | 'failed';
  emailSentAt?: string;
  emailError?: string;
}

export interface SiteSettings {
  chapterName: string;
  collegeName: string;
  tagline: string;
  contactEmail: string;
  leadName?: string;
  leadPhone?: string;
  campusLocation: string;
  applicationsOpen: boolean;
  publicLeaderboardLimit: number;
  hackerRankClubUrl: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface EmailSendAttempt {
  id: string;
  type:
    | 'verification'
    | 'password_reset'
    | 'join_request_approved'
    | 'join_request_rejected';
  email: string;
  status: 'sent' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  continueUrl?: string;
  actorUid?: string;
  attemptedAt: string;
}

export type CodingPlatform =
  | 'HackerRank'
  | 'LeetCode'
  | 'GitHub'
  | 'CodeChef'
  | 'DSA Roadmap'
  | 'Campus Event';

export const CODING_PLATFORMS: CodingPlatform[] = [
  'HackerRank',
  'LeetCode',
  'GitHub',
  'CodeChef',
  'DSA Roadmap',
  'Campus Event',
];

export interface CodingActivity {
  id: string;
  userId: string;
  platform: CodingPlatform;
  date: string;
  count: number;
  title: string;
  notesUrl?: string;
  createdAt: string;
}

/**
 * ============================================================================
 * 3. CHAPTER STATIC ASSETS & DEFAULT SITE SETTINGS
 * ============================================================================
 */
export const CHAPTER_IMAGES = {
  hero: '/src/assets/images/hero_campus_coding_1795100082075.jpg',
  hackathonArena: '/src/assets/images/gallery_hackathon_arena_1795100082455.jpg',
  dsaWorkshop: '/src/assets/images/gallery_dsa_workshop_1795100083877.jpg',
  awardCeremony: '/src/assets/images/gallery_award_ceremony_1795100085446.jpg',
  leadPortrait: '/src/assets/images/team_lead_portrait_1795100086348.jpg',
  crewFemale: '/src/assets/images/team_crew_female_1795100085987.jpg',
  crewMale: '/src/assets/images/team_crew_male_1795100087074.jpg',
};

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  chapterName: 'HackerRank Campus Crew',
  collegeName: 'Paavai Engineering College',
  tagline: 'Code. Compete. Conquer.',
  contactEmail: 'hackerrankcrew@paavai.edu.in',
  leadName: 'Campus Lead',
  leadPhone: '',
  campusLocation: 'NH-44, Pachal, Namakkal, Tamil Nadu 637018',
  applicationsOpen: true,
  publicLeaderboardLimit: 10,
  hackerRankClubUrl: 'https://www.hackerrank.com',
};

export const DEPARTMENTS = [
  'CSE',
  'IT',
  'AI & DS',
  'Cyber Security',
  'ECE',
  'EEE',
  'Mechatronics',
  'Mechanical',
];

export const ACADEMIC_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

/**
 * CHAPTER FAQ ITEMS
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq_01',
    question: 'Who can join the HackerRank Campus Crew at Paavai Engineering College?',
    answer:
      'Any current undergraduate or postgraduate student at Paavai Engineering College from any department (CSE, IT, AI & DS, Cyber Security, ECE, EEE, Mechanical, and more) can sign up with their personal email, unique @paavai.edu.in college email ID, and unique phone number.',
  },
  {
    id: 'faq_02',
    question: 'How do email verification and promotion to Campus Crew work?',
    answer:
      'Sign up using your personal email and password (along with your unique college email ID and phone number) and verify your personal email inbox link to receive immediate Student Community Member access. Active members who contribute to contests and mentoring can be promoted to Campus Crew Member by the Campus Lead.',
  },
  {
    id: 'faq_03',
    question: 'Do I need prior competitive programming experience?',
    answer:
      'No prior competitive programming background is required. Our Learning Roadmap starts from fundamentals in Python, Java, SQL, and arrays before progressing into trees, graphs, and dynamic programming.',
  },
  {
    id: 'faq_04',
    question: 'How is the Campus Leaderboard calculated?',
    answer:
      'Scores combine points earned in official Paavai weekly HackerRank contests, verified problem-solving streaks, and bonus challenge rounds. Guests can preview the Top 10, while logged-in members see the full campus standings.',
  },
  {
    id: 'faq_05',
    question: 'Are events and workshops free for Paavai students?',
    answer:
      'Yes. All HackerRank Campus Crew workshops, coding contests, and placement sprints are completely free for Paavai Engineering College students. Members-only deep-dive labs simply require a verified member account.',
  },
];
