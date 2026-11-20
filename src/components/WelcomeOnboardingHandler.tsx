import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import { ROLE_META, UserRole, getDashboardPath } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

interface WelcomeModalState {
  open: boolean;
  error?: string;
  redirectPath?: string;
  role?: Exclude<UserRole, 'outsider'>;
}

/**
 * Global query-param & dedicated-route verification handler.
 * Detects Firebase email verification redirects (`?mode=verifyEmail&oobCode=...`,
 * `?verified=true`, `?verified=1`, or `/verified` / `/verify-email`), syncs the
 * user's verification state, triggers a Welcome toast notification, and renders
 * an onboarding Welcome modal.
 */
export const WelcomeOnboardingHandler: React.FC = () => {
  const {
    authReady,
    currentUser,
    currentRole,
    firebaseUser,
    addToast,
    verifyActionCode,
    syncVerificationAfterRedirect,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [modal, setModal] = useState<WelcomeModalState>({ open: false });
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authReady) return;

    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    const verifiedParam = params.get('verified');
    const isVerifiedRoute =
      location.pathname === '/verified' || location.pathname === '/verify-email';
    const hasVerifiedParam = verifiedParam === 'true' || verifiedParam === '1';
    const hasActionCode = mode === 'verifyEmail' && Boolean(oobCode);

    if (!hasActionCode && !hasVerifiedParam && !isVerifiedRoute) {
      return;
    }

    const dedupeKey = `${location.pathname}|${location.search}`;
    if (handledKeyRef.current === dedupeKey) return;
    handledKeyRef.current = dedupeKey;

    let cancelled = false;

    (async () => {
      if (hasActionCode && oobCode) {
        const res = await verifyActionCode(oobCode);
        if (cancelled) return;

        if (!res.ok) {
          addToast(
            'Verification link issue',
            res.error || 'Could not verify your email link.',
            'error'
          );
          setModal({
            open: true,
            error: res.error || 'Could not verify your email link.',
          });
          return;
        }

        addToast(
          'Welcome to HackerRank Campus Crew!',
          'Your @paavai.edu.in email is verified and your account is now active.',
          'success'
        );
        setModal({
          open: true,
          role: res.role,
          redirectPath: res.redirectPath,
        });

        if (!isVerifiedRoute) {
          params.delete('mode');
          params.delete('oobCode');
          params.delete('apiKey');
          params.delete('lang');
          const nextSearch = params.toString();
          navigate(
            `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
            { replace: true }
          );
        }
        return;
      }

      const syncRes = await syncVerificationAfterRedirect();
      if (cancelled) return;

      if (firebaseUser && !syncRes.verified) {
        addToast(
          'Email verification still pending',
          'Please click the verification link in your @paavai.edu.in inbox first.',
          'info'
        );
        return;
      }

      addToast(
        'Welcome to HackerRank Campus Crew!',
        'Your email is verified and your Paavai chapter account is active.',
        'success'
      );
      setModal({
        open: true,
        role: syncRes.role,
        redirectPath: syncRes.redirectPath,
      });

      if (hasVerifiedParam && !isVerifiedRoute) {
        params.delete('verified');
        const nextSearch = params.toString();
        navigate(
          `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
          { replace: true }
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    location.pathname,
    location.search,
    firebaseUser,
    addToast,
    verifyActionCode,
    syncVerificationAfterRedirect,
    navigate,
  ]);

  if (!modal.open) return null;

  const resolvedRole = modal.role || (currentRole !== 'outsider' ? currentRole : undefined);
  const dashboardPath =
    modal.redirectPath || (resolvedRole ? getDashboardPath(resolvedRole) : '/login');
  const displayName =
    currentUser?.name || firebaseUser?.displayName || 'Paavai Coder';
  const isSignedInVerified = Boolean(currentUser || (firebaseUser?.emailVerified && resolvedRole));

  const closeAndGo = (path: string) => {
    setModal({ open: false });
    navigate(path);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-verified-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#00EA64]/40 bg-white dark:bg-[#121821] shadow-2xl p-6 sm:p-7 space-y-5">
        <button
          type="button"
          onClick={() => setModal({ open: false })}
          aria-label="Close welcome dialog"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {modal.error ? (
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-red-500">
                Verification Link Error
              </p>
              <h2
                id="welcome-verified-title"
                className="font-mono text-xl font-bold text-slate-900 dark:text-white"
              >
                Unable to Verify Link
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {modal.error}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => closeAndGo('/login')}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors"
              >
                Go to Sign In
              </button>
              <button
                type="button"
                onClick={() => setModal({ open: false })}
                className="py-2.5 px-4 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/40 flex items-center justify-center text-[#009942] dark:text-[#00EA64] shrink-0">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[#009942] dark:text-[#00EA64]">
                  Email Verified · Account Active
                </p>
                <h2
                  id="welcome-verified-title"
                  className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
                >
                  Welcome, {displayName}!
                </h2>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Your <strong>@paavai.edu.in</strong> email has been verified. You now have full
              access to the HackerRank Campus Crew portal at Paavai Engineering College
              {resolvedRole ? ` as a ${ROLE_META[resolvedRole].label}` : ''}.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-mono font-semibold text-slate-900 dark:text-white">
                Unlocked for you:
              </p>
              <p>• Full DSA, Python, Java &amp; SQL learning roadmaps</p>
              <p>• One-click registration for Paavai coding contests &amp; workshops</p>
              <p>• Complete campus leaderboard standings</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => closeAndGo(isSignedInVerified ? dashboardPath : '/login')}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center justify-center gap-2"
              >
                <span>
                  {isSignedInVerified ? 'Open My Dashboard' : 'Sign In to Open Dashboard'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => closeAndGo('/events')}
                className="py-2.5 px-4 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors"
              >
                Explore Events
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
