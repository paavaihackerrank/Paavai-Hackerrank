import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getDashboardPath } from './config/rbacAndData';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { WelcomeOnboardingHandler } from './components/WelcomeOnboardingHandler';
import { HomePage } from './pages/HomePage';

// Route-level code splitting for faster initial load & smaller main bundle
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const EventsPage = lazy(() =>
  import('./pages/EventsPage').then((m) => ({ default: m.EventsPage }))
);
const EventDetailPage = lazy(() =>
  import('./pages/EventDetailPage').then((m) => ({ default: m.EventDetailPage }))
);
const EventCheckInPage = lazy(() =>
  import('./pages/EventCheckInPage').then((m) => ({ default: m.EventCheckInPage }))
);
const CertificateVerifyPage = lazy(() =>
  import('./pages/CertificateVerifyPage').then((m) => ({ default: m.CertificateVerifyPage }))
);
const LeaderboardPage = lazy(() =>
  import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage }))
);
const ResourcesPage = lazy(() =>
  import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage }))
);
const GalleryPage = lazy(() =>
  import('./pages/GalleryPage').then((m) => ({ default: m.GalleryPage }))
);
const JoinUsPage = lazy(() =>
  import('./pages/JoinUsPage').then((m) => ({ default: m.JoinUsPage }))
);
const ContactFaqPage = lazy(() =>
  import('./pages/ContactFaqPage').then((m) => ({ default: m.ContactFaqPage }))
);
const MemberProfileDetailPage = lazy(() =>
  import('./pages/MemberProfileDetailPage').then((m) => ({ default: m.MemberProfileDetailPage }))
);
const LoginPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.SignUpPage })));
const AccessDeniedPage = lazy(() =>
  import('./pages/AccessDeniedPage').then((m) => ({ default: m.AccessDeniedPage }))
);
const EmailVerifiedPage = lazy(() =>
  import('./pages/EmailVerifiedPage').then((m) => ({ default: m.EmailVerifiedPage }))
);
const EmailActionPage = lazy(() =>
  import('./pages/EmailActionPage').then((m) => ({ default: m.EmailActionPage }))
);
const EmailDebugPage = lazy(() =>
  import('./pages/EmailDebugPage').then((m) => ({ default: m.EmailDebugPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const MemberDashboardPage = lazy(() =>
  import('./pages/MemberDashboardPage').then((m) => ({ default: m.MemberDashboardPage }))
);
const CrewDashboardPage = lazy(() =>
  import('./pages/CrewDashboardPage').then((m) => ({ default: m.CrewDashboardPage }))
);

const RouteLoadingFallback: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
    <div
      className="w-7 h-7 border-2 border-[#00EA64] border-t-transparent rounded-full animate-spin"
      aria-hidden="true"
    />
    <p className="font-mono text-xs">Loading section...</p>
  </div>
);

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const RoleDashboardRedirect: React.FC = () => {
  const { authReady, currentUser, currentRole } = useApp();
  if (!authReady) return null;
  if (!currentUser || currentRole === 'outsider') {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDashboardPath(currentRole)} replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <ScrollToTop />
          <WelcomeOnboardingHandler />
          <Layout>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* Public Pages */}
                <Route path="/" element={<HomePage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/members/:memberId" element={<MemberProfileDetailPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:eventId" element={<EventDetailPage />} />
                <Route path="/checkin" element={<EventCheckInPage />} />
                <Route path="/certificates" element={<CertificateVerifyPage />} />
                <Route path="/certificates/:certId" element={<CertificateVerifyPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/resources" element={<ResourcesPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/join" element={<JoinUsPage />} />
                <Route path="/contact" element={<ContactFaqPage />} />

                {/* Authentication & Access Denied */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/verified" element={<EmailVerifiedPage />} />
                <Route path="/verify-email" element={<EmailVerifiedPage />} />
                <Route path="/auth/action" element={<EmailActionPage />} />
                <Route path="/access-denied" element={<AccessDeniedPage />} />

                {/* Protected: All Verified Logged-In Roles (pending users see verification banner) */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute
                      requireAuth
                      allowPendingVerification
                      requiredPermission="canEditOwnProfile"
                      requiredRoleLabel="Student Community Member, Campus Crew, or Campus Lead"
                    >
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* Role-Specific Dashboards */}
                <Route path="/dashboard" element={<RoleDashboardRedirect />} />

                <Route
                  path="/dashboard/member"
                  element={
                    <ProtectedRoute
                      requireAuth
                      requiredPermission="canEditOwnProfile"
                      requiredRoleLabel="Student Community Member"
                    >
                      <MemberDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/crew"
                  element={
                    <ProtectedRoute
                      requireAuth
                      requiredPermission="canAccessCrewDashboard"
                      requiredRoleLabel="Campus Crew Member or Campus Lead"
                    >
                      <CrewDashboardPage key="crew" mode="crew" />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/lead"
                  element={
                    <ProtectedRoute
                      requireAuth
                      requiredPermission="canAccessAdminPanel"
                      requiredRoleLabel="Campus Lead (Administrator)"
                    >
                      <CrewDashboardPage key="lead" mode="lead" />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/debug/emails"
                  element={
                    <ProtectedRoute
                      requireAuth
                      requiredPermission="canAccessAdminPanel"
                      requiredRoleLabel="Campus Lead (Administrator)"
                    >
                      <EmailDebugPage />
                    </ProtectedRoute>
                  }
                />

                {/* Legacy /admin redirects cleanly to Lead Dashboard */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute
                      requireAuth
                      requiredPermission="canAccessAdminPanel"
                      requiredRoleLabel="Campus Lead (Administrator)"
                    >
                      <Navigate to="/dashboard/lead" replace />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
