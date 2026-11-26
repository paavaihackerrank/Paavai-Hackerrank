# HackerRank Campus Crew – Paavai Engineering College
## Complete Website Report: Architecture, Functionality, Workflows & Technical Reference

**Project Name:** HackerRank Campus Crew – Paavai Engineering College (`HRCC Paavai`)  
**Firebase Project ID:** `paavai-hackerrank`  
**Firestore Database ID:** `ai-studio-hackerrankcampus-521e66b2-ef2a-4b15-a7c4-9be9472b4dbc`  
**Bootstrapped Campus Lead (Admin) Email:** `paavaihackerrank@gmail.com`  
**Development URL:** `https://ais-dev-tk72eyqzz7rshp3wueko7d-896897648427.asia-northeast1.run.app`  
**Shared Preview URL:** `https://ais-pre-tk72eyqzz7rshp3wueko7d-896897648427.asia-northeast1.run.app`  

---

## 1. Executive Summary & Tech Stack

The **HackerRank Campus Crew – Paavai Engineering College** portal is a full-featured, role-based competitive programming community platform built for students, mentors (Campus Crew), and administrators (Campus Lead). It combines real-time Firestore synchronization, strict database-level security rules, immediate email-verified student onboarding, QR-based event attendance tracking, coding activity analytics, and dynamic search engine optimization.

