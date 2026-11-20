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
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
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
  CampusEvent,
  EventRegistration,
  GalleryPhoto,
  INITIAL_SITE_SETTINGS,
  JoinRequest,
  LeaderboardEntry,
  LearningResource,
  PermissionKey,
  ROLE_META,
  SiteSettings,
  TeamMember,
  UserAccount,
  UserRole,
  getDashboardPath,
  hasPermission,
} from '../config/rbacAndData';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  handleFirestoreError,
} from '../lib/firebase';

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
  password: string;
  regNo: string;
  department: string;
  year: string;
  phone: string;
  hackerRankHandle: string;
}

interface PendingSignupMeta {
  name: string;
  regNo: string;
  department: string;
  year: string;
  phone: string;
  hackerRankHandle: string;
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  needsVerification?: boolean;
  role?: Exclude<UserRole, 'outsider'>;
  redirectPath?: string;
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
  currentUser: UserAccount | null;
  currentRole: UserRole;
  can: (permission: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (payload: SignupPayload) => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  refreshEmailVerification: () => Promise<AuthActionResult>;
  logout: () => Promise<void>;

  // Live Firestore Data Collections
  siteSettings: SiteSettings;
  users: UserAccount[];
  teamMembers: TeamMember[];
  events: CampusEvent[];
  announcements: Announcement[];
  leaderboard: LeaderboardEntry[];
  resources: LearningResource[];
  gallery: GalleryPhoto[];
  registrations: EventRegistration[];
  joinRequests: JoinRequest[];
  completedResourceIds: string[];

  // Actions — Events
  createEvent: (
    event: Omit<CampusEvent, 'id' | 'status' | 'createdByName' | 'createdByRole'>
  ) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CampusEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  approveEvent: (id: string) => Promise<void>;
  rejectEvent: (id: string) => Promise<void>;

  // Actions — Announcements
  createAnnouncement: (payload: {
    title: string;
    message: string;
    priority: 'Normal' | 'Important';
  }) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  approveAnnouncement: (id: string) => Promise<void>;
  rejectAnnouncement: (id: string) => Promise<void>;

  // Actions — Registrations
  registerForEvent: (eventId: string) => Promise<void>;
  cancelRegistration: (eventId: string) => Promise<void>;
  exportRegistrationsCSV: () => void;

  // Actions — Leaderboard
  upsertLeaderboardEntry: (entry: Omit<LeaderboardEntry, 'id'> & { id?: string }) => Promise<void>;
  deleteLeaderboardEntry: (id: string) => Promise<void>;

  // Actions — Gallery & Resources
  addGalleryPhoto: (photo: Omit<GalleryPhoto, 'id' | 'uploadedBy'>) => Promise<void>;
  deleteGalleryPhoto: (id: string) => Promise<void>;
  addResource: (resource: Omit<LearningResource, 'id'>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  toggleResourceCompleted: (resourceId: string) => Promise<void>;

  // Actions — Users, Join Requests & Settings
  updateUserRole: (userId: string, newRole: Exclude<UserRole, 'outsider'>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  submitJoinRequest: (
    req: Omit<JoinRequest, 'id' | 'submittedAt' | 'status'>
  ) => Promise<void>;
  reviewJoinRequest: (requestId: string, decision: 'approved' | 'rejected') => Promise<void>;
  updateSiteSettings: (updates: Partial<SiteSettings>) => Promise<void>;
  updateOwnProfile: (
    updates: Partial<
      Pick<
        UserAccount,
        'name' | 'regNo' | 'department' | 'year' | 'phone' | 'hackerRankHandle' | 'bio' | 'skills'
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

export function isAllowedCollegeEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    /^[a-z0-9._%+\-]+@paavai\.edu\.in$/.test(lower) ||
    lower === BOOTSTRAPPED_ADMIN_EMAIL
  );
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

  // Live Firestore collections (zero demo/mock fallback data)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [liveUsers, setLiveUsers] = useState<UserAccount[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [completedResourceIds, setCompletedResourceIds] = useState<string[]>([]);

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
        if (snap.exists()) {
          const data = snap.data();
          clearPendingMeta(fbUser.uid);
          if (data.emailVerified === false) {
            await updateDoc(userRef, {
              emailVerified: true,
              updatedAt: new Date().toISOString(),
            });
          }
          const rawRole = data.role as Exclude<UserRole, 'outsider'>;
          const resolvedRole: Exclude<UserRole, 'outsider'> =
            rawRole === 'lead' || rawRole === 'crew' ? rawRole : 'member';

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
                hackerRankHandle: String(data.hackerRankHandle || ''),
              })
            );
          }

