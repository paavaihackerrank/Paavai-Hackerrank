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
    description: 'Verified @paavai.edu.in student with full leaderboard, roadmap access, and event registration privileges.',
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

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  /** DEMO ONLY — Never store plaintext passwords in frontend code in production */
  password: string;
  role: Exclude<UserRole, 'outsider'>;
  regNo: string;
  department: string;
  year: string;
  phone: string;
  hackerRankHandle: string;
  bio: string;
  skills: string[];
  joinedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  designation: string;
  isLead: boolean;
  department: string;
  year: string;
  bio: string;
  photo: string;
  photoPosition?: string;
  github: string;
  linkedin: string;
  hackerrank: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  category: 'Contest' | 'Workshop' | 'Hackathon' | 'Bootcamp';
  dateISO: string;
  venue: string;
  description: string;
  membersOnly: boolean;
  capacity: number;
  status: ApprovalStatus;
  createdByName: string;
  createdByRole: UserRole;
  bannerImage: string;
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
  name: string;
  registerNumber: string;
  department: string;
  year: string;
  score: number;
  problemsSolved: number;
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
}

export interface SiteSettings {
  chapterName: string;
  collegeName: string;
  tagline: string;
  contactEmail: string;
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

/**
 * ============================================================================
 * 3. GENERATED LOCAL PLACEHOLDER ASSETS
 * TODO: Replace these paths with your official Paavai Engineering College
 *       chapter photographs and crew portraits.
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

/**
 * ============================================================================
 * 4. EDITABLE SAMPLE DATA CONSTANTS
 * TODO: Replace each constant below with live backend data from Firebase
 *       Firestore, Supabase, or your custom REST/GraphQL API.
 * ============================================================================
 */

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  chapterName: 'HackerRank Campus Crew',
  collegeName: 'Paavai Engineering College',
  tagline: 'Code. Compete. Conquer.',
  contactEmail: 'hackerrankcrew@paavai.edu.in',
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
 * DEMO ACCOUNTS — Used by both Login form & "Switch role (demo)" selector.
 * TODO: Replace with Firebase Auth / Supabase Auth user records.
 */
export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr_lead_01',
    name: 'Karthik Subramanian',
    email: 'lead@paavai.edu.in',
    password: 'password123',
    role: 'lead',
    regNo: '622123104012',
    department: 'CSE',
    year: '4th Year',
    phone: '+91 98421 44102',
    hackerRankHandle: '@karthik_pec',
    bio: 'HackerRank Campus Lead at Paavai Engineering College. 6-star Problem Solving & ICPC Regionalist focused on mentoring juniors in algorithms.',
    skills: ['C++', 'Dynamic Programming', 'Graphs', 'System Design'],
    joinedAt: '2025-07-14',
  },
  {
    id: 'usr_crew_01',
    name: 'Divya Bharathi R',
    email: 'crew@paavai.edu.in',
    password: 'password123',
    role: 'crew',
    regNo: '622124205019',
    department: 'IT',
    year: '3rd Year',
    phone: '+91 97890 31824',
    hackerRankHandle: '@divya_codes',
    bio: 'Technical Event Coordinator & Python/SQL Mentor for the Paavai HackerRank Campus Crew.',
    skills: ['Python', 'SQL', 'DSA', 'FastAPI'],
    joinedAt: '2025-08-02',
  },
  {
    id: 'usr_student_01',
    name: 'Arjun Venkatesh',
    email: 'student@paavai.edu.in',
    password: 'password123',
    role: 'member',
    regNo: '622125104088',
    department: 'AI & DS',
    year: '2nd Year',
    phone: '+91 90432 77819',
    hackerRankHandle: '@arjun_v_pec',
    bio: 'Second-year AI & DS undergraduate preparing for product engineering placements through weekly HackerRank contests.',
    skills: ['Java', 'Arrays & Trees', 'SQL', 'React'],
    joinedAt: '2026-01-20',
  },
  {
    id: 'usr_crew_02',
    name: 'Praveen Kumar S',
    email: 'praveen.crew@paavai.edu.in',
    password: 'password123',
    role: 'crew',
    regNo: '622124104061',
    department: 'CSE',
    year: '3rd Year',
    phone: '+91 94430 61209',
    hackerRankHandle: '@praveen_algos',
    bio: 'Problem Setter and Competitive Programming Lead managing weekly campus coding rounds.',
    skills: ['C++', 'Java', 'Segment Trees', 'Number Theory'],
    joinedAt: '2025-08-05',
  },
  {
    id: 'usr_student_02',
    name: 'Nivetha Murugan',
    email: 'nivetha.m@paavai.edu.in',
    password: 'password123',
    role: 'member',
    regNo: '622126104034',
    department: 'Cyber Security',
    year: '1st Year',
    phone: '+91 88254 11903',
    hackerRankHandle: '@nivetha_sec',
    bio: 'First-year Cyber Security student eager to build strong fundamentals in Python and data structures.',
    skills: ['Python', 'C', 'Linux'],
    joinedAt: '2026-11-18',
  },
];