### Core Technology Stack
| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend Framework** | React 19 (`react`, `react-dom`), TypeScript (`tsc --noEmit`), Vite 8 |
| **Routing & Navigation** | React Router DOM v7 (`BrowserRouter`, nested public, dynamic, and `ProtectedRoute` workspaces) |
| **Styling & UI** | Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react` icons, `motion` animations, Dark/Light theme (`hrcc_theme` persisted in `localStorage`) |
| **Data Visualization** | Recharts (`MemberActivityChart`), custom SVG/Grid heatmap (`CodingActivityHeatmap`) |
| **QR & Media Utilities** | `qrcode` (QR check-in PNG/data-URL generator), browser `BarcodeDetector` camera scanner, `SafeImage`, `MemberAvatar` |
| **SEO & Head Management** | `react-helmet`, dynamic `PageSeo` component, Schema.org JSON-LD, OpenGraph & Twitter Cards, Google Site Verification |
| **Backend & Database** | Firebase Authentication, Cloud Firestore (multi-collection real-time listeners + `firestore.rules`), Firebase Cloud Functions v2 (`onSchedule`) |

---

## 2. Role-Based Access Control (RBAC) Architecture

Access control is enforced at **three independent layers**:
1. **Route Guarding** (`src/components/ProtectedRoute.tsx` reading `ROLE_PERMISSIONS`)
2. **UI Capability Gating** (`can(permissionKey)` in `AppContext`)
3. **Server-Side Enforcement** (`firestore.rules` with schema validation, field-diff restrictions, and `email_verified == true` checks)

### Role Tiers
| Role Key | Label | Summary of Capabilities |
| :--- | :--- | :--- |
| **`outsider`** | **Outsider (Guest)** | Public preview access: Home, Team Roster, Approved Events, Basic Roadmap tracks, Top-N Leaderboard preview (configurable, default Top 10), Gallery, Contact/FAQ, and Join Us intake form. |
| **`member`** | **Student Community Member** | Automatically granted upon verified student signup. Unlocks full Campus Leaderboard, intermediate/advanced Learning Roadmap sheets, progress tracking, Event Registration, QR Check-In, Coding Activity Heatmap logging, Member Dashboard, and Profile editing. |
| **`crew`** | **Campus Crew Member** | Core chapter organizers promoted by Campus Lead. Appears on the public `/team` roster. Can draft Events & Announcements (`pending` approval), generate/toggle Event QR Check-In codes, view registrations, upload Gallery photos, manage Learning Resources, and update Leaderboard entries. |
| **`lead`** | **Campus Lead (Admin)** | Full chapter administrator (`paavaihackerrank@gmail.com` bootstrapped automatically + any promoted `lead`). Publishes Events/Announcements directly (`approved`), approves/rejects Crew drafts, assigns/revokes user roles, edits member photo URLs, deletes users, reviews Join Requests, exports Registration & Check-In CSVs, manages Site Settings, and views Email Delivery Diagnostics (`/debug/emails`). |

### Single-Source Permission Matrix (`src/config/rbacAndData.ts`)
| Permission Key | `lead` | `crew` | `member` | `outsider` |
| :--- | :---: | :---: | :---: | :---: |
| `canAccessCrewDashboard` | Yes | Yes | No | No |
| `canAccessAdminPanel` | Yes | No | No | No |
| `canApproveContent` | Yes | No | No | No |
| `canManageUsers` / `canAssignRoles` / `canDeleteUsers` | Yes | No | No | No |
| `canManageSiteSettings` | Yes | No | No | No |
| `canCreateEvents` / `canCreateAnnouncements` | Yes | Yes | No | No |
| `canPublishEventsDirectly` / `canPublishAnnouncementsDirectly` | Yes | No *(Pending)* | No | No |
| `canEditDeleteAnyEvent` / `canDeleteAnnouncements` | Yes | No | No | No |
| `canUploadGallery` / `canManageResources` / `canUpdateLeaderboard` | Yes | Yes | No | No |
| `canDeleteGallery` | Yes | No | No | No |
| `canViewRegistrations` | Yes | Yes | No | No |
| `canExportRegistrations` | Yes | No | No | No |
| `canRegisterForEvents` | Yes | Yes | Yes | No |
| `canViewFullLeaderboard` / `canViewFullResources` | Yes | Yes | Yes | No *(Preview)* |
| `canEditOwnProfile` | Yes | Yes | Yes | No |
| `canSubmitJoinRequest` | No | No | No | Yes |

---

## 3. Complete Route & Page Inventory

### Public & Dynamic Community Routes
| Route | Page Component | Purpose & Key Functionality |
| :--- | :--- | :--- |
| `/` | `HomePage` | Hero banner, approved campus announcements strip, live `UpcomingEventsTicker`, chapter metrics, `MemberSpotlight` (weekly rotation), top leaderboard preview, and call-to-action flows. |
| `/team` | `TeamPage` | Always-visible public live roster of Campus Lead and Campus Crew members (visible whether signed in or logged out), displaying custom profile image URLs via `MemberAvatar`, designations, bios, and `?q=` search filtering. |
| `/members/:memberId` | `MemberProfileDetailPage` | Shareable, non-PII public member profile page combining `public_profiles`, `team_members`, and `leaderboard` data (rank, score, solved count, DSA/roadmap completion, skills, bio, social links, copy link) with dynamic `og:type="profile"` and `Person` JSON-LD. |
| `/events` | `EventsPage` | Approved events catalog with category/status filters (`All`, `Upcoming`, `Members Only`, `Past`), `?q=` search filter, live per-event countdowns, seat availability, and one-click registration/cancellation. |
| `/events/:eventId` | `EventDetailPage` | Dedicated shareable event detail page with full description, venue/date/host cards, live countdown, seat registration, QR Check-In link, copy-link sharing, and `Event` Schema.org JSON-LD. |
| `/checkin` | `EventCheckInPage` | Event attendance verification via QR link (`?code=`), live device camera `BarcodeDetector` scanning, or manual check-in code entry. |
| `/leaderboard` | `LeaderboardPage` | Sortable campus standings by rank, name, department, year, problems solved, or score; department filter + search; guest Top-N lock notice linking to `/login` and `/join`. |
| `/resources` | `ResourcesPage` | Learning Roadmap across 5 tracks (`DSA`, `Python`, `Java`, `SQL`, `Problem Solving`). Guests see `basic` modules; verified members unlock `full` modules and toggle module completion. |
| `/gallery` | `GalleryPage` | Filterable campus photography gallery (`Hackathon`, `Workshop`, `Awards`, `Community`) with keyboard-navigable lightbox (`Esc`, `←`, `→`) and Crew/Lead photo upload. |
| `/join` | `JoinUsPage` | Prospective student membership intake form (name, register number, department, year, email, phone, skills) writing to `/join_requests` when `applicationsOpen` is enabled. |
| `/contact` | `ContactFaqPage` | General chapter FAQ accordion, **Email Delivery & Whitelisting Guide** (`EmailDeliveryFaq` for Gmail, Outlook, Yahoo, and Campus/College domains), and contact form (`FAQPage` JSON-LD). |

### Authentication & Email Action Routes
| Route | Page Component | Purpose & Key Functionality |
| :--- | :--- | :--- |
| `/login` | `LoginPage` | Email/password login, unverified-user `NotificationBanner` handling, and inline `ForgotPassword` recovery workflow. |
| `/signup` | `SignUpPage` | Student registration with personal email, unique `@paavai.edu.in` college email, unique phone number, register number, department, year, HackerRank handle, and optional profile image URL. |
| `/verified`, `/verify-email` | `EmailVerifiedPage` | Landing confirmation page after completing email verification. |
| `/auth/action` | `EmailActionPage` | Custom Firebase Auth action handler supporting `mode=verifyEmail` and `mode=resetPassword` with password strength checklist and confirmation. |
| `/access-denied` | `AccessDeniedPage` | 403 Permission Required screen displaying requested route, current role, and required role label. |

### Protected Role-Specific Routes
| Route | Page Component | Allowed Roles | Purpose & Key Functionality |
| :--- | :--- | :--- | :--- |
| `/profile` | `ProfilePage` | `member`, `crew`, `lead` *(pending verification sees banner)* | `CommunityEngagementWidget`, `ProfileBadges`, `CodingActivityHeatmap` (GitHub-style grid + activity logger), `SocialConnections`, profile editor (including live `photoUrl` preview), and user's registered events. |
| `/dashboard` | `RoleDashboardRedirect` | `member`, `crew`, `lead` | Automatically redirects to `/dashboard/member`, `/dashboard/crew`, or `/dashboard/lead`. |
| `/dashboard/member` | `MemberDashboardPage` | `member`, `crew`, `lead` | Student personal workspace: stats cards, `DsaProgressBar`, Recharts `MemberActivityChart`, roadmap checklist, registered events, and approved announcements. |
| `/dashboard/crew` | `CrewDashboardPage (mode="crew")` | `crew`, `lead` | Operations console with collapsible sidebar clusters (`Events & Attendance`, `Community & Content`) for drafting events/announcements, generating QR check-in codes, inspecting registrations, and updating gallery/resources/leaderboard. |
| `/dashboard/lead` *(legacy `/admin` redirects here)* | `CrewDashboardPage (mode="lead")` | `lead` only | Full administrative console with collapsible left-hand sidebar clusters (`Community`, `Events & Content`, `Approvals & Settings`), member directory & role management (`MemberDirectoryPanel`), member photo URL editing, pending content approval queue, join request review, registration/check-in CSV exports, site settings, and link to Email Diagnostics. |
| `/debug/emails` | `EmailDebugPage` | `lead` only | Immutable `emailSendAttempts` audit log viewer (filterable by type/status/search), Firebase Console configuration checklist, and copyable branded HTML password-reset template preview. |

---

## 4. Core Functional Workflows

### 4.1 Student Signup, Uniqueness Validation & Immediate Email Verification
1. **Input Validation (`SignUpPage`)**:
   - Validates Full Name, Paavai Register Number (8–16 alphanumeric chars), personal login email, unique `@paavai.edu.in` college email ID, normalized 10–15 digit phone number, optional `photoUrl` (`https://` or `http://`, max 500 chars), and password (min 6 chars).
