import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PermissionKey } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredPermission?: PermissionKey;
  requiredRoleLabel?: string;
  allowPendingVerification?: boolean;
}

/**
 * Route-level RBAC protection guard.
 * Waits for Firebase Auth readiness before redirecting unauthorized visitors to `/access-denied`.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requiredPermission,
  requiredRoleLabel,
  allowPendingVerification = false,
}) => {
  const { authReady, currentUser, needsEmailVerification, can } = useApp();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 text-center">
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
          Verifying session...
        </p>
      </div>
    );
  }

  if (allowPendingVerification && needsEmailVerification) {
    return <>{children}</>;
  }

  if (requireAuth && !currentUser) {
    return (
      <Navigate
        to="/access-denied"
        replace
        state={{
          from: location.pathname,
          reason:
            'This page requires a verified @paavai.edu.in HackerRank Campus Crew account.',
          requiredRoleLabel: requiredRoleLabel || 'Logged-in Member',
        }}
      />
    );
  }

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <Navigate
        to="/access-denied"
        replace
        state={{
          from: location.pathname,
          reason: 'Your current role does not have permission to access this workspace.',
          requiredRoleLabel: requiredRoleLabel || 'Authorized Staff',
        }}
      />
    );
  }

  return <>{children}</>;
};
