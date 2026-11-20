import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Calendar, CheckCircle2 } from 'lucide-react';
import { ROLE_META, getDashboardPath } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

export const EmailVerifiedPage: React.FC = () => {
  const { currentUser, currentRole, firebaseUser } = useApp();

  const isSignedInVerified = Boolean(
    currentUser || (firebaseUser?.emailVerified && currentRole !== 'outsider')
  );
  const dashboardPath =
    currentRole !== 'outsider' ? getDashboardPath(currentRole) : '/login';

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
      <div className="p-7 sm:p-9 rounded-2xl border border-[#00EA64]/40 bg-white dark:bg-[#121821] space-y-6">
        <div className="w-12 h-12 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/40 flex items-center justify-center text-[#009942] dark:text-[#00EA64]">
          <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[#009942] dark:text-[#00EA64]">
            Verification Complete · HRCC Paavai
          </p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Welcome to HackerRank Campus Crew!
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentUser ? (
              <>
                Your account (<strong>{currentUser.email}</strong>) is verified and active as{' '}
                <strong>{ROLE_META[currentUser.role].label}</strong>.
              </>
            ) : (
              <>
                Your email verification is confirmed. Sign in with your{' '}
                <strong>registered personal email &amp; password</strong> to open your member
                dashboard and start practicing.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            to={isSignedInVerified ? dashboardPath : '/login'}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-2"
          >
            <span>
              {isSignedInVerified ? 'Go to My Dashboard' : 'Sign In to Continue'}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>

          <Link
            to="/resources"
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Learning Roadmap</span>
          </Link>

          <Link
            to="/events"
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span>Browse Events</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
