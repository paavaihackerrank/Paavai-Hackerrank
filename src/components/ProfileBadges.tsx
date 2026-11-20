import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Code2,
  Flame,
  Lock,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  LeaderboardEntry,
  LearningResource,
  UserAccount,
} from '../config/rbacAndData';

interface ProfileBadgesProps {
  user: UserAccount;
  resources: LearningResource[];
  completedResourceIds: string[];
  leaderboard: LeaderboardEntry[];
}

interface BadgeDefinition {
  id: string;
  title: string;
  category: 'DSA Roadmap' | 'Leaderboard';
  description: string;
  progressLabel: string;
  earned: boolean;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const normalizeHandle = (raw?: string) =>
  (raw || '').trim().toLowerCase().replace(/^@/, '');

/**
 * Achievement Badges section for ProfilePage, awarded dynamically from the
 * user's completed DSA roadmap modules and Campus Leaderboard activity.
 */
export const ProfileBadges: React.FC<ProfileBadgesProps> = ({
  user,
  resources,
  completedResourceIds,
  leaderboard,
}) => {
  const { badges, earnedCount } = useMemo(() => {
    const dsaModules = resources.filter((r) => r.track === 'DSA');
    const completedDsaCount = dsaModules.filter((r) =>
      completedResourceIds.includes(r.id)
    ).length;
    const totalDsaCount = dsaModules.length;
    const halfThreshold =
      totalDsaCount > 0 ? Math.max(1, Math.ceil(totalDsaCount / 2)) : 2;

    const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);
    const userReg = user.regNo.trim().toLowerCase();
    const userHandle = normalizeHandle(user.hackerRankHandle);

    const matchedIndex = sortedLeaderboard.findIndex((entry) => {
      const regMatch =
        Boolean(userReg) &&
        entry.registerNumber.trim().toLowerCase() === userReg;
      const entryHandle = normalizeHandle(entry.hackerRankHandle);
      const handleMatch =
        Boolean(userHandle) &&
        userHandle !== 'paavai_coder' &&
        entryHandle === userHandle;
      return regMatch || handleMatch;
    });

    const myEntry = matchedIndex >= 0 ? sortedLeaderboard[matchedIndex] : null;
    const myRank = matchedIndex >= 0 ? matchedIndex + 1 : null;
    const myScore = myEntry?.score ?? 0;
    const mySolved = myEntry?.problemsSolved ?? 0;

    const list: BadgeDefinition[] = [
      {
        id: 'dsa-starter',
        title: 'DSA Starter',
        category: 'DSA Roadmap',
        description: 'Complete your first DSA roadmap module.',
        progressLabel:
          totalDsaCount > 0
            ? `${Math.min(completedDsaCount, 1)} / 1 DSA module`
            : '0 DSA modules published',
        earned: completedDsaCount >= 1,
        icon: Code2,
      },
      {
        id: 'dsa-builder',
        title: 'Algorithm Builder',
        category: 'DSA Roadmap',
        description: `Complete at least ${halfThreshold} DSA roadmap module${halfThreshold === 1 ? '' : 's'}.`,
        progressLabel:
          totalDsaCount > 0
            ? `${completedDsaCount} / ${halfThreshold} DSA modules`
            : 'Waiting for DSA modules',
        earned: totalDsaCount > 0 && completedDsaCount >= halfThreshold,
        icon: Flame,
      },
      {
        id: 'dsa-master',
        title: 'DSA Roadmap Master',
        category: 'DSA Roadmap',
        description: 'Complete 100% of all published DSA roadmap modules.',
        progressLabel:
          totalDsaCount > 0
            ? `${completedDsaCount} / ${totalDsaCount} DSA modules`
            : 'Waiting for DSA modules',
        earned: totalDsaCount > 0 && completedDsaCount >= totalDsaCount,
        icon: Award,
      },
      {
        id: 'ranked-contender',
        title: 'Ranked Contender',
        category: 'Leaderboard',
        description: 'Appear on the Paavai HackerRank Campus Leaderboard.',
        progressLabel: myEntry
          ? `Rank #${myRank} · ${myScore.toLocaleString()} pts`
          : 'Not ranked on leaderboard yet',
        earned: Boolean(myEntry && (myScore > 0 || mySolved > 0)),
        icon: TrendingUp,
      },
      {
        id: 'problem-crusher',
        title: 'Problem Crusher',
        category: 'Leaderboard',
        description: 'Solve 25 or more problems tracked on the Campus Leaderboard.',
        progressLabel: `${mySolved} / 25 problems solved`,
        earned: mySolved >= 25,
        icon: Zap,
      },
      {
        id: 'top-three-podium',
        title: 'Campus Top 3 Podium',
        category: 'Leaderboard',
        description: 'Reach Top 3 on the official Campus Leaderboard standings.',
        progressLabel: myRank ? `Current Rank: #${myRank}` : 'Unranked',
        earned: myRank !== null && myRank <= 3,
        icon: Trophy,
      },
    ];

    return {
      badges: list,
      earnedCount: list.filter((b) => b.earned).length,
    };
  }, [user, resources, completedResourceIds, leaderboard]);

  return (
    <section
      aria-labelledby="profile-badges-heading"
      className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Achievements · DSA &amp; Leaderboard Activity
          </p>
          <h2
            id="profile-badges-heading"
            className="font-mono text-xl font-bold text-slate-900 dark:text-white"
          >
            Badges ({earnedCount} / {badges.length} Earned)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <Link
            to="/resources"
            className="text-[#009942] dark:text-[#00EA64] hover:underline"
          >
            DSA Roadmap →
          </Link>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>
          <Link
            to="/leaderboard"
            className="text-[#009942] dark:text-[#00EA64] hover:underline"
          >
            Leaderboard →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.id}
              className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                badge.earned
                  ? 'border-[#00EA64]/50 bg-[#00EA64]/8 dark:bg-[#00EA64]/5'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]/70 opacity-80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                    badge.earned
                      ? 'bg-[#00EA64] border-[#00EA64] text-[#0B0F14]'
                      : 'bg-slate-200/70 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" aria-hidden={true} />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {badge.category}
                    </p>
                    <span
                      className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        badge.earned
                          ? 'bg-[#00EA64]/20 text-[#009942] dark:text-[#00EA64]'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 inline-flex items-center gap-1'
                      }`}
                    >
                      {!badge.earned && <Lock className="w-2.5 h-2.5" aria-hidden="true" />}
                      {badge.earned ? 'Earned' : 'Locked'}
                    </span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {badge.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              </div>

              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                {badge.progressLabel}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