/**
 * EDITABLE TEAM ROSTER — Swap photos, designations, and social URLs here.
 */
export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'team_01',
    name: 'Karthik Subramanian',
    designation: 'HackerRank Campus Lead',
    isLead: true,
    department: 'CSE',
    year: '4th Year',
    bio: 'Leads chapter vision, HackerRank India liaison, placement coding bootcamps, and weekly algorithmic editorial reviews at Paavai Engineering College.',
    photo: CHAPTER_IMAGES.leadPortrait,
    photoPosition: 'object-top scale-125',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    hackerrank: 'https://www.hackerrank.com',
  },
  {
    id: 'team_02',
    name: 'Divya Bharathi R',
    designation: 'Events & Operations Lead',
    isLead: false,
    department: 'IT',
    year: '3rd Year',
    bio: 'Coordinates inter-department hackathons, live leaderboard rounds, and hands-on Python & SQL query clinics for first and second-year cohorts.',
    photo: CHAPTER_IMAGES.crewFemale,
    photoPosition: 'object-top',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    hackerrank: 'https://www.hackerrank.com',
  },
  {
    id: 'team_03',
    name: 'Praveen Kumar S',
    designation: 'Problem Setting & CP Lead',
    isLead: false,
    department: 'CSE',
    year: '3rd Year',
    bio: 'Authors original test cases, optimizes contest difficulty curves, and leads graph theory and dynamic programming problem-solving sprints.',
    photo: CHAPTER_IMAGES.crewMale,
    photoPosition: 'object-top',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    hackerrank: 'https://www.hackerrank.com',
  },
  {
    id: 'team_04',
    name: 'Keerthana Natarajan',
    designation: 'DSA & Roadmap Mentor',
    isLead: false,
    department: 'AI & DS',
    year: '3rd Year',
    bio: 'Curates the Paavai structured DSA learning roadmap and runs weekend mock coding interviews for placement readiness.',
    photo: CHAPTER_IMAGES.crewFemale,
    photoPosition: 'object-center',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    hackerrank: 'https://www.hackerrank.com',
  },
  {
    id: 'team_05',
    name: 'Harish Balaji M',
    designation: 'Community & Media Coordinator',
    isLead: false,
    department: 'ECE',
    year: '2nd Year',
    bio: 'Manages campus outreach, technical documentation, contest photography, and onboarding new student coders into the community.',
    photo: CHAPTER_IMAGES.crewMale,
    photoPosition: 'object-center',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    hackerrank: 'https://www.hackerrank.com',
  },
];

/**
 * EDITABLE EVENTS LIST
 * Note: Event #5 has status 'pending' to demonstrate the Campus Lead approval queue.
 */