2. **Pre-Flight SHA-256 Uniqueness Checks (`AppContext.signup`)**:
   - Computes SHA-256 hashes client-side (`unique_emails`, `unique_phones`, `unique_college_emails`) and checks single-doc existence via `getDoc` without exposing any PII lists.
   - Prevents duplicate accounts by personal email, phone number, or college email ID.
3. **Account Creation & Parallel Lock Claiming**:
   - Calls `createUserWithEmailAndPassword(auth, email, password)`.
   - Sets `verificationDispatchState` to `{ status: 'sending', email }` immediately.
   - Claims all three uniqueness lock documents in parallel (`Promise.allSettled`); if any lock fails due to a concurrent race conflict, rolls back created locks and deletes the newly created Auth user cleanly.
4. **Immediate Parallel Verification Email Dispatch**:
   - Calls `sendVerificationWithRedirect(cred.user)` **in parallel** with `updateProfile(...)` and initial Firestore `/users/{uid}` creation (`emailVerified: false`, `role: 'member'`).
   - Attempts `sendEmailVerification(user, { url: '${origin}/verified?verified=true', handleCodeInApp: false })`.
   - If the current hostname is not yet in Firebase **Authorized domains** (`auth/unauthorized-continue-uri`), caches that origin in `unauthorizedContinueOrigins` for the session and immediately falls back to `sendEmailVerification(user)` (default Firebase redirect) so verification emails always deliver.
   - Starts the 60-second resend cooldown timer immediately (`setResendCooldownTimestamp`) and logs every attempt (`sent` / `sent (fallback)` / `failed`) to `emailSendAttempts`.
