import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, CalendarCheck, QrCode, Users } from 'lucide-react';
import {
  CodingActivity,
  EventCheckIn,
  EventRegistration,
  LeaderboardEntry,
  LearningResource,
  UserAccount,
} from '../config/rbacAndData';
import { computeUserBadgeSummary } from './ProfileBadges';

interface CommunityEngagementWidgetProps {
  user: UserAccount;
  resources: LearningResource[];
  completedResourceIds: string[];
  leaderboard: LeaderboardEntry[];
  eventCheckIns: EventCheckIn[];
  registrations: EventRegistration[];
  codingActivities: CodingActivity[];
}

function formatJoinDate(rawDate?: string): { formatted: string; tenureLabel: string } {
  const source = (rawDate || '').trim();
  const parsed = source ? new Date(source.length === 10 ? `${source}T00:00:00` : source) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return { formatted: source || 'Active Member', tenureLabel: 'Paavai Chapter' };
  }

  const formatted = parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const diffDays = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
  const tenureLabel =
    diffDays === 0
      ? 'Joined today'
      : diffDays === 1
        ? '1 day active'
        : diffDays < 30
          ? `${diffDays} days active`
          : `${Math.floor(diffDays / 30)} mo active`;

  return { formatted, tenureLabel };
}

export const CommunityEngagementWidget: React.FC<CommunityEngagementWidgetProps> = ({
  user,
  resources,
  completedResourceIds,
  leaderboard,
  eventCheckIns,
  registrations,
  codingActivities,
}) => {
  const badgeSummary = useMemo(
    () => computeUserBadgeSummary(user, resources, completedResourceIds, leaderboard),
    [user, resources, completedResourceIds, leaderboard]
  );

  const { formatted: joinDateFormatted, tenureLabel } = useMemo(
    () => formatJoinDate(user.joinedAt || user.createdAt),
    [user.joinedAt, user.createdAt]
  );

  const { totalEventsAttended, myRegistrationsCount } = useMemo(() => {
    const myCheckIns = eventCheckIns.filter((c) => c.userId === user.id);
    const uniqueCheckedInEvents = new Set(myCheckIns.map((c) => c.eventId || c.checkInCode));
    const loggedCampusEvents = codingActivities
      .filter((a) => a.userId === user.id && a.platform === 'Campus Event')
      .reduce((sum, a) => sum + Math.max(0, a.count), 0);
    const myRegs = registrations.filter((r) => r.userId === user.id).length;

    return {
      totalEventsAttended: uniqueCheckedInEvents.size + loggedCampusEvents,
      myRegistrationsCount: myRegs,
    };
  }, [eventCheckIns, registrations, codingActivities, user.id]);

  return (
    <section
      aria-labelledby="community-engagement-heading"
      className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users
              className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
              aria-hidden="true"
            />
            <h2
              id="community-engagement-heading"
              className="font-mono text-lg font-bold text-slate-900 dark:text-white"
            >
              Community Engagement
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chapter tenure, verified QR event attendance, and badge progression across HackerRank
            Campus Crew.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/checkin"
            className="px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <QrCode className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Event Check-In</span>
          </Link>
          <Link
            to="/events"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Browse Events</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* 3-Column Metrics Grid (Clean Hairline Dividers, Zero Nested Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Metric 1: Join Date */}
        <div className="py-3 sm:py-0 sm:pr-6 space-y-1.5">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Member Join Date
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {joinDateFormatted}
          </p>
          <p className="text-xs font-mono text-[#009942] dark:text-[#00EA64] tabular-nums">
            {tenureLabel} · {user.department}
          </p>
        </div>

        {/* Metric 2: Total Events Attended */}
        <div className="py-3 sm:py-0 sm:px-6 space-y-1.5">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Total Events Attended</span>
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {totalEventsAttended}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {myRegistrationsCount} registered seat{myRegistrationsCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* Metric 3: Current Badge Rank */}
        <div className="py-3 sm:py-0 sm:pl-6 space-y-1.5">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Current Badge Rank</span>
          </p>
          <p className="font-mono text-2xl font-bold text-[#009942] dark:text-[#00EA64]">
            {badgeSummary.badgeRankTitle}
          </p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {badgeSummary.earnedCount} / {badgeSummary.totalBadges} badges earned
            {badgeSummary.leaderboardRank !== null
              ? ` · Leaderboard #${badgeSummary.leaderboardRank}`
              : ''}
          </p>
        </div>
      </div>

      {/* Rank Progression Bar */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <span className="text-slate-600 dark:text-slate-300">{badgeSummary.nextRankHint}</span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
            {badgeSummary.nextRankTitle
              ? `Next: ${badgeSummary.nextRankTitle} (${badgeSummary.nextRankProgressPct}%)`
              : 'Top Badge Rank Reached'}
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={badgeSummary.nextRankProgressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress toward next badge rank"
        >
          <div
            className="h-full bg-[#00EA64] transition-all duration-300"
            style={{ width: `${Math.max(4, badgeSummary.nextRankProgressPct)}%` }}
          />
        </div>
      </div>
    </section>
  );
};