export const INITIAL_EVENTS: CampusEvent[] = [
  {
    id: 'evt_01',
    title: 'Paavai CodeSprint 2026: Winter Edition',
    category: 'Contest',
    dateISO: '2026-12-05T10:00:00+05:30',
    venue: 'Anandha Arangam Auditorium & Lab Block B',
    description:
      'Flagship 3-hour ICPC-style algorithmic coding contest featuring 6 original problems spanning greedy strategies, trees, graphs, and dynamic programming.',
    membersOnly: false,
    capacity: 250,
    status: 'approved',
    createdByName: 'Karthik Subramanian',
    createdByRole: 'lead',
    bannerImage: CHAPTER_IMAGES.hackathonArena,
  },
  {
    id: 'evt_02',
    title: 'Mastering Graphs & Shortest Paths Live Lab',
    category: 'Workshop',
    dateISO: '2026-12-14T14:30:00+05:30',
    venue: 'CSE Smart Seminar Hall, Block A',
    description:
      'Hands-on problem-solving clinic covering BFS/DFS traversals, Dijkstra priority queues, and topological sorting with real HackerRank interview challenges.',
    membersOnly: true,
    capacity: 120,
    status: 'approved',
    createdByName: 'Karthik Subramanian',
    createdByRole: 'lead',
    bannerImage: CHAPTER_IMAGES.dsaWorkshop,
  },
  {
    id: 'evt_03',
    title: 'SQL & Relational Query Optimization Sprint',
    category: 'Bootcamp',
    dateISO: '2026-12-22T15:00:00+05:30',
    venue: 'IT Computing Center, Lab 3',
    description:
      'Deep-dive session into window functions, CTEs, complex joins, and indexing patterns frequently tested in HackerRank SQL Gold Badge assessments.',
    membersOnly: true,
    capacity: 90,
    status: 'approved',
    createdByName: 'Divya Bharathi R',
    createdByRole: 'crew',
    bannerImage: CHAPTER_IMAGES.hero,
  },
  {
    id: 'evt_04',
    title: 'Freshers First Commit & Python Kickoff',
    category: 'Workshop',
    dateISO: '2026-10-12T10:00:00+05:30',
    venue: 'Main Auditorium, Paavai Campus',
    description:
      'Completed orientation workshop introducing 1st-year engineers to HackerRank profiles, time complexity analysis, and foundational Python problem solving.',
    membersOnly: false,
    capacity: 300,
    status: 'approved',
    createdByName: 'Karthik Subramanian',
    createdByRole: 'lead',
    bannerImage: CHAPTER_IMAGES.awardCeremony,
  },
  {
    id: 'evt_pending_01',
    title: '24-Hour Paavai AlgoHack & Open Source Jam',
    category: 'Hackathon',
    dateISO: '2027-01-18T09:00:00+05:30',
    venue: 'Innovation Hub & Central Computing Lab',
    description:
      'Proposed 24-hour team hackathon combining algorithmic optimization tracks with full-stack developer tooling prototypes. Submitted by Crew for Lead review.',
    membersOnly: true,
    capacity: 160,
    status: 'pending',
    createdByName: 'Divya Bharathi R',
    createdByRole: 'crew',
    bannerImage: CHAPTER_IMAGES.hackathonArena,
  },
];

/**
 * EDITABLE CAMPUS ANNOUNCEMENTS
 */
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_01',
    title: 'Registrations Open for Paavai CodeSprint 2026',
    message:
      'All Paavai Engineering College students can now register for the Winter CodeSprint. Top 5 finalists earn HackerRank Campus Crew merchandise and direct mentorship slots.',
    date: '2026-11-16',
    priority: 'Important',
    status: 'approved',
    createdByName: 'Karthik Subramanian',
  },
  {
    id: 'ann_02',
    title: 'Weekly Editorial Notes Published for Round #14',
    message:
      'C++, Java, and Python optimal solutions with complexity breakdowns for last Saturday’s campus contest are now available in the Resources roadmap.',
    date: '2026-11-12',
    priority: 'Normal',
    status: 'approved',
    createdByName: 'Praveen Kumar S',
  },
  {
    id: 'ann_pending_01',
    title: 'Weekend Mock Interview Slot Reservations (Draft)',
    message:
      'Crew mentors are opening 25 mock technical interview slots for 3rd-year students next Sunday. Pending Campus Lead approval before publishing campus-wide.',
    date: '2026-11-19',
    priority: 'Normal',
    status: 'pending',
    createdByName: 'Divya Bharathi R',
  },
];