5. **Live Verification Banner & Activation (`NotificationBanner` & `WelcomeOnboardingHandler`)**:
   - Because `onAuthStateChanged` fires immediately after account creation, unverified sessions transition straight to `NotificationBanner`, which displays real-time dispatch status (`sending...`, `sent automatically at <time>`, or `failed`), a live 60-second cooldown progress bar, an **"I've Verified My Email — Activate Account"** reload check (`refreshEmailVerification`), a **Resend** button, and a **Troubleshoot Email Delivery** modal (`TroubleshootEmailModal`).
   - Once `user.emailVerified === true`, `ensureUserProfile` synchronizes `/users/{uid}`, creates/updates `/public_profiles/{uid}` (and `/team_members/{uid}` if Lead/Crew), and `WelcomeOnboardingHandler` shows a welcome toast and routes the verified user to their role dashboard.
6. **Automatic 12-Hour Cleanup (`functions/src/index.ts`)**:
   - Scheduled Cloud Function `cleanupUnverifiedUsers` runs every 24 hours (`Asia/Kolkata`, `asia-south1`), queries `/users` where `emailVerified == false` and `createdAt <= 12 hours ago`, deletes expired user documents and their SHA-256 uniqueness locks in batches of 400, and removes the corresponding Firebase Auth accounts.

### 4.2 Password Reset & Custom Email Action Handling
- **Forgot Password Flow (`ForgotPassword.tsx`)**:
  - Allows students to request a reset link via `sendPasswordResetEmail`.
  - Handles Firebase action-URL fallback automatically if the origin is not authorized, records the attempt in `emailSendAttempts`, and presents clear inbox/spam/whitelist instructions with a 60-second resend cooldown.
- **Custom Action Landing (`/auth/action` -> `EmailActionPage`)**:
  - Reads `mode` and `oobCode` query parameters from Firebase email links:
    - `mode=verifyEmail`: applies `applyActionCode` and links to `/login` or dashboard.
    - `mode=resetPassword`: verifies `oobCode` via `verifyPasswordResetCode`, presents a two-field password reset UI with live requirement indicators, and confirms via `confirmPasswordReset`.

### 4.3 Events Lifecycle & QR Attendance Check-In
1. **Event Creation & Approval**:
   - **Campus Lead** creates events directly as `status: 'approved'`.
   - **Campus Crew** creates events as `status: 'pending'`; Lead approves or rejects them in the **Pending Content** queue.
