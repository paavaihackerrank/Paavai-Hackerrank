import React, { useMemo } from 'react';
import { QrCode, UserCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface MemberCheckInSummaryWidgetProps {
  isLead?: boolean;
  onOpenCheckIns?: () => void;
  onOpenMembers?: () => void;
}

export const MemberCheckInSummaryWidget: React.FC<MemberCheckInSummaryWidgetProps> = ({
  isLead = false,
  onOpenCheckIns,
  onOpenMembers,
}) => {
  const { users, publicProfiles, teamMembers, registrations, eventCheckIns } = useApp();

  const stats = useMemo(() => {
    // Track distinct events attended per unique userId from live /event_checkins
    const eventsByCheckedInUser = new Map<string, Set<string>>();
    eventCheckIns.forEach((chk) => {
      const uid = chk.userId?.trim();
      if (!uid) return;
      if (!eventsByCheckedInUser.has(uid)) {
        eventsByCheckedInUser.set(uid, new Set<string>());
      }
      if (chk.eventId) {
        eventsByCheckedInUser.get(uid)!.add(chk.eventId);
      }
    });

    const checkedInMemberCount = eventsByCheckedInUser.size;
    let repeatAttendeesCount = 0;
    eventsByCheckedInUser.forEach((evSet) => {
      if (evSet.size >= 2) repeatAttendeesCount += 1;
    });

    // Build authoritative unique registered member set:
    // - Campus Lead reads the full /users directory directly.
    // - Campus Crew (isolated from /users PII by Firestore rules) aggregates unique UIDs
    //   across non-PII /public_profiles, /team_members, /registrations, and /event_checkins.
    const registeredIds = new Set<string>();
    const usingFullDirectory = users.length > 0;

    if (usingFullDirectory) {
      users.forEach((u) => {
        if (u.id) registeredIds.add(u.id);
      });
    } else {
      publicProfiles.forEach((p) => {
        if (p.uid) registeredIds.add(p.uid);
      });
      teamMembers.forEach((tm) => {
        if (tm.uid) registeredIds.add(tm.uid);
      });
      registrations.forEach((r) => {
        if (r.userId) registeredIds.add(r.userId);
      });
    }

    // Guarantee mathematical consistency: every checked-in user counts toward registered members
    eventsByCheckedInUser.forEach((_events, uid) => {
      registeredIds.add(uid);
    });

    const uniqueRsvpIds = new Set<string>();
    registrations.forEach((r) => {
      if (r.userId) uniqueRsvpIds.add(r.userId);
    });

    const totalRegistered = registeredIds.size;
    const notCheckedInCount = Math.max(0, totalRegistered - checkedInMemberCount);
    const participationRate =
      totalRegistered > 0
        ? Math.min(100, Math.round((checkedInMemberCount / totalRegistered) * 100))
        : 0;

    return {
      totalRegistered,
      checkedInMemberCount,
      notCheckedInCount,
      participationRate,
      repeatAttendeesCount,
      uniqueRsvpCount: uniqueRsvpIds.size,
      totalCheckIns: eventCheckIns.length,
      usingFullDirectory,
    };
  }, [users, publicProfiles, teamMembers, registrations, eventCheckIns]);

  return (
    <section
      aria-label="Registered members versus checked-in attendees summary"
      className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-5 sm:p-6 flex flex-col justify-between gap-5"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck
              className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
              aria-hidden="true"
            />
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white truncate">
              Member Event Activation
            </h2>
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-[#009942] dark:text-[#00EA64] shrink-0">
            {stats.participationRate}% Active
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Total registered members compared against those who have checked into at least one campus
          event.
        </p>
      </div>

      {/* Primary KPI Comparison Split */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 py-1">
        <div className="pr-4">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Registered Members
          </p>
          <p className="mt-1.5 font-mono text-3xl sm:text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.totalRegistered.toLocaleString()}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {stats.usingFullDirectory ? 'Verified portal accounts' : 'Active chapter profiles'}
          </p>
        </div>

        <div className="pl-4 sm:pl-6">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Checked In (1+ Events)
          </p>
          <p className="mt-1.5 font-mono text-3xl sm:text-4xl font-bold tabular-nums text-[#009942] dark:text-[#00EA64]">
            {stats.checkedInMemberCount.toLocaleString()}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.notCheckedInCount.toLocaleString()} awaiting first scan
          </p>
        </div>
      </div>

      {/* Proportional Coverage Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
          <span className="text-slate-500 dark:text-slate-400">Check-In Coverage</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {stats.checkedInMemberCount.toLocaleString()} / {stats.totalRegistered.toLocaleString()}
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Percentage of registered members checked into at least one event"
          aria-valuenow={stats.participationRate}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
        >
          <div
            className="h-full bg-[#00EA64] transition-all duration-300"
            style={{ width: `${stats.participationRate}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[#00EA64]" aria-hidden="true" />
            <span>Checked In ({stats.checkedInMemberCount.toLocaleString()})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
            <span>No Check-In Yet ({stats.notCheckedInCount.toLocaleString()})</span>
          </span>
        </div>
      </div>

      {/* Secondary Breakdown & Quick Actions Footer */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-3 gap-3 font-mono tabular-nums">
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">RSVPed Users</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
              {stats.uniqueRsvpCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Repeat (2+)</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
              {stats.repeatAttendeesCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Scans</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
              {stats.totalCheckIns.toLocaleString()}
            </p>
          </div>
        </div>

        {(onOpenCheckIns || (isLead && onOpenMembers)) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            {onOpenCheckIns && (
              <button
                type="button"
                onClick={onOpenCheckIns}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                <span>QR Check-Ins</span>
              </button>
            )}
            {isLead && onOpenMembers && (
              <button
                type="button"
                onClick={onOpenMembers}
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Member Directory</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default MemberCheckInSummaryWidget;