/**
 * EDITABLE LEADERBOARD DATA (16 Entries — Guests see Top 10, Members see All)
 */
export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { id: 'lb_01', name: 'Karthik Subramanian', registerNumber: '622123104012', department: 'CSE', year: '4th Year', score: 2940, problemsSolved: 318, hackerRankHandle: '@karthik_pec' },
  { id: 'lb_02', name: 'Praveen Kumar S', registerNumber: '622124104061', department: 'CSE', year: '3rd Year', score: 2815, problemsSolved: 294, hackerRankHandle: '@praveen_algos' },
  { id: 'lb_03', name: 'Divya Bharathi R', registerNumber: '622124205019', department: 'IT', year: '3rd Year', score: 2740, problemsSolved: 281, hackerRankHandle: '@divya_codes' },
  { id: 'lb_04', name: 'Keerthana Natarajan', registerNumber: '622124243008', department: 'AI & DS', year: '3rd Year', score: 2665, problemsSolved: 269, hackerRankHandle: '@keerthana_ds' },
  { id: 'lb_05', name: 'Vigneshwaran K', registerNumber: '622123104109', department: 'CSE', year: '4th Year', score: 2590, problemsSolved: 254, hackerRankHandle: '@vicky_cpp' },
  { id: 'lb_06', name: 'Sanjay Krishnan M', registerNumber: '622124104077', department: 'CSE', year: '3rd Year', score: 2480, problemsSolved: 241, hackerRankHandle: '@sanjay_km' },
  { id: 'lb_07', name: 'Aishwarya Selvam', registerNumber: '622124205004', department: 'IT', year: '3rd Year', score: 2410, problemsSolved: 229, hackerRankHandle: '@aishu_sql' },
  { id: 'lb_08', name: 'Arjun Venkatesh', registerNumber: '622125104088', department: 'AI & DS', year: '2nd Year', score: 2335, problemsSolved: 215, hackerRankHandle: '@arjun_v_pec' },
  { id: 'lb_09', name: 'Harish Balaji M', registerNumber: '622125106021', department: 'ECE', year: '2nd Year', score: 2260, problemsSolved: 202, hackerRankHandle: '@harish_ece' },
  { id: 'lb_10', name: 'Deepika Palanisamy', registerNumber: '622124149015', department: 'Cyber Security', year: '3rd Year', score: 2195, problemsSolved: 196, hackerRankHandle: '@deepika_sec' },
  // --- Ranks 11+ (Visible ONLY to logged-in community members, crew, and lead) ---
  { id: 'lb_11', name: 'Surya Prakash G', registerNumber: '622125104095', department: 'CSE', year: '2nd Year', score: 2120, problemsSolved: 184, hackerRankHandle: '@surya_java' },
  { id: 'lb_12', name: 'Pavithra Chandran', registerNumber: '622125205033', department: 'IT', year: '2nd Year', score: 2045, problemsSolved: 175, hackerRankHandle: '@pavi_py' },
  { id: 'lb_13', name: 'Gokulnath R', registerNumber: '622125243018', department: 'AI & DS', year: '2nd Year', score: 1980, problemsSolved: 168, hackerRankHandle: '@gokul_ml' },
  { id: 'lb_14', name: 'Muthukumar V', registerNumber: '622125106044', department: 'ECE', year: '2nd Year', score: 1890, problemsSolved: 155, hackerRankHandle: '@muthu_bits' },
  { id: 'lb_15', name: 'Swathi Rajendran', registerNumber: '622126104052', department: 'CSE', year: '1st Year', score: 1765, problemsSolved: 141, hackerRankHandle: '@swathi_26' },
  { id: 'lb_16', name: 'Kavin Kumar P', registerNumber: '622126149009', department: 'Cyber Security', year: '1st Year', score: 1690, problemsSolved: 132, hackerRankHandle: '@kavin_pec' },
];