2. **Discovery & Countdown**:
   - `UpcomingEventsTicker` on `HomePage` subscribes via `onSnapshot` to approved events, filters future dates, prioritizes upcoming Contests/Workshops, ticks every second, and allows cycling across multiple upcoming events.
   - Clicking an event navigates to `/events/:eventId` (`EventDetailPage`) or `/events`.
3. **Registration**:
   - Verified members (`member`, `crew`, `lead`) register or cancel seats on `/events` or `/events/:eventId`, enforcing capacity checks and duplicate-registration prevention.
4. **QR Check-In (`EventCheckInQRGenerator` & `EventCheckInPage`)**:
   - Crew/Lead select an approved event in the dashboard to generate a unique check-in code (`HRCC-...`) stored in `/event_checkin_codes/{code}` and rendered as a downloadable QR code (`qrcode`) pointing to `${origin}/checkin?code=...`.
   - Crew/Lead can pause (`isActive: false`) or re-activate codes anytime.
   - Attendees scan the QR code (via device camera `BarcodeDetector` on `/checkin` or phone camera URL) or type the code manually; verified users are recorded once per event in `/event_checkins` (with duplicate check-in detection).
   - **Lead** can export both Event Registrations and Event Check-Ins to CSV.

### 4.4 Learning Roadmap, Coding Heatmap & Member Analytics
- **Learning Roadmap (`/resources`)**: Organized across `DSA`, `Python`, `Java`, `SQL`, and `Problem Solving`. Verified members mark modules complete/incomplete, persisted to `/user_progress/{uid}` and reflected in `/public_profiles/{uid}` (`completedDsaCount`, `completedRoadmapCount`).
- **Member Activity Chart (`MemberActivityChart.tsx`)**: Recharts visualization on `MemberDashboardPage` tracking completed DSA/roadmap modules and coding completions over time.
- **Coding Activity Contribution Heatmap (`CodingActivityHeatmap.tsx`)**: GitHub-style 52-week contribution matrix on `ProfilePage` combining logged completions across `HackerRank`, `LeetCode`, `GitHub`, `CodeChef`, `DSA Roadmap`, and `Campus Event` (`/coding_activities`) plus verified event check-ins, with inline activity logging and deletion.
- **Badges & Community Engagement (`ProfileBadges.tsx`, `CommunityEngagementWidget.tsx`)**: Displays join date, events attended, roadmap completion milestones, leaderboard rank, and earned badges.

### 4.5 Public Team Roster, Member Profiles & Profile Image URLs
- **Continuous Team Sync (`AppContext`)**:
  - Whenever a Campus Lead or Campus Crew member updates their profile or is promoted/demoted by the Lead, `/team_members/{uid}` stays synchronized with non-PII fields (`uid`, `name`, `role`, `designation`, `department`, `year`, `bio`, `photoUrl`, `hackerRankHandle`).
  - `/team` (`TeamPage`) is always visible to all visitors—signed in or logged out—and renders every member with `MemberAvatar` (`referrerPolicy="no-referrer"`, error handling, automatic initials fallback).
  - Both members (via `/profile` or signup) and the Campus Lead (via `MemberDirectoryPanel`) can set/update or clear a member's `photoUrl`.

### 4.6 Global Search Bar (`GlobalSearchBar.tsx`)
- Accessible from the top navbar on desktop (`Cmd/Ctrl + K` or `/` shortcut) and via a full-screen search modal on mobile.
- Searches across live RBAC-filtered **Approved Events**, **Visible Roadmap Modules**, and **Community Members** (`team_members`, visible `leaderboard`, `public_profiles`) with scope tabs (`All`, `Events`, `Roadmap`, `Members`) and keyboard arrow/Enter navigation directly to `/events/:eventId`, `/resources?q=...`, or `/members/:memberId`.

