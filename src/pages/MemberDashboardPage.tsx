import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Megaphone,
  Trophy,
  User as UserIcon,
} from 'lucide-react';
import { ROLE_META } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { DsaProgressBar } from '../components/DsaProgressBar';

export const MemberDashboardPage: React.FC = () => {
  const {
    currentUser,
    events,
    announcements,
    resources,
    registrations,
    completedResourceIds,
    toggleResourceCompleted,
    cancelRegistration,
  } = useApp();

  if (!currentUser) return null;

  const myRegistrations = registrations.filter((r) => r.userId === currentUser.id);
  const approvedAnnouncements = announcements.filter((a) => a.status === 'approved');
  const upcomingEvents = events
    .filter((e) => e.status === 'approved' && new Date(e.dateISO).getTime() > Date.now())
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

  const totalModules = resources.length;
  const completedCount = completedResourceIds.filter((id) =>
    resources.some((r) => r.id === id)
  ).length;
  const completionPct =
    totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            {ROLE_META[currentUser.role].label} · Verified @paavai.edu.in
          </p>
          <h1 className="font-mono text-3xl font-bold text-slate-900 dark:text-white">
            Welcome, {currentUser.name}
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {currentUser.email} · Reg No. {currentUser.regNo} · {currentUser.department} (
            {currentUser.year})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/events"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5"
          >
            <span>Browse Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/profile"
            className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </Link>
        </div>
      </header>

      {/* Summary Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-1">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
            <span>Registered Events</span>
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {myRegistrations.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {upcomingEvents.length} upcoming campus events open
          </p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-1">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
            <span>Roadmap Progress</span>
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {completionPct}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {completedCount} of {totalModules} modules completed
          </p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-1">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
            <span>HackerRank Handle</span>
          </p>
          <p className="font-mono text-xl font-bold text-slate-900 dark:text-white truncate">
            {currentUser.hackerRankHandle || '@paavai_coder'}
          </p>
          <Link
            to="/leaderboard"
            className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline inline-block"
          >
            View full leaderboard →
          </Link>
        </div>
      </section>

      {/* DSA Roadmap Completion Progress */}
      <DsaProgressBar
        resources={resources}
        completedResourceIds={completedResourceIds}
        onToggleCompleted={toggleResourceCompleted}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* My Registrations */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              My Registered Events ({myRegistrations.length})
            </h2>
            <Link
              to="/events"
              className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
            >
              All events →
            </Link>
          </div>

          {myRegistrations.length === 0 ? (
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <p>You have not registered for any upcoming contests or workshops yet.</p>
              <Link
                to="/events"
                className="inline-block px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14]"
              >
                Explore Events
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myRegistrations.map((reg) => {
                const ev = events.find((e) => e.id === reg.eventId);
                return (
                  <div
                    key={reg.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1 text-xs font-mono text-[#009942] dark:text-[#00EA64]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Seat Confirmed</span>
                      </p>
                      <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {ev?.title ?? reg.eventId}
                      </h3>
                      {ev && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(ev.dateISO).toLocaleDateString('en-IN')} · {ev.venue}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelRegistration(reg.eventId)}
                      className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 self-start sm:self-center shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Campus Announcements & Quick Access */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" />
              <span>Campus Announcements</span>
            </h2>
            <Link
              to="/resources"
              className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
            >
              Roadmap →
            </Link>
          </div>

          {approvedAnnouncements.length === 0 ? (
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-xs text-slate-500 dark:text-slate-400">
              No campus announcements published yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              {approvedAnnouncements.slice(0, 4).map((ann) => (
                <div key={ann.id} className="p-4 space-y-1">
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {ann.date} · {ann.priority}
                  </p>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {ann.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ann.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