/**
 * EDITABLE LEARNING ROADMAP RESOURCES
 * Guests see `access: 'basic'`. Logged-in Members unlock `access: 'full'`.
 */
export const INITIAL_RESOURCES: LearningResource[] = [
  // --- DSA ---
  {
    id: 'res_01',
    title: 'Complexity Analysis, Arrays & Two Pointers',
    track: 'DSA',
    level: 'Beginner',
    access: 'basic',
    estimatedHours: 8,
    problemCount: 25,
    summary: 'Master Big-O runtime bounds, prefix sums, sliding windows, and in-place array partitioning.',
    url: 'https://www.hackerrank.com/domains/data-structures',
    topics: ['Big-O Notation', 'Prefix Sums', 'Sliding Window', 'Two Pointers'],
  },
  {
    id: 'res_02',
    title: 'Trees, Binary Search Trees & Heaps',
    track: 'DSA',
    level: 'Intermediate',
    access: 'full',
    estimatedHours: 14,
    problemCount: 35,
    summary: 'Complete Paavai sheet covering DFS/BFS traversals, LCA, balanced BST invariants, and priority queues.',
    url: 'https://www.hackerrank.com/domains/data-structures',
    topics: ['Tree Traversals', 'BST Operations', 'Min/Max Heaps', 'Tries'],
  },
  {
    id: 'res_03',
    title: 'Dynamic Programming & Graph Algorithms',
    track: 'DSA',
    level: 'Advanced',
    access: 'full',
    estimatedHours: 22,
    problemCount: 45,
    summary: 'State transitions, memoization vs tabulation, Dijkstra, Bellman-Ford, DSU, and Minimum Spanning Trees.',
    url: 'https://www.hackerrank.com/domains/algorithms',
    topics: ['Knapsack & LIS', 'Shortest Paths', 'Disjoint Set Union', 'Bitmask DP'],
  },
  // --- PYTHON ---
  {
    id: 'res_04',
    title: 'Python Essentials for Competitive Coding',
    track: 'Python',
    level: 'Beginner',
    access: 'basic',
    estimatedHours: 6,
    problemCount: 20,
    summary: 'Fast I/O, list comprehensions, dictionaries, sets, and clean Pythonic string manipulation.',
    url: 'https://www.hackerrank.com/domains/python',
    topics: ['Collections', 'Comprehensions', 'Fast I/O', 'Slicing'],
  },
  {
    id: 'res_05',
    title: 'Standard Library Mastery: itertools, heapq & bisect',
    track: 'Python',
    level: 'Intermediate',
    access: 'full',
    estimatedHours: 10,
    problemCount: 28,
    summary: 'Write concise, contest-ready Python solutions using built-in binary search, heaps, and combinatorics.',
    url: 'https://www.hackerrank.com/domains/python',
    topics: ['heapq', 'bisect', 'itertools', 'functools.lru_cache'],
  },
  // --- JAVA ---
  {
    id: 'res_06',
    title: 'Core Java & Object-Oriented Foundations',
    track: 'Java',
    level: 'Beginner',
    access: 'basic',
    estimatedHours: 8,
    problemCount: 24,
    summary: 'Java syntax, interfaces, generics, BufferedReader fast input, and StringBuilder optimization.',
    url: 'https://www.hackerrank.com/domains/java',
    topics: ['OOP Principles', 'Generics', 'BufferedReader', 'StringBuilder'],
  },
  {
    id: 'res_07',
    title: 'Java Collections Framework for Interviews',
    track: 'Java',
    level: 'Intermediate',
    access: 'full',
    estimatedHours: 12,
    problemCount: 32,
    summary: 'Deep dive into HashMap internals, TreeMap ordering, ArrayDeque, PriorityQueue, and custom Comparators.',
    url: 'https://www.hackerrank.com/domains/java',
    topics: ['HashMap & TreeMap', 'PriorityQueue', 'Comparators', 'Streams API'],
  },
  // --- SQL ---
  {
    id: 'res_08',
    title: 'SQL Basics: SELECT, Filtering & Aggregations',
    track: 'SQL',
    level: 'Beginner',
    access: 'basic',
    estimatedHours: 5,
    problemCount: 18,
    summary: 'Write clean relational queries using WHERE, GROUP BY, HAVING, and multi-column sorting.',
    url: 'https://www.hackerrank.com/domains/sql',
    topics: ['SELECT & WHERE', 'GROUP BY', 'HAVING', 'Aggregate Functions'],
  },
  {
    id: 'res_09',
    title: 'Advanced SQL: Window Functions, CTEs & Joins',
    track: 'SQL',
    level: 'Advanced',
    access: 'full',
    estimatedHours: 11,
    problemCount: 30,
    summary: 'Ace HackerRank SQL Gold challenges with RANK(), DENSE_RANK(), recursive CTEs, and query plans.',
    url: 'https://www.hackerrank.com/domains/sql',
    topics: ['Window Functions', 'CTEs', 'Self & Outer Joins', 'Subqueries'],
  },
  // --- PROBLEM SOLVING ---
  {
    id: 'res_10',
    title: 'Algorithmic Thinking & Implementation Patterns',
    track: 'Problem Solving',
    level: 'Beginner',
    access: 'basic',
    estimatedHours: 7,
    problemCount: 22,
    summary: 'Break down constraints, identify edge cases, and avoid integer overflow in timed coding tests.',
    url: 'https://www.hackerrank.com/domains/algorithms',
    topics: ['Constraint Reading', 'Edge Cases', 'Simulation', 'Modular Math'],
  },
  {
    id: 'res_11',
    title: 'Greedy, Binary Search on Answer & Bit Manipulation',
    track: 'Problem Solving',
    level: 'Intermediate',
    access: 'full',
    estimatedHours: 13,
    problemCount: 34,
    summary: 'High-leverage techniques that solve 60% of campus placement Round 2 online coding assessments.',
    url: 'https://www.hackerrank.com/domains/algorithms',
    topics: ['Binary Search on Answer', 'Greedy Proofs', 'Bitmasks', 'Intervals'],
  },
  {
    id: 'res_12',
    title: 'Paavai Placement Sprint: 50 Curated Hard Problems',
    track: 'Problem Solving',
    level: 'Advanced',
    access: 'full',
    estimatedHours: 25,
    problemCount: 50,
    summary: 'Members-only collection of top product-company coding questions with Crew video & text editorials.',
    url: 'https://www.hackerrank.com/interview/interview-preparation-kit',
    topics: ['Mock Tests', 'Company Patterns', 'Time Management', 'Editorials'],
  },
];