### 4.7 SEO & Search Engine Visibility (`index.html` & `PageSeo.tsx`)
- **`index.html`**:
  - Includes Google Search Console verification tag (`<meta name="google-site-verification" content="f3eML_jpUG4BENna7CW8Ir3zytLhErdjsoJu5U51PTA" />`).
  - Pre-configured default `<title>`, `description`, `keywords`, `robots`, `theme-color`, OpenGraph (`og:*`), Twitter Cards (`twitter:*`), and `EducationalOrganization` JSON-LD marked with `data-react-helmet="true"` for clean client-side replacement without duplicate tags.
- **Dynamic Per-Route Metadata (`PageSeo`)**:
  - Uses `react-helmet` on all 20 pages.
  - **Event Pages (`/events/:eventId`)**: Dynamic `<title>`, event venue/date/description meta, banner `og:image`, canonical URL, and Schema.org `Event` JSON-LD.
  - **Public Member Profiles (`/members/:memberId`)**: Dynamic `<title>`, department/skills/bio meta, `og:type="profile"`, member photo `og:image`, canonical URL, and Schema.org `Person` JSON-LD.
  - **Listing & Info Pages (`/`, `/events`, `/team`, `/contact`)**: Dynamic `EducationalOrganization`, `ItemList`, and `FAQPage` Schema.org JSON-LD.
  - **Private/Auth/Admin Routes (`/login`, `/signup`, `/profile`, `/dashboard/*`, `/debug/emails`, `/auth/action`, `/access-denied`)**: Automatically tagged `noindex, nofollow` so crawlers focus on public community pages.

---

## 5. Firestore Database Schema & Security Rules Summary

Database ID: `ai-studio-hackerrankcampus-521e66b2-ef2a-4b15-a7c4-9be9472b4dbc`

| Collection Path | Purpose | Read Access | Write / Delete Access |
| :--- | :--- | :--- | :--- |
| `/users/{userId}` | Full member profile & RBAC role | Owner (`signedIn`) or Campus Lead | Self-create on signup; Owner profile fields update; Lead role/profile update & user delete |
| `/team_members/{memberId}` | Non-PII public Lead & Crew roster | **Public** (`get` & `list`) | Lead or Owner (Crew/Lead); Lead delete |
| `/public_profiles/{userId}` | Non-PII public portfolio & roadmap counts | **Public** (`get` & `list`) | Owner (`signedIn`); Owner or Lead delete |
| `/events/{eventId}` | Campus contests, workshops, hackathons | Public if `approved`; Crew/Lead see all | Lead creates directly & updates/deletes; Crew creates `pending` only |
| `/announcements/{announcementId}` | Campus announcement strip items | Public if `approved`; Crew/Lead see all | Lead creates/updates/deletes; Crew creates `pending` only |
| `/leaderboard/{entryId}` | Ranked coder scores & solved counts | **Public** (`get` & `list`) | Crew & Lead |
| `/resources/{resourceId}` | Learning roadmap track modules | `basic` public; `full` requires `signedIn` | Crew & Lead |
| `/gallery/{photoId}` | Event gallery photography | **Public** (`get` & `list`) | Crew/Lead create; Lead update/delete |
| `/registrations/{registrationId}` | Student event seat reservations | Owner (`signedIn`), Crew, or Lead | Verified `signedIn` owner create (on approved event); Owner or Lead delete |
| `/join_requests/{requestId}` | Prospective member applications | Campus Lead only | Public create (`status: 'pending'`); Lead approve/reject/delete |
| `/site_settings/{settingId}` | Global chapter config & Guest limit | **Public** (`get` & `list`) | Campus Lead create/update (`delete: false`) |
| `/user_progress/{userId}` | Per-user completed roadmap IDs | Owner (`signedIn`) only | Owner (`signedIn`) only |
| `/coding_activities/{activityId}` | User coding completions for heatmap | Owner (`signedIn`) or Campus Lead | Owner (`signedIn`) create; Owner or Lead delete (`update: false`) |
| `/event_checkin_codes/{code}` | Event QR check-in session codes | Public single-doc `get`; Crew/Lead `list` | Crew/Lead create & toggle `isActive`; Lead delete |
| `/event_checkins/{checkInId}` | Scanned QR attendance records | Owner (`signedIn`), Crew, or Lead | Verified `signedIn` owner create when code is active (`update: false`); Lead delete |
| `/emailSendAttempts/{attemptId}` | Email verification & reset audit logs | Campus Lead only | `password_reset` or authenticated session create (`update: false`); Lead delete |
| `/unique_emails/{sha256}` | Email uniqueness lock (no PII) | Single-doc `get` (`list: false`) | Authenticated owner or Lead create/delete (`update: false`) |
| `/unique_phones/{sha256}` | Phone uniqueness lock (no PII) | Single-doc `get` (`list: false`) | Authenticated owner or Lead create/delete (`update: false`) |
| `/unique_college_emails/{sha256}` | `@paavai.edu.in` lock (no PII) | Single-doc `get` (`list: false`) | Authenticated owner or Lead create/delete (`update: false`) |

