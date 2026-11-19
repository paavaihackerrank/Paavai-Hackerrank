import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  INITIAL_ANNOUNCEMENTS,
  INITIAL_EVENTS,
  INITIAL_GALLERY,
  INITIAL_JOIN_REQUESTS,
  INITIAL_LEADERBOARD,
  INITIAL_REGISTRATIONS,
  INITIAL_RESOURCES,
  INITIAL_SITE_SETTINGS,
  INITIAL_USERS,
  JoinRequest,
  LeaderboardEntry,
  LearningResource,
  PermissionKey,
  ROLE_META,
  SiteSettings,
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
  googleProvider,
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
  isDemoPreview: boolean;
  currentUser: UserAccount | null;
  currentRole: UserRole;
  can: (permission: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  loginWithGoogle: () => Promise<AuthActionResult>;
  signup: (payload: SignupPayload) => Promise<AuthActionResult>;
  resendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  refreshEmailVerification: () => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
  exitDemoPreview: () => void;

  // Data Collections
  siteSettings: SiteSettings;
  users: UserAccount[];
  events: CampusEvent[];
  announcements: Announcement[];
  leaderboard: LeaderboardEntry[];
  resources: LearningResource[];
  gallery: GalleryPhoto[];
  registrations: EventRegistration[];
  joinRequests: JoinRequest[];
  completedResourceIds: string[];
  isFirestoreSeeded: boolean;
  seedDatabaseFromStarter: () => Promise<void>;

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

  // Demo preview override (allows previewing all 4 roles via Navbar dropdown)
  const [demoRoleOverride, setDemoRoleOverride] = useState<UserRole | null>(null);
  const [demoUsers, setDemoUsers] = useState<UserAccount[]>(INITIAL_USERS);

  // Live Firestore collections (backed by fallback sample state until seeded)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [liveUsers, setLiveUsers] = useState<UserAccount[]>([]);
  const [liveEvents, setLiveEvents] = useState<CampusEvent[]>([]);
  const [liveAnnouncements, setLiveAnnouncements] = useState<Announcement[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveResources, setLiveResources] = useState<LearningResource[]>([]);
  const [liveGallery, setLiveGallery] = useState<GalleryPhoto[]>([]);
  const [liveRegistrations, setLiveRegistrations] = useState<EventRegistration[]>([]);
  const [liveJoinRequests, setLiveJoinRequests] = useState<JoinRequest[]>([]);
  const [completedResourceIds, setCompletedResourceIds] = useState<string[]>([]);

  // Track whether Firestore has been populated with initial records
  const [hasLiveEvents, setHasLiveEvents] = useState(false);
  const [hasLiveAnnouncements, setHasLiveAnnouncements] = useState(false);
  const [hasLiveLeaderboard, setHasLiveLeaderboard] = useState(false);
  const [hasLiveResources, setHasLiveResources] = useState(false);
  const [hasLiveGallery, setHasLiveGallery] = useState(false);

  // Local fallback collections when in demo preview or unseeded database
  const [fallbackEvents, setFallbackEvents] = useState<CampusEvent[]>(INITIAL_EVENTS);
  const [fallbackAnnouncements, setFallbackAnnouncements] =
    useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [fallbackLeaderboard, setFallbackLeaderboard] =
    useState<LeaderboardEntry[]>(INITIAL_LEADERBOARD);
  const [fallbackResources, setFallbackResources] =
    useState<LearningResource[]>(INITIAL_RESOURCES);
  const [fallbackGallery, setFallbackGallery] = useState<GalleryPhoto[]>(INITIAL_GALLERY);
  const [fallbackRegistrations, setFallbackRegistrations] =
    useState<EventRegistration[]>(INITIAL_REGISTRATIONS);
  const [fallbackJoinRequests, setFallbackJoinRequests] =
    useState<JoinRequest[]>(INITIAL_JOIN_REQUESTS);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [autoSeedTriggered, setAutoSeedTriggered] = useState(false);

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

  // Helper: ensure users/{uid} exists on first verified login & return role
  const ensureUserProfile = useCallback(
    async (fbUser: FirebaseUser): Promise<Exclude<UserRole, 'outsider'>> => {
      const userPath = `users/${fbUser.uid}`;
      const userRef = doc(db, 'users', fbUser.uid);
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          clearPendingMeta(fbUser.uid);
          const role = data.role as Exclude<UserRole, 'outsider'>;
          return role === 'lead' || role === 'crew' ? role : 'member';
        }

        const isBootAdmin =
          fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
          fbUser.emailVerified;
        const pending = readPendingMeta(fbUser.uid);
        const assignedRole: Exclude<UserRole, 'outsider'> = isBootAdmin ? 'lead' : 'member';

        const newProfileDoc = {
          uid: fbUser.uid,
          email: clampStr((fbUser.email || '').toLowerCase(), 160),
          name: clampStr(pending?.name || fbUser.displayName || 'Paavai Student', 100),
          regNo: clampStr(
            (pending?.regNo || (isBootAdmin ? '622123104012' : 'PEC-MEMBER')).toUpperCase(),
            20
          ),
          department: clampStr(pending?.department || 'CSE', 40),
          year: clampStr(pending?.year || (isBootAdmin ? '4th Year' : '1st Year'), 20),
          role: assignedRole,
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
          joinedAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userRef, newProfileDoc);
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
            password: '',
            role: role === 'lead' || role === 'crew' ? role : 'member',
            regNo: String(data.regNo || data.registerNumber || 'PEC-MEMBER'),
            department: String(data.department || 'CSE'),
            year: String(data.year || '1st Year'),
            phone: String(data.phone || ''),
            hackerRankHandle: String(data.hackerRankHandle || '@paavai_coder'),
            bio: String(data.bio || ''),
            skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
            joinedAt: String(data.joinedAt || new Date().toISOString().slice(0, 10)),
          });
        } else {
          // Provision user profile document on first verified login
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

  // Derived real Firebase role vs Demo preview role
  const isDemoPreview = demoRoleOverride !== null;

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

    // 2. Events (Query all if real Crew/Lead; otherwise strictly approved events)
    const eventsQuery = isRealCrewOrLead
      ? collection(db, 'events')
      : query(collection(db, 'events'), where('status', '==', 'approved'));
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snap) => {
        setHasLiveEvents(!snap.empty);
        setLiveEvents(
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

    // 3. Announcements
    const annQuery = isRealCrewOrLead
      ? collection(db, 'announcements')
      : query(collection(db, 'announcements'), where('status', '==', 'approved'));
    const unsubAnnouncements = onSnapshot(
      annQuery,
      (snap) => {
        setHasLiveAnnouncements(!snap.empty);
        setLiveAnnouncements(
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

    // 4. Leaderboard
    const unsubLeaderboard = onSnapshot(
      collection(db, 'leaderboard'),
      (snap) => {
        setHasLiveLeaderboard(!snap.empty);
        setLiveLeaderboard(
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

    // 5. Resources (Guests & unverified users query only `access == 'basic'`)
    const resourcesQuery = isVerifiedAllowedUser
      ? collection(db, 'resources')
      : query(collection(db, 'resources'), where('access', '==', 'basic'));
    const unsubResources = onSnapshot(
      resourcesQuery,
      (snap) => {
        setHasLiveResources(!snap.empty);
        setLiveResources(
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

    // 6. Gallery
    const unsubGallery = onSnapshot(
      collection(db, 'gallery'),
      (snap) => {
        setHasLiveGallery(!snap.empty);
        setLiveGallery(
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
      setLiveRegistrations([]);
      return;
    }

    const regQuery = isRealCrewOrLead
      ? collection(db, 'registrations')
      : query(collection(db, 'registrations'), where('userId', '==', firebaseUser.uid));

    const unsubRegs = onSnapshot(
      regQuery,
      (snap) => {
        setLiveRegistrations(
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
      setLiveJoinRequests([]);
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
              password: '',
              role: role === 'lead' || role === 'crew' ? role : 'member',
              regNo: String(x.regNo || x.registerNumber || ''),
              department: String(x.department || ''),
              year: String(x.year || ''),
              phone: String(x.phone || ''),
              hackerRankHandle: String(x.hackerRankHandle || ''),
              bio: String(x.bio || ''),
              skills: Array.isArray(x.skills) ? x.skills.map(String) : [],
              joinedAt: String(x.joinedAt || ''),
            };
          })
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubJoinReqs = onSnapshot(
      collection(db, 'join_requests'),
      (snap) => {
        setLiveJoinRequests(
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

  // Seed starter data into Firestore when Campus Lead logs in to an empty database
  const seedDatabaseFromStarter = useCallback(async () => {
    if (!firebaseUser || !isRealCampusLead) {
      addToast('Campus Lead sign-in required', 'Sign in as Campus Lead to seed Firestore.', 'error');
      return;
    }
    try {
      const batch = writeBatch(db);

      batch.set(doc(db, 'site_settings', 'main'), {
        ...INITIAL_SITE_SETTINGS,
        updatedAt: new Date().toISOString(),
      });

      INITIAL_EVENTS.forEach((ev) => {
        batch.set(doc(db, 'events', ev.id), {
          title: clampStr(ev.title, 140),
          category: ev.category,
          dateISO: ev.dateISO,
          venue: clampStr(ev.venue, 160),
          description: clampStr(ev.description, 1000),
          membersOnly: ev.membersOnly,
          capacity: ev.capacity,
          status: ev.status,
          createdByUid: firebaseUser.uid,
          createdByName: clampStr(ev.createdByName, 100),
          createdByRole: ev.createdByRole,
          bannerImage: clampStr(ev.bannerImage, 500),
          updatedAt: new Date().toISOString(),
        });
      });

      INITIAL_ANNOUNCEMENTS.forEach((ann) => {
        batch.set(doc(db, 'announcements', ann.id), {
          title: clampStr(ann.title, 140),
          message: clampStr(ann.message, 1000),
          date: ann.date,
          priority: ann.priority,
          status: ann.status,
          createdByUid: firebaseUser.uid,
          createdByName: clampStr(ann.createdByName, 100),
          updatedAt: new Date().toISOString(),
        });
      });

      INITIAL_LEADERBOARD.forEach((entry) => {
        batch.set(doc(db, 'leaderboard', entry.id), {
          name: clampStr(entry.name, 100),
          registerNumber: clampStr(entry.registerNumber, 20),
          department: clampStr(entry.department, 40),
          year: clampStr(entry.year, 20),
          score: entry.score,
          problemsSolved: entry.problemsSolved,
          hackerRankHandle: clampStr(entry.hackerRankHandle, 60),
          updatedAt: new Date().toISOString(),
        });
      });

      INITIAL_RESOURCES.forEach((res) => {
        batch.set(doc(db, 'resources', res.id), {
          title: clampStr(res.title, 140),
          track: res.track,
          level: res.level,
          access: res.access,
          estimatedHours: res.estimatedHours,
          problemCount: res.problemCount,
          summary: clampStr(res.summary, 600),
          url: clampStr(res.url, 500),
          topics: res.topics.slice(0, 10),
        });
      });

      INITIAL_GALLERY.forEach((photo) => {
        batch.set(doc(db, 'gallery', photo.id), {
          title: clampStr(photo.title, 140),
          category: photo.category,
          date: photo.date,
          caption: clampStr(photo.caption, 500),
          imageUrl: clampStr(photo.imageUrl, 500),
          uploadedByUid: firebaseUser.uid,
          uploadedBy: clampStr(photo.uploadedBy, 100),
        });
      });

      await batch.commit();
      addToast(
        'Firestore database seeded',
        'Starter events, leaderboard, resources, gallery, and settings are now persisted in Firestore.',
        'success'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch_seed');
    }
  }, [firebaseUser, isRealCampusLead, addToast]);

  // Auto-seed once if Campus Lead signs in and Firestore `events` is empty
  useEffect(() => {
    if (!authReady || !firebaseUser || !isRealCampusLead || autoSeedTriggered) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'events'));
        if (!cancelled && snap.empty) {
          setAutoSeedTriggered(true);
          await seedDatabaseFromStarter();
        } else {
          setAutoSeedTriggered(true);
        }
      } catch {
        // Ignore if rules/offline; handled by snapshot listeners
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser, isRealCampusLead, autoSeedTriggered, seedDatabaseFromStarter]);

  // ---------------- ACTIVE USER & ROLE RESOLUTION ----------------
  const currentUser = useMemo<UserAccount | null>(() => {
    if (demoRoleOverride !== null) {
      if (demoRoleOverride === 'outsider') return null;
      return demoUsers.find((u) => u.role === demoRoleOverride) ?? null;
    }
    return isVerifiedAllowedUser ? firebaseProfile : null;
  }, [demoRoleOverride, demoUsers, firebaseProfile, isVerifiedAllowedUser]);

  const currentRole: UserRole = useMemo(() => {
    if (demoRoleOverride !== null) return demoRoleOverride;
    if (!isVerifiedAllowedUser) return 'outsider';
    if (firebaseProfile) return firebaseProfile.role;
    if (firebaseUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
      return 'lead';
    }
    return 'member';
  }, [demoRoleOverride, firebaseProfile, firebaseUser, isVerifiedAllowedUser]);

  const can = useCallback(
    (permission: PermissionKey): boolean => hasPermission(currentRole, permission),
    [currentRole]
  );

  // Resolved data pools
  const isFirestoreSeeded =
    hasLiveEvents || hasLiveLeaderboard || hasLiveResources || hasLiveGallery;

  const events = isDemoPreview
    ? fallbackEvents
    : hasLiveEvents
      ? liveEvents
      : fallbackEvents.filter((e) => e.status === 'approved' || can('canAccessCrewDashboard'));

  const announcements = isDemoPreview
    ? fallbackAnnouncements
    : hasLiveAnnouncements
      ? liveAnnouncements
      : fallbackAnnouncements.filter(
          (a) => a.status === 'approved' || can('canAccessCrewDashboard')
        );

  const leaderboard = isDemoPreview
    ? fallbackLeaderboard
    : hasLiveLeaderboard
      ? liveLeaderboard
      : fallbackLeaderboard;

  const resources = isDemoPreview
    ? fallbackResources
    : hasLiveResources
      ? liveResources
      : fallbackResources;

  const gallery = isDemoPreview
    ? fallbackGallery
    : hasLiveGallery
      ? liveGallery
      : fallbackGallery;

  const registrations = isDemoPreview
    ? fallbackRegistrations
    : isVerifiedAllowedUser
      ? liveRegistrations
      : [];

  const users = isDemoPreview ? demoUsers : isRealCampusLead ? liveUsers : [];
  const joinRequests = isDemoPreview
    ? fallbackJoinRequests
    : isRealCampusLead
      ? liveJoinRequests
      : [];

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
      setDemoRoleOverride(null);
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      await reload(cred.user);

      if (!cred.user.emailVerified) {
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
            'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method, or use "Continue with Google".',
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

  const loginWithGoogle = async (): Promise<AuthActionResult> => {
    try {
      setDemoRoleOverride(null);
      const cred = await signInWithPopup(auth, googleProvider);

      if (!isAllowedCollegeEmail(cred.user.email)) {
        await signOut(auth);
        return {
          ok: false,
          error:
            'Access restricted to @paavai.edu.in college Google accounts. Please sign in with your official Paavai email.',
        };
      }

      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        return { ok: true, needsVerification: true };
      }

      const role = await ensureUserProfile(cred.user);
      addToast(
        `Signed in as ${cred.user.displayName || cred.user.email}`,
        `Role: ${ROLE_META[role].label}`,
        'success'
      );
      return { ok: true, role, redirectPath: getDashboardPath(role) };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        return { ok: false, error: 'Google sign-in popup was closed.' };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Google sign-in failed.',
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
      setDemoRoleOverride(null);
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, payload.password);
      await updateProfile(cred.user, { displayName: clampStr(payload.name, 100) });

      savePendingMeta(cred.user.uid, {
        name: clampStr(payload.name, 100),
        regNo: clampStr(payload.regNo.toUpperCase(), 20),
        department: clampStr(payload.department, 40),
        year: clampStr(payload.year, 20),
        phone: clampStr(payload.phone, 20),
        hackerRankHandle: clampStr(payload.hackerRankHandle || '@paavai_coder', 60),
      });

      await sendEmailVerification(cred.user);
      addToast(
        'Verification email sent',
        `Verify ${trimmedEmail} from your inbox to activate immediate member access.`,
        'info'
      );
      return { ok: true, needsVerification: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        return {
          ok: false,
          error:
            'Email/Password sign-up is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method, or use "Continue with Google".',
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

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      return { ok: false, error: 'No active account session found.' };
    }
    try {
      await sendEmailVerification(auth.currentUser);
      addToast(
        'Verification email resent',
        `Check ${auth.currentUser.email} (including Spam/Promotions).`,
        'info'
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not resend verification email.',
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
    setDemoRoleOverride(null);
    if (firebaseUser) {
      await signOut(auth);
    }
    addToast('Signed out', 'You are now browsing as Outsider (Guest).', 'info');
  };

  const switchDemoRole = (role: UserRole) => {
    setDemoRoleOverride(role);
    addToast(
      `Demo Preview: ${ROLE_META[role].label}`,
      'Previewing UI permissions. Sign in via Login for live Firebase persistence.',
      'info'
    );
  };

  const exitDemoPreview = () => {
    setDemoRoleOverride(null);
    addToast('Exited Demo Preview', 'Restored live Firebase Auth session.', 'info');
  };

  // ---------------- EVENTS CRUD ----------------
  const createEvent: AppContextValue['createEvent'] = async (eventInput) => {
    if (!can('canCreateEvents') || !currentUser) return;
    const autoApprove = can('canPublishEventsDirectly');
    const id = `evt_${Date.now()}`;

    if (isDemoPreview || !firebaseUser) {
      const created: CampusEvent = {
        ...eventInput,
        id,
        status: autoApprove ? 'approved' : 'pending',
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
      };
      setFallbackEvents((prev) => [created, ...prev]);
      addToast(
        autoApprove ? 'Event published (Demo)' : 'Event submitted for approval (Demo)',
        created.title,
        autoApprove ? 'success' : 'info'
      );
      return;
    }

    const path = `events/${id}`;
    try {
      await setDoc(doc(db, 'events', id), {
        title: clampStr(eventInput.title, 140),
        category: eventInput.category,
        dateISO: clampStr(eventInput.dateISO, 40),
        venue: clampStr(eventInput.venue, 160),
        description: clampStr(eventInput.description, 1000),
        membersOnly: Boolean(eventInput.membersOnly),
        capacity: Number(eventInput.capacity) || 100,
        status: autoApprove ? 'approved' : 'pending',
        createdByUid: firebaseUser.uid,
        createdByName: clampStr(currentUser.name, 100),
        createdByRole: currentUser.role,
        bannerImage: clampStr(eventInput.bannerImage, 500),
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
    if (!can('canEditDeleteAnyEvent')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
      addToast('Event updated (Demo)', undefined, 'success');
      return;
    }
    const path = `events/${id}`;
    try {
      await updateDoc(doc(db, 'events', id), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      addToast('Event updated', 'Saved to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!can('canEditDeleteAnyEvent')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackEvents((prev) => prev.filter((e) => e.id !== id));
      setFallbackRegistrations((prev) => prev.filter((r) => r.eventId !== id));
      addToast('Event removed (Demo)', undefined, 'info');
      return;
    }
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
    if (!can('canCreateAnnouncements') || !currentUser) return;
    const autoApprove = can('canPublishAnnouncementsDirectly');
    const id = `ann_${Date.now()}`;

    if (isDemoPreview || !firebaseUser) {
      const next: Announcement = {
        id,
        title: title.trim(),
        message: message.trim(),
        priority,
        date: new Date().toISOString().slice(0, 10),
        status: autoApprove ? 'approved' : 'pending',
        createdByName: currentUser.name,
      };
      setFallbackAnnouncements((prev) => [next, ...prev]);
      addToast(
        autoApprove ? 'Announcement published (Demo)' : 'Announcement queued (Demo)',
        undefined,
        autoApprove ? 'success' : 'info'
      );
      return;
    }

    const path = `announcements/${id}`;
    try {
      await setDoc(doc(db, 'announcements', id), {
        title: clampStr(title, 140),
        message: clampStr(message, 1000),
        date: new Date().toISOString().slice(0, 10),
        priority,
        status: autoApprove ? 'approved' : 'pending',
        createdByUid: firebaseUser.uid,
        createdByName: clampStr(currentUser.name, 100),
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
    if (!can('canDeleteAnnouncements')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackAnnouncements((prev) => prev.filter((a) => a.id !== id));
      addToast('Announcement deleted (Demo)', undefined, 'info');
      return;
    }
    const path = `announcements/${id}`;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      addToast('Announcement deleted', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const approveAnnouncement = async (id: string) => {
    if (!can('canApproveContent')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a))
      );
      addToast('Announcement approved (Demo)', undefined, 'success');
      return;
    }
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
    if (!can('canApproveContent')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a))
      );
      addToast('Announcement rejected (Demo)', undefined, 'info');
      return;
    }
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
    if (!currentUser || !can('canRegisterForEvents')) {
      addToast(
        'Sign in required',
        'Sign in with a verified @paavai.edu.in account to register for events.',
        'error'
      );
      return;
    }
    const target = events.find((e) => e.id === eventId);
    if (!target) return;

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
      userName: clampStr(currentUser.name, 100),
      userEmail: clampStr(currentUser.email, 160),
      registerNumber: clampStr(currentUser.regNo || 'PEC-MEMBER', 20),
      department: clampStr(currentUser.department || 'CSE', 40),
      year: clampStr(currentUser.year || '1st Year', 20),
      registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    if (isDemoPreview || !firebaseUser) {
      setFallbackRegistrations((prev) => [{ id: regId, ...payload }, ...prev]);
      addToast('Registration confirmed (Demo)', `Seat reserved for "${target.title}".`, 'success');
      return;
    }

    if (!hasLiveEvents) {
      addToast(
        'Database initializing',
        'Starter events must be seeded to Firestore by the Campus Lead first.',
        'info'
      );
      return;
    }

    const path = `registrations/${regId}`;
    try {
      await setDoc(doc(db, 'registrations', regId), payload);
      addToast('Registration confirmed', `Seat reserved for "${target.title}".`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const cancelRegistration = async (eventId: string) => {
    if (!currentUser) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackRegistrations((prev) =>
        prev.filter((r) => !(r.eventId === eventId && r.userId === currentUser.id))
      );
      addToast('Registration cancelled (Demo)', undefined, 'info');
      return;
    }
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
    if (!can('canUpdateLeaderboard')) return;
    const id = entry.id || `lb_${Date.now()}`;
    const docPayload = {
      name: clampStr(entry.name, 100),
      registerNumber: clampStr(entry.registerNumber, 20),
      department: clampStr(entry.department, 40),
      year: clampStr(entry.year, 20),
      score: Number(entry.score) || 0,
      problemsSolved: Number(entry.problemsSolved) || 0,
      hackerRankHandle: clampStr(entry.hackerRankHandle || '@coder_pec', 60),
      updatedAt: new Date().toISOString(),
    };

    if (isDemoPreview || !firebaseUser) {
      if (entry.id) {
        setFallbackLeaderboard((prev) =>
          prev.map((item) => (item.id === entry.id ? { ...docPayload, id } : item))
        );
      } else {
        setFallbackLeaderboard((prev) => [...prev, { ...docPayload, id }]);
      }
      addToast('Leaderboard updated (Demo)', `${entry.name}: ${entry.score} pts`, 'success');
      return;
    }

    const path = `leaderboard/${id}`;
    try {
      await setDoc(doc(db, 'leaderboard', id), docPayload);
      addToast('Leaderboard updated', `${entry.name}: ${entry.score} pts`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteLeaderboardEntry = async (id: string) => {
    if (!can('canUpdateLeaderboard')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackLeaderboard((prev) => prev.filter((item) => item.id !== id));
      addToast('Entry removed (Demo)', undefined, 'info');
      return;
    }
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
    if (!can('canUploadGallery') || !currentUser) return;
    const id = `gal_${Date.now()}`;

    if (isDemoPreview || !firebaseUser) {
      setFallbackGallery((prev) => [{ ...photo, id, uploadedBy: currentUser.name }, ...prev]);
      addToast('Photo uploaded (Demo)', photo.title, 'success');
      return;
    }

    const path = `gallery/${id}`;
    try {
      await setDoc(doc(db, 'gallery', id), {
        title: clampStr(photo.title, 140),
        category: photo.category,
        date: clampStr(photo.date, 30),
        caption: clampStr(photo.caption, 500),
        imageUrl: clampStr(photo.imageUrl, 500),
        uploadedByUid: firebaseUser.uid,
        uploadedBy: clampStr(currentUser.name, 100),
      });
      addToast('Photo uploaded', `"${photo.title}" saved to Firestore gallery.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteGalleryPhoto = async (id: string) => {
    if (!can('canDeleteGallery')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackGallery((prev) => prev.filter((g) => g.id !== id));
      addToast('Photo deleted (Demo)', undefined, 'info');
      return;
    }
    const path = `gallery/${id}`;
    try {
      await deleteDoc(doc(db, 'gallery', id));
      addToast('Photo deleted', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addResource: AppContextValue['addResource'] = async (res) => {
    if (!can('canManageResources')) return;
    const id = `res_${Date.now()}`;

    if (isDemoPreview || !firebaseUser) {
      setFallbackResources((prev) => [{ ...res, id }, ...prev]);
      addToast('Resource published (Demo)', res.title, 'success');
      return;
    }

    const path = `resources/${id}`;
    try {
      await setDoc(doc(db, 'resources', id), {
        title: clampStr(res.title, 140),
        track: res.track,
        level: res.level,
        access: res.access,
        estimatedHours: Number(res.estimatedHours) || 6,
        problemCount: Number(res.problemCount) || 20,
        summary: clampStr(res.summary, 600),
        url: clampStr(res.url, 500),
        topics: (res.topics.length ? res.topics : ['Problem Solving']).slice(0, 10),
      });
      addToast('Resource published', `"${res.title}" added to roadmap.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteResource = async (id: string) => {
    if (!can('canManageResources')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackResources((prev) => prev.filter((r) => r.id !== id));
      addToast('Resource removed (Demo)', undefined, 'info');
      return;
    }
    const path = `resources/${id}`;
    try {
      await deleteDoc(doc(db, 'resources', id));
      addToast('Resource removed', undefined, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const toggleResourceCompleted = async (resourceId: string) => {
    if (!currentUser) {
      addToast('Sign in to track progress', 'Log in to save completed modules.', 'info');
      return;
    }
    const next = completedResourceIds.includes(resourceId)
      ? completedResourceIds.filter((id) => id !== resourceId)
      : [...completedResourceIds, resourceId];

    setCompletedResourceIds(next);

    if (!isDemoPreview && firebaseUser) {
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
    }
  };

  // ---------------- USERS, JOIN REQUESTS & SITE SETTINGS ----------------
  const updateUserRole = async (userId: string, newRole: Exclude<UserRole, 'outsider'>) => {
    if (!can('canAssignRoles')) return;
    if (userId === currentUser?.id) {
      addToast('Action blocked', 'You cannot change your own role.', 'error');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    const displayName = targetUser?.name || 'Member';
    if (isDemoPreview || !firebaseUser) {
      setDemoUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      addToast(
        'Role updated (Demo)',
        `${displayName} is now ${ROLE_META[newRole].label}.`,
        'success'
      );
      return;
    }
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
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
    if (!can('canDeleteUsers')) return;
    if (userId === currentUser?.id) {
      addToast('Cannot remove active session', 'You cannot delete your own active account.', 'error');
      return;
    }
    if (isDemoPreview || !firebaseUser) {
      setDemoUsers((prev) => prev.filter((u) => u.id !== userId));
      addToast('User removed (Demo)', undefined, 'info');
      return;
    }
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
      addToast('User removed', 'Deleted from Firestore directory.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const submitJoinRequest: AppContextValue['submitJoinRequest'] = async (req) => {
    const id = `req_${Date.now()}`;
    const docPayload = {
      name: clampStr(req.name, 100),
      registerNumber: clampStr(req.registerNumber.toUpperCase(), 20),
      department: clampStr(req.department, 40),
      year: clampStr(req.year, 20),
      email: clampStr(req.email.toLowerCase(), 160),
      phone: clampStr(req.phone, 20),
      skills: clampStr(req.skills, 400),
      submittedAt: new Date().toISOString().slice(0, 10),
      status: 'pending' as const,
    };

    if (isDemoPreview) {
      setFallbackJoinRequests((prev) => [{ id, ...docPayload }, ...prev]);
      addToast('Application submitted (Demo)', 'Queued in Demo Lead dashboard.', 'success');
      return;
    }

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
    if (!can('canManageUsers')) return;
    if (isDemoPreview || !firebaseUser) {
      setFallbackJoinRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r))
      );
      addToast(`Join request ${decision} (Demo)`, undefined, 'success');
      return;
    }
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
    if (!can('canManageSiteSettings')) return;
    const merged = { ...siteSettings, ...updates };
    if (isDemoPreview || !firebaseUser) {
      setSiteSettings(merged);
      addToast('Site settings saved (Demo)', undefined, 'success');
      return;
    }
    const path = 'site_settings/main';
    try {
      await setDoc(doc(db, 'site_settings', 'main'), {
        chapterName: clampStr(merged.chapterName, 100),
        collegeName: clampStr(merged.collegeName, 120),
        tagline: clampStr(merged.tagline, 120),
        contactEmail: clampStr(merged.contactEmail, 160),
        campusLocation: clampStr(merged.campusLocation, 200),
        applicationsOpen: Boolean(merged.applicationsOpen),
        publicLeaderboardLimit: Number(merged.publicLeaderboardLimit) || 10,
        hackerRankClubUrl: clampStr(merged.hackerRankClubUrl, 300),
        updatedAt: new Date().toISOString(),
      });
      addToast('Site settings saved', 'Persisted to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const updateOwnProfile: AppContextValue['updateOwnProfile'] = async (updates) => {
    if (!currentUser || !can('canEditOwnProfile')) return;
    if (isDemoPreview || !firebaseUser) {
      setDemoUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, ...updates } : u))
      );
      addToast('Profile saved (Demo)', undefined, 'success');
      return;
    }
    const path = `users/${firebaseUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        ...(updates.name !== undefined ? { name: clampStr(updates.name, 100) } : {}),
        ...(updates.regNo !== undefined
          ? { regNo: clampStr(updates.regNo.toUpperCase(), 20) }
          : {}),
        ...(updates.department !== undefined
          ? { department: clampStr(updates.department, 40) }
          : {}),
        ...(updates.year !== undefined ? { year: clampStr(updates.year, 20) } : {}),
        ...(updates.phone !== undefined ? { phone: clampStr(updates.phone, 20) } : {}),
        ...(updates.hackerRankHandle !== undefined
          ? { hackerRankHandle: clampStr(updates.hackerRankHandle, 60) }
          : {}),
        ...(updates.bio !== undefined ? { bio: clampStr(updates.bio, 500) } : {}),
        ...(updates.skills !== undefined ? { skills: updates.skills.slice(0, 12) } : {}),
        updatedAt: new Date().toISOString(),
      });
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
        isDemoPreview,
        currentUser,
        currentRole,
        can,
        login,
        loginWithGoogle,
        signup,
        resendVerificationEmail,
        refreshEmailVerification,
        logout,
        switchDemoRole,
        exitDemoPreview,
        siteSettings,
        users,
        events,
        announcements,
        leaderboard,
        resources,
        gallery,
        registrations,
        joinRequests,
        completedResourceIds,
        isFirestoreSeeded,
        seedDatabaseFromStarter,
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
