import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getDashboardPath } from './config/rbacAndData';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { TeamPage } from './pages/TeamPage';
import { EventsPage } from './pages/EventsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { GalleryPage } from './pages/GalleryPage';
import { JoinUsPage } from './pages/JoinUsPage';
import { CrewDashboardPage } from './pages/CrewDashboardPage';
import { MemberDashboardPage } from './pages/MemberDashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { ContactFaqPage } from './pages/ContactFaqPage';
import { LoginPage, SignUpPage } from './pages/AuthPages';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { EmailVerifiedPage } from './pages/EmailVerifiedPage';
import { WelcomeOnboardingHandler } from './components/WelcomeOnboardingHandler';

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
            <Routes>
              {/* Public Pages */}
              <Route path="/" element={<HomePage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/events" element={<EventsPage />} />
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
          </Layout>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
