import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Code2,
  ExternalLink,
  Github,
  Linkedin,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MemberAvatar } from './MemberAvatar';

interface SpotlightCandidate {
  key: string;
  profileId: string;
  name: string;
  department: string;
  year: string;
  bio: string;
  photoUrl?: string;
  designation?: string;
  hackerRankHandle?: string;
  hackerRankUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  rank?: number;
  score?: number;
  problemsSolved?: number;
  completedDsaCount?: number;
  completedRoadmapCount?: number;
  skills: string[];
}

const normalize = (v?: string) => (v || '').trim().toLowerCase().replace(/^@/, '');

/**
 * Returns a deterministic monotonically increasing Monday-aligned ISO week index.
 * Advances every Monday 00:00 UTC so the featured member automatically rotates weekly.
 */
function getIsoWeekIndex(now = new Date()): number {
  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (utcDay + 6) % 7;
  const mondayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday
  );
  // Reference Monday: 2024-01-01T00:00:00Z
  const epochMonday = Date.UTC(2024, 0, 1);
  return Math.max(0, Math.floor((mondayUtc - epochMonday) / (7 * 86_400_000)));
}

/**
 * Weekly Member Spotlight component on HomePage that deterministically rotates
 * every Monday across active top contributors from live Firestore data.
 */
export const MemberSpotlight: React.FC = () => {
  const { publicProfiles, leaderboard, teamMembers, resources } = useApp();

  const totalDsaModules = resources.filter((r) => r.track === 'DSA').length;

  const { spotlight, totalCandidates } = useMemo(() => {
    const sortedLb = [...leaderboard].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const solvedDiff = (b.solvedCount ?? b.problemsSolved) - (a.solvedCount ?? a.problemsSolved);
      if (solvedDiff !== 0) return solvedDiff;
      return (b.eventsAttended ?? 0) - (a.eventsAttended ?? 0);
    });
    const map = new Map<string, SpotlightCandidate>();

    // 1. Seed from non-PII public_profiles (includes roadmap counts + social links)
    publicProfiles.forEach((p) => {
      const key = p.uid || normalize(p.hackerRankHandle) || p.id;
      map.set(key, {
        key,
        profileId: p.uid || p.id,
        name: p.name,
        department: p.department,
        year: p.year,
        bio: p.bio,
        photoUrl: p.photoUrl,
        hackerRankHandle: p.hackerRankHandle,
        hackerRankUrl: p.hackerRankUrl,
        githubUrl: p.githubUrl,
        linkedinUrl: p.linkedinUrl,
        completedDsaCount: p.completedDsaCount,
        completedRoadmapCount: p.completedRoadmapCount,
        problemsSolved: p.hackerRankSolvedCount,
        skills: p.skills || [],
      });
    });

    // 2. Merge live leaderboard achievements
    sortedLb.forEach((entry, idx) => {
      const handleKey = normalize(entry.hackerRankHandle);
      const nameKey = normalize(entry.name);
      const existing =
        (entry.uid && map.get(entry.uid)) ||
        Array.from(map.values()).find(
          (c) =>
            (handleKey && normalize(c.hackerRankHandle) === handleKey) ||
            normalize(c.name) === nameKey
        );

      if (existing) {
        existing.rank = idx + 1;
        existing.score = entry.score;
        existing.problemsSolved = Math.max(
          existing.problemsSolved ?? 0,
          entry.solvedCount ?? entry.problemsSolved
        );
        if (!existing.hackerRankHandle) existing.hackerRankHandle = entry.hackerRankHandle;
      } else {
        const key = entry.uid || handleKey || `lb_${entry.id}`;
        map.set(key, {
          key,
          profileId: entry.uid || entry.hackerRankHandle || entry.id,
          name: entry.name,
          department: entry.department,
          year: entry.year,
          bio: `Active Paavai HackerRank competitor in ${entry.department}.`,
          hackerRankHandle: entry.hackerRankHandle,
          hackerRankUrl: entry.hackerRankHandle
            ? `https://www.hackerrank.com/profile/${entry.hackerRankHandle.replace(/^@/, '')}`
            : undefined,
          rank: idx + 1,
          score: entry.score,
          problemsSolved: entry.solvedCount ?? entry.problemsSolved,
          skills: ['Algorithms', 'Problem Solving'],
        });
      }
    });

    // 3. Merge Crew & Lead mentors
    teamMembers.forEach((tm) => {
      const handleKey = normalize(tm.hackerRankHandle);
      const nameKey = normalize(tm.name);
      const existing =
        (tm.uid && map.get(tm.uid)) ||
        Array.from(map.values()).find(
          (c) =>
            (handleKey && normalize(c.hackerRankHandle) === handleKey) ||
            normalize(c.name) === nameKey
        );

      if (existing) {
        existing.designation = tm.designation;
        if (!existing.bio && tm.bio) existing.bio = tm.bio;
        if (!existing.photoUrl && tm.photoUrl) existing.photoUrl = tm.photoUrl;
      } else {
        const key = tm.uid || handleKey || `tm_${tm.id}`;
        map.set(key, {
          key,
          profileId: tm.uid || tm.id,
          name: tm.name,
          department: tm.department,
          year: tm.year,
          bio: tm.bio || `${tm.designation} at HackerRank Campus Crew Paavai.`,
          photoUrl: tm.photoUrl,
          designation: tm.designation,
          hackerRankHandle: tm.hackerRankHandle,
          skills: ['Mentorship', 'DSA'],
        });
      }
    });

    // Rank active top contributors deterministically so Monday rotation cycles top contributors
    const allCandidates = Array.from(map.values()).sort((a, b) => {
      const contribA =
        (a.score ?? 0) +
        (a.completedRoadmapCount ?? 0) * 15 +
        (a.problemsSolved ?? 0) * 5 +
        (a.designation ? 25 : 0);
      const contribB =
        (b.score ?? 0) +
        (b.completedRoadmapCount ?? 0) * 15 +
        (b.problemsSolved ?? 0) * 5 +
        (b.designation ? 25 : 0);
      if (contribB !== contribA) return contribB - contribA;
      return a.name.localeCompare(b.name);
    });

    if (allCandidates.length === 0) {
      return { spotlight: null, totalCandidates: 0 };
    }

    const activeTopPool = allCandidates.filter(
      (c) =>
        (c.score ?? 0) > 0 ||
        (c.completedRoadmapCount ?? 0) > 0 ||
        (c.problemsSolved ?? 0) > 0 ||
        Boolean(c.designation)
    );
    const rotationPool = (activeTopPool.length > 0 ? activeTopPool : allCandidates).slice(0, 12);

    const weekIndex = getIsoWeekIndex() % rotationPool.length;
    return {
      spotlight: rotationPool[weekIndex],
      totalCandidates: rotationPool.length,
    };
  }, [publicProfiles, leaderboard, teamMembers]);

  if (!spotlight) {
    return null;
  }

  return (
    <section
      aria-labelledby="member-spotlight-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 pt-16"
    >
      <div className="p-6 sm:p-9 rounded-2xl border border-[#00EA64]/35 bg-white dark:bg-[#121821] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Weekly Member Spotlight</span>
            </span>
            {spotlight.designation && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                · {spotlight.designation}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <MemberAvatar
              name={spotlight.name}
              photoUrl={spotlight.photoUrl}
              variant={spotlight.designation?.includes('Lead') ? 'lead' : 'crew'}
              sizeClass="w-14 h-14"
              textClass="text-lg"
            />
            <div className="min-w-0">
              <h2
                id="member-spotlight-heading"
                className="font-mono text-2xl font-bold text-slate-900 dark:text-white truncate"
              >
                <Link
                  to={`/members/${encodeURIComponent(spotlight.profileId)}`}
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                >
                  {spotlight.name}
                </Link>
              </h2>
              <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400">
                {spotlight.department} · {spotlight.year}
                {spotlight.hackerRankHandle ? ` · ${spotlight.hackerRankHandle}` : ''}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {spotlight.bio ||
              'Consistent contributor to the Paavai HackerRank Campus Crew coding community.'}
          </p>

          {/* Linked Social Portfolio Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {spotlight.hackerRankUrl && (
              <a
                href={spotlight.hackerRankUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-[#00EA64]/40 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] inline-flex items-center gap-1.5 hover:bg-[#00EA64]/20 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>HackerRank</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
            {spotlight.githubUrl && (
              <a
                href={spotlight.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-[#00EA64] transition-colors"
              >
                <Github className="w-3.5 h-3.5" aria-hidden="true" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
            {spotlight.linkedinUrl && (
              <a
                href={spotlight.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-[#00EA64] transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>LinkedIn</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {/* Highlighted Achievements & Roadmap Progress */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
          {spotlight.rank !== undefined && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
                  <span>Leaderboard Achievement</span>
                </p>
                <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  Rank #{spotlight.rank} · {(spotlight.score ?? 0).toLocaleString()} pts
                </p>
              </div>
              <span className="font-mono text-xs text-[#009942] dark:text-[#00EA64] tabular-nums">
                {spotlight.problemsSolved ?? 0} solved
              </span>
            </div>
          )}

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
                <span>Roadmap Milestones</span>
              </p>
              <p className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {spotlight.completedDsaCount !== undefined
                  ? `${spotlight.completedDsaCount}${totalDsaModules > 0 ? ` / ${totalDsaModules}` : ''} DSA modules completed`
                  : `${spotlight.skills.slice(0, 2).join(' · ') || 'Active DSA Track'}`}
              </p>
            </div>
            <Link
              to="/leaderboard"
              className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap"
            >
              Standings →
            </Link>
          </div>

          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Rotates weekly across {totalCandidates} verified Paavai community coder
            {totalCandidates === 1 ? '' : 's'}.
          </p>
        </div>
      </div>
    </section>
  );
};