/**
 * EDITABLE GALLERY ITEMS
 */
export const INITIAL_GALLERY: GalleryPhoto[] = [
  {
    id: 'gal_01',
    title: 'Evening Algorithmic Sprint at CSE Lab',
    category: 'Community',
    date: '2026-11-04',
    caption: 'Over 80 Paavai students collaborating during our Friday evening problem-solving jam.',
    imageUrl: CHAPTER_IMAGES.hero,
    uploadedBy: 'Karthik Subramanian',
  },
  {
    id: 'gal_02',
    title: 'Paavai CodeSprint Autumn Arena',
    category: 'Hackathon',
    date: '2026-10-19',
    caption: 'Teams competing across 6 algorithmic challenges in the main auditorium hackathon setup.',
    imageUrl: CHAPTER_IMAGES.hackathonArena,
    uploadedBy: 'Divya Bharathi R',
  },
  {
    id: 'gal_03',
    title: 'Dijkstra & Shortest Path Deep-Dive Workshop',
    category: 'Workshop',
    date: '2026-10-08',
    caption: 'Live visual walkthrough of priority queues and weighted graph relaxations.',
    imageUrl: CHAPTER_IMAGES.dsaWorkshop,
    uploadedBy: 'Praveen Kumar S',
  },
  {
    id: 'gal_04',
    title: 'Technovation CodeFest Champions Stage',
    category: 'Awards',
    date: '2026-09-26',
    caption: 'Celebrating our top-ranked campus programmers receiving their CodeFest trophies.',
    imageUrl: CHAPTER_IMAGES.awardCeremony,
    uploadedBy: 'Karthik Subramanian',
  },
];