          return resolvedRole;
        }

        const isBootAdmin =
          fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
          fbUser.emailVerified;
        const pending = readPendingMeta(fbUser.uid);
        const assignedRole: Exclude<UserRole, 'outsider'> = isBootAdmin ? 'lead' : 'member';
        const nowISO = new Date().toISOString();

        const newProfileDoc = {
          uid: fbUser.uid,
          email: clampStr((fbUser.email || '').toLowerCase(), 160),
          name: ensureMinLen(pending?.name || fbUser.displayName || 'Paavai Student', 'Paavai Student', 2, 100),
          regNo: clampStr(
            (pending?.regNo || (isBootAdmin ? '622123104012' : 'PEC-MEMBER')).toUpperCase(),
            20
          ),
          department: ensureMinLen(pending?.department || 'CSE', 'CSE', 2, 40),
          year: ensureMinLen(pending?.year || (isBootAdmin ? '4th Year' : '1st Year'), '1st Year', 2, 20),
          role: assignedRole,
          emailVerified: true,
          phone: clampStr(pending?.phone || '', 20),
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
              hackerRankHandle: newProfileDoc.hackerRankHandle,
            })
          );
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
        cleanupRanForUidRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  const isVerifiedAllowedUser = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      isAllowedCollegeEmail(firebaseUser.email)
  );

  const needsEmailVerification = Boolean(
    firebaseUser &&
      !firebaseUser.emailVerified &&
      isAllowedCollegeEmail(firebaseUser.email)
  );

  const unverifiedEmail = needsEmailVerification ? firebaseUser?.email || null : null;

  // Listen to verified signed-in user's Firestore profile (/users/{uid}) & progress (/user_progress/{uid})
  useEffect(() => {
    if (!firebaseUser || !isVerifiedAllowedUser) {
      setFirebaseProfile(null);
      setCompletedResourceIds([]);
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
            role: role === 'lead' || role === 'crew' ? role : 'member',
            emailVerified: data.emailVerified !== false,
            regNo: String(data.regNo || data.registerNumber || 'PEC-MEMBER'),
            department: String(data.department || 'CSE'),
            year: String(data.year || '1st Year'),
            phone: String(data.phone || ''),
            hackerRankHandle: String(data.hackerRankHandle || '@paavai_coder'),
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

    return () => {
      unsubProfile();
      unsubProgress();
    };
  }, [firebaseUser, isVerifiedAllowedUser, ensureUserProfile]);

  const isRealCampusLead = Boolean(
    isVerifiedAllowedUser &&
      (firebaseUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL ||
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

    // 5. Leaderboard
    const unsubLeaderboard = onSnapshot(
      collection(db, 'leaderboard'),
      (snap) => {
        setLeaderboard(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              name: String(x.name || ''),
              registerNumber: String(x.registerNumber || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              score: Number(x.score || 0),
              problemsSolved: Number(x.problemsSolved || 0),
              hackerRankHandle: String(x.hackerRankHandle || '@coder'),
            };
          })
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

    return () => {
      unsubSettings();
      unsubTeam();
      unsubEvents();
      unsubAnnouncements();
      unsubLeaderboard();
      unsubResources();
      unsubGallery();
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
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'registrations')
    );

    return () => unsubRegs();
  }, [authReady, firebaseUser, isVerifiedAllowedUser, isRealCrewOrLead]);

  // Lead-only listeners: /users and /join_requests
  useEffect(() => {
    if (!authReady || !firebaseUser || !isVerifiedAllowedUser || !isRealCampusLead) {
      setLiveUsers([]);
      setJoinRequests([]);
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
              role: role === 'lead' || role === 'crew' ? role : 'member',
              emailVerified: x.emailVerified !== false,
              regNo: String(x.regNo || x.registerNumber || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              phone: String(x.phone || ''),
              hackerRankHandle: String(x.hackerRankHandle || ''),
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
          snap.docs.map((d) => {
            const x = d.data();
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
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'join_requests')
    );

    return () => {
      unsubUsers();
      unsubJoinReqs();
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
          regsSnap,
          joinSnap,
          lbSnap,
          eventsSnap,
          annSnap,
          galSnap,
          resSnap,
        ] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'team_members')),
          getDocs(collection(db, 'registrations')),
          getDocs(collection(db, 'join_requests')),
          getDocs(collection(db, 'leaderboard')),
          getDocs(collection(db, 'events')),
          getDocs(collection(db, 'announcements')),
          getDocs(collection(db, 'gallery')),
          getDocs(collection(db, 'resources')),
        ]);

        if (cancelled) return;

        const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
        const realTeamMap = new Map<
          string,
          {
            uid: string;
            name: string;
            role: 'lead' | 'crew';
            department: string;
            year: string;
            bio: string;
            hackerRankHandle: string;
          }
        >();

        usersSnap.docs.forEach((d) => {
          const x = d.data();
          const email = String(x.email || '').trim().toLowerCase();
          const isDemoUser =
            LEGACY_DEMO_USER_IDS.has(d.id) || LEGACY_DEMO_EMAILS.has(email);

          if (isDemoUser && d.id !== firebaseUser.uid) {
            ops.push((b) => b.delete(d.ref));
            return;
          }

          const role = x.role as Exclude<UserRole, 'outsider'>;
          if (role === 'lead' || role === 'crew') {
            realTeamMap.set(d.id, {
              uid: d.id,
              name: String(x.name || 'Paavai Coder'),
              role,
              department: String(x.department || 'CSE'),
              year: String(x.year || '1st Year'),
              bio: String(x.bio || ''),
              hackerRankHandle: String(x.hackerRankHandle || ''),
            });
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
            LEGACY_DEMO_USER_IDS.has(userId) ||
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

  // ---------------- ACTIVE USER & ROLE RESOLUTION ----------------
  const currentUser = useMemo<UserAccount | null>(() => {
    return isVerifiedAllowedUser ? firebaseProfile : null;
  }, [firebaseProfile, isVerifiedAllowedUser]);

  const currentRole: UserRole = useMemo(() => {
    if (!isVerifiedAllowedUser) return 'outsider';
    if (firebaseProfile) return firebaseProfile.role;
    if (firebaseUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
      return 'lead';
    }
    return 'member';
  }, [firebaseProfile, firebaseUser, isVerifiedAllowedUser]);

  const can = useCallback(
    (permission: PermissionKey): boolean => hasPermission(currentRole, permission),
    [currentRole]
  );

  const users = isRealCampusLead ? liveUsers : [];

  // ---------------- FIREBASE AUTH ACTIONS ----------------
  const login = async (email: string, password: string): Promise<AuthActionResult> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isAllowedCollegeEmail(trimmedEmail)) {
      return {
        ok: false,
        error: 'Only verified @paavai.edu.in college email addresses are allowed to sign in.',
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
    if (!isAllowedCollegeEmail(trimmedEmail)) {
      return {
        ok: false,
        error: 'Sign up requires an official @paavai.edu.in college email address.',
      };
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, payload.password);
      await updateProfile(cred.user, { displayName: clampStr(payload.name, 100) });

      let emailSent = false;
      let emailErrorMsg = '';
      try {
        auth.useDeviceLanguage();
        await sendEmailVerification(cred.user);
        emailSent = true;
      } catch (mailErr: unknown) {
        console.error('Failed to send initial verification email:', mailErr);
        const mailCode = (mailErr as { code?: string })?.code || '';
        emailErrorMsg =
          mailCode === 'auth/too-many-requests'
            ? 'Too many verification requests. Please wait a few minutes and try again.'
            : mailErr instanceof Error
              ? mailErr.message
              : 'Could not send verification email.';
      }

      const nowISO = new Date().toISOString();
      const pendingMeta = {
        name: ensureMinLen(payload.name, 'Paavai Student', 2, 100),
        regNo: clampStr((payload.regNo || 'PEC-MEMBER').toUpperCase(), 20),
        department: ensureMinLen(payload.department, 'CSE', 2, 40),
        year: ensureMinLen(payload.year, '1st Year', 2, 20),
        phone: clampStr(payload.phone, 20),
        hackerRankHandle: clampStr(
          payload.hackerRankHandle || `@${trimmedEmail.split('@')[0].slice(0, 20)}`,
          60
        ),
      };

      savePendingMeta(cred.user.uid, pendingMeta);

      // Persist unverified user record in Firestore so scheduled cleanup can purge unverified accounts after 12h
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: clampStr(trimmedEmail, 160),
          name: pendingMeta.name,
          regNo: pendingMeta.regNo,
          department: pendingMeta.department,
          year: pendingMeta.year,
          role: 'member',
          emailVerified: false,
          phone: pendingMeta.phone,
          hackerRankHandle: pendingMeta.hackerRankHandle,
          bio: 'Student Community Member at Paavai Engineering College.',
          skills: ['Problem Solving'],
          joinedAt: nowISO.slice(0, 10),
          createdAt: nowISO,
          updatedAt: nowISO,
        });
      } catch (writeErr) {
        console.warn('Could not persist unverified user record:', writeErr);
      }

      setFirebaseUser(cred.user);

      if (emailSent) {
        addToast(
          'Verification email sent',
          `Check ${trimmedEmail} (including Spam/Promotions) for your verification link to activate your account within 12 hours.`,
          'success'
        );
      } else {
        addToast(
          'Failed to send verification email',
          `${emailErrorMsg} Click "Resend Verification Email" to send it again.`,
          'error'
        );
      }
      return { ok: true, needsVerification: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        return {
          ok: false,
          error:
            'Email/Password sign-up is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method.',
        };
      }
      if (code === 'auth/email-already-in-use') {
        return { ok: false, error: 'An account with this email already exists.' };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not create account.',
      };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ ok: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isAllowedCollegeEmail(trimmedEmail)) {
      return {
        ok: false,
        error: 'Enter your registered @paavai.edu.in email address.',
      };
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      addToast(
        'Password reset email sent',
        `Check ${trimmedEmail} (including Spam/Promotions) for your password reset link.`,
        'success'
      );
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        return { ok: false, error: 'No account found with this email address.' };
      }
      if (code === 'auth/invalid-email') {
        return { ok: false, error: 'Enter a valid @paavai.edu.in email address.' };
      }
      if (code === 'auth/too-many-requests') {
        return { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not send password reset email.',
      };
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      const msg = 'No active account session found. Please sign in first.';
      addToast('Failed to send verification email', msg, 'error');
      return { ok: false, error: msg };
    }
    try {
      auth.useDeviceLanguage();
      await sendEmailVerification(auth.currentUser);
      addToast(
        'Verification email sent',
        `A verification link has been sent to ${auth.currentUser.email}. Check your inbox (including Spam/Promotions).`,
        'success'
      );
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const errMsg =
        code === 'auth/too-many-requests'
          ? 'Too many verification requests. Please wait a few minutes before trying again.'
          : err instanceof Error
            ? err.message
            : 'Could not resend verification email.';
      addToast('Failed to send verification email', errMsg, 'error');
      return {
        ok: false,
        error: errMsg,
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

      if (!isAllowedCollegeEmail(refreshed.email)) {
        await signOut(auth);
        return { ok: false, error: 'Only @paavai.edu.in emails are permitted.' };
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

  const logout = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    addToast('Signed out', 'You are now browsing as Guest.', 'info');
  };

  // ---------------- EVENTS CRUD ----------------
  const createEvent: AppContextValue['createEvent'] = async (eventInput) => {
    if (!can('canCreateEvents') || !currentUser || !firebaseUser) return;
    const autoApprove = can('canPublishEventsDirectly');
    const id = `evt_${Date.now()}`;
    const path = `events/${id}`;
    try {
      await setDoc(doc(db, 'events', id), {
        title: ensureMinLen(eventInput.title, 'Campus Coding Event', 3, 140),
        category: eventInput.category,
        dateISO: clampStr(eventInput.dateISO, 40),
        venue: ensureMinLen(eventInput.venue, 'Paavai Campus', 2, 160),
        description: ensureMinLen(eventInput.description, 'Campus Crew event', 5, 1000),
        membersOnly: Boolean(eventInput.membersOnly),
        capacity: Math.min(5000, Math.max(1, Number(eventInput.capacity) || 100)),
        status: autoApprove ? 'approved' : 'pending',
        createdByUid: firebaseUser.uid,
        createdByName: ensureMinLen(currentUser.name, 'Campus Crew', 2, 100),
        createdByRole: currentUser.role,
        bannerImage: clampStr(eventInput.bannerImage || '/src/assets/images/gallery_hackathon_arena_1795100082455.jpg', 500),
        updatedAt: new Date().toISOString(),
      });
      addToast(
        autoApprove ? 'Event published' : 'Event submitted for approval',
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

    try {
      await updateDoc(doc(db, 'events', id), sanitizedUpdates);
      addToast('Event updated', 'Saved to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
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
    if (!can('canApproveContent')) return;
    await updateEvent(id, { status: 'approved' });
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
  const registerForEvent = async (eventId: string) => {
    if (!currentUser || !firebaseUser || !can('canRegisterForEvents')) {
      addToast(
        'Sign in required',
        'Sign in with a verified @paavai.edu.in account to register for events.',
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

    const regId = sanitizeId(`reg_${eventId}_${currentUser.id}`);
    const payload = {
      eventId: sanitizeId(eventId),
      userId: sanitizeId(currentUser.id),
      userName: ensureMinLen(currentUser.name, 'Paavai Student', 2, 100),
      userEmail: clampStr(currentUser.email, 160),
      registerNumber: ensureMinLen(currentUser.regNo || 'PEC-MEMBER', 'PEC-MEMBER', 4, 20),
      department: ensureMinLen(currentUser.department || 'CSE', 'CSE', 2, 40),
      year: ensureMinLen(currentUser.year || '1st Year', '1st Year', 2, 20),
      registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    const path = `registrations/${regId}`;
    try {
      await setDoc(doc(db, 'registrations', regId), payload);
      addToast('Registration confirmed', `Seat reserved for "${target.title}".`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
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
    const next = completedResourceIds.includes(resourceId)
      ? completedResourceIds.filter((id) => id !== resourceId)
      : [...completedResourceIds, resourceId];

    const path = `user_progress/${firebaseUser.uid}`;
    try {
      await setDoc(doc(db, 'user_progress', firebaseUser.uid), {
        uid: firebaseUser.uid,
        completedResourceIds: next.slice(0, 200),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
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
              hackerRankHandle: targetUser.hackerRankHandle,
            }
          : {
              name: String(userSnap?.data()?.name || displayName),
              department: String(userSnap?.data()?.department || 'CSE'),
              year: String(userSnap?.data()?.year || '1st Year'),
              bio: String(userSnap?.data()?.bio || ''),
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

  const deleteUser = async (userId: string) => {
    if (!can('canDeleteUsers') || !firebaseUser) return;
    if (userId === currentUser?.id) {
      addToast('Cannot remove active session', 'You cannot delete your own active account.', 'error');
      return;
    }
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
      await deleteDoc(doc(db, 'team_members', userId));
      addToast('User removed', 'Deleted from Firestore directory.', 'info');
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
      addToast(
        'Application submitted',
        'Saved to Firestore. The Campus Lead will review your inquiry.',
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const reviewJoinRequest = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!can('canManageUsers') || !firebaseUser) return;
    const path = `join_requests/${requestId}`;
    try {
      await updateDoc(doc(db, 'join_requests', requestId), { status: decision });
      addToast(
        decision === 'approved' ? 'Join request marked reviewed' : 'Join request declined',
        'Status updated in Firestore.',
        decision === 'approved' ? 'success' : 'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
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
    const nextBio =
      updates.bio !== undefined ? clampStr(updates.bio, 500) : currentUser.bio;

    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        ...(updates.name !== undefined ? { name: nextName } : {}),
        ...(updates.regNo !== undefined
          ? { regNo: clampStr(updates.regNo.toUpperCase(), 20) }
          : {}),
        ...(updates.department !== undefined ? { department: nextDepartment } : {}),
        ...(updates.year !== undefined ? { year: nextYear } : {}),
        ...(updates.phone !== undefined ? { phone: clampStr(updates.phone, 20) } : {}),
        ...(updates.hackerRankHandle !== undefined ? { hackerRankHandle: nextHandle } : {}),
        ...(updates.bio !== undefined ? { bio: nextBio } : {}),
        ...(updates.skills !== undefined ? { skills: updates.skills.slice(0, 12) } : {}),
        updatedAt: new Date().toISOString(),
      });

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
            hackerRankHandle: nextHandle,
          })
        );
      }

      addToast('Profile saved', 'Updated in Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        authReady,
        firebaseUser,
        needsEmailVerification,
        unverifiedEmail,
        currentUser,
        currentRole,
        can,
        login,
        signup,
        sendPasswordReset,
        resendVerificationEmail,
        refreshEmailVerification,
        logout,
        siteSettings,
        users,
        teamMembers,
        events,
        announcements,
        leaderboard,
        resources,
        gallery,
        registrations,
        joinRequests,
        completedResourceIds,
        createEvent,
        updateEvent,
        deleteEvent,
        approveEvent,
        rejectEvent,
        createAnnouncement,
        deleteAnnouncement,
        approveAnnouncement,
        rejectAnnouncement,
        registerForEvent,
        cancelRegistration,
        exportRegistrationsCSV,
        upsertLeaderboardEntry,
        deleteLeaderboardEntry,
        addGalleryPhoto,
        deleteGalleryPhoto,
        addResource,
        deleteResource,
        toggleResourceCompleted,
        updateUserRole,
        deleteUser,
        submitJoinRequest,
        reviewJoinRequest,
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