---

## 6. Component & Module Architecture

### Context & Configuration
- `src/context/AppContext.tsx`: Central state provider managing Firebase Auth session, role resolution, all real-time Firestore `onSnapshot` listeners, RBAC permission helper `can()`, signup/verification dispatch state, uniqueness locks, CRUD mutations, CSV exporters, theme state, and toast notifications.
- `src/lib/firebase.ts`: Firebase app initialization targeting database `ai-studio-hackerrankcampus-521e66b2-ef2a-4b15-a7c4-9be9472b4dbc`, bootstrapped Campus Lead check (`paavaihackerrank@gmail.com`), and structured `handleFirestoreError` logging.
- `src/config/rbacAndData.ts`: Single-source `ROLE_PERMISSIONS` map, TypeScript interfaces, department/academic year constants, FAQ items, and static image paths.

### UI & Feature Components (`src/components/`)
- **Navigation & Layout**: `Layout.tsx`, `Footer.tsx`, `GlobalSearchBar.tsx`, `ProtectedRoute.tsx`, `ErrorBoundary.tsx`
- **SEO & Media**: `PageSeo.tsx`, `MemberAvatar.tsx`, `SafeImage.tsx`
- **Home & Discovery**: `UpcomingEventsTicker.tsx`, `MemberSpotlight.tsx`
- **Auth & Email Support**: `NotificationBanner.tsx`, `TroubleshootEmailModal.tsx`, `ForgotPassword.tsx`, `WelcomeOnboardingHandler.tsx`, `EmailDeliveryFaq.tsx`
- **Member Progress & Analytics**: `MemberActivityChart.tsx`, `DsaProgressBar.tsx`, `CodingActivityHeatmap.tsx`, `CommunityEngagementWidget.tsx`, `ProfileBadges.tsx`, `SocialConnections.tsx`
- **Events & Attendance**: `EventCheckInQRGenerator.tsx`

---

## 7. Build, Deployment & Operational Notes

### Scripts (`package.json`)
- `npm run dev` — Starts Vite dev server on port `3000` (`--host=0.0.0.0`).
- `npm run build` — Builds production bundle into `dist/` (Vite copies `src/assets` into `dist/src/assets` via `copy-unbundled-src-assets` plugin).
- `npm run lint` — Runs `tsc --noEmit` strict TypeScript validation.

### Firebase Console Configuration Checklist
1. **Authorized Domains** (**Authentication → Settings → Authorized domains**): Add all production and preview domains (e.g., `paavai-hackerrank.netlify.app` and AI Studio `*.run.app` origins) so custom `continueUrl` redirects on verification and password-reset emails work without triggering fallback mode.
2. **Custom Action URL** (**Authentication → Templates**): Point verification and password reset action URLs to `https://<your-domain>/auth/action` to use the branded in-app handler (`EmailActionPage`).
3. **Cloud Functions**: Deploy `functions/src/index.ts` (`cleanupUnverifiedUsers`) to automatically purge unverified signups older than 12 hours.
4. **Firestore Rules**: Deploy `firestore.rules` (validated with `@firebase/eslint-plugin-security-rules`) whenever schema or access policies change.