/**
 * EDITABLE INITIAL EVENT REGISTRATIONS
 */
export const INITIAL_REGISTRATIONS: EventRegistration[] = [
  {
    id: 'reg_01',
    eventId: 'evt_01',
    userId: 'usr_student_01',
    userName: 'Arjun Venkatesh',
    userEmail: 'student@paavai.edu.in',
    registerNumber: '622125104088',
    department: 'AI & DS',
    year: '2nd Year',
    registeredAt: '2026-11-15 18:20',
  },
  {
    id: 'reg_02',
    eventId: 'evt_01',
    userId: 'usr_crew_01',
    userName: 'Divya Bharathi R',
    userEmail: 'crew@paavai.edu.in',
    registerNumber: '622124205019',
    department: 'IT',
    year: '3rd Year',
    registeredAt: '2026-11-14 11:05',
  },
  {
    id: 'reg_03',
    eventId: 'evt_02',
    userId: 'usr_student_01',
    userName: 'Arjun Venkatesh',
    userEmail: 'student@paavai.edu.in',
    registerNumber: '622125104088',
    department: 'AI & DS',
    year: '2nd Year',
    registeredAt: '2026-11-17 09:42',
  },
];

/**
 * EDITABLE PENDING "JOIN US" MEMBERSHIP REQUESTS
 */
export const INITIAL_JOIN_REQUESTS: JoinRequest[] = [
  {
    id: 'req_01',
    name: 'Raghul Kannan T',
    registerNumber: '622125104114',
    department: 'CSE',
    year: '2nd Year',
    email: 'raghul.k@paavai.edu.in',
    phone: '+91 96291 54012',
    skills: 'C++, Python, Basic Data Structures, SQL',
    submittedAt: '2026-11-17',
    status: 'pending',
  },
  {
    id: 'req_02',
    name: 'Sneha Lakshmi P',
    registerNumber: '622126205027',
    department: 'IT',
    year: '1st Year',
    email: 'sneha.l@paavai.edu.in',
    phone: '+91 93452 88210',
    skills: 'Java, HTML/CSS, Problem Solving',
    submittedAt: '2026-11-18',
    status: 'pending',
  },
];

/**
 * EDITABLE FAQ ITEMS
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq_01',
    question: 'Who can join the HackerRank Campus Crew at Paavai Engineering College?',
    answer:
      'Any current undergraduate or postgraduate student at Paavai Engineering College with an official @paavai.edu.in email from any department (CSE, IT, AI & DS, Cyber Security, ECE, EEE, Mechanical, and more) can sign up and become a Student Community Member.',
  },
  {
    id: 'faq_02',
    question: 'How do email verification and promotion to Campus Crew work?',
    answer:
      'Sign up with your @paavai.edu.in email and verify your inbox link to receive immediate Student Community Member access—no manual approval wait required. Active members who contribute to contests and mentoring can be promoted to Campus Crew Member by the Campus Lead.',
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
      'Yes. All HackerRank Campus Crew workshops, coding contests, and placement sprints are completely free for Paavai Engineering College students. Members-only deep-dive labs simply require a verified @paavai.edu.in account.',
  },
];
