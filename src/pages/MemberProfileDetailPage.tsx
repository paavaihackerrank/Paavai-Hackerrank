import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Check,
  Code2,
  ExternalLink,
  Github,
  Linkedin,
  Share2,
  ShieldCheck,
  Trophy,
  User as UserIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MemberAvatar } from '../components/MemberAvatar';
import { PageSeo, SITE_NAME, toAbsoluteUrl } from '../components/PageSeo';

const normalize = (v?: string) => (v || '').trim().toLowerCase().replace(/^@/, '');

interface ResolvedPublicMember {
  id: string;
  name: string;
  department: string;
  year: string;
  bio: string;
  photoUrl?: string;
  role: 'lead' | 'crew' | 'member';
  designation: string;
  hackerRankHandle?: string;
  hackerRankUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  skills: string[];
  completedDsaCount?: number;
  completedRoadmapCount?: number;
  rank?: number;
  score?: number;
  problemsSolved?: number;
}

export const MemberProfileDetailPage: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const {
    teamMembers,
    publicProfiles,
    leaderboard,
    resources,
    currentUser,
    siteSettings,
    addToast,
  } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);
  const totalDsaModules = resources.filter((r) => r.track === 'DSA').length;
  const decodedParam = decodeURIComponent(memberId || '').trim();
  const normalizedParam = normalize(decodedParam);

  const member = useMemo<ResolvedPublicMember | null>(() => {
    if (!decodedParam) return null;

    const sortedLb = [...leaderboard].sort((a, b) => b.score - a.score);

    const matchedTeam = teamMembers.find(
      (tm) =>
        tm.uid === decodedParam ||
        tm.id === decodedParam ||
        (tm.hackerRankHandle && normalize(tm.hackerRankHandle) === normalizedParam) ||
        normalize(tm.name) === normalizedParam
    );

    const matchedProfile = publicProfiles.find(
      (pp) =>
        pp.uid === decodedParam ||
        pp.id === decodedParam ||
        (matchedTeam && pp.uid === matchedTeam.uid) ||
        (pp.hackerRankHandle && normalize(pp.hackerRankHandle) === normalizedParam) ||
        normalize(pp.name) === normalizedParam
    );

    const nameCandidate = matchedProfile?.name || matchedTeam?.name || '';
    const handleCandidate =
      matchedProfile?.hackerRankHandle || matchedTeam?.hackerRankHandle || '';

    const lbIndex = sortedLb.findIndex(
      (lb) =>
        lb.id === decodedParam ||
        (handleCandidate && normalize(lb.hackerRankHandle) === normalize(handleCandidate)) ||
        (nameCandidate && normalize(lb.name) === normalize(nameCandidate)) ||
        normalize(lb.hackerRankHandle) === normalizedParam ||
        normalize(lb.name) === normalizedParam
    );
    const matchedLb = lbIndex >= 0 ? sortedLb[lbIndex] : undefined;

    if (!matchedTeam && !matchedProfile && !matchedLb) {
      return null;
    }

    const handle =
      matchedProfile?.hackerRankHandle ||
      matchedTeam?.hackerRankHandle ||
      matchedLb?.hackerRankHandle ||
      '';
    const role: ResolvedPublicMember['role'] = matchedTeam?.role || 'member';
    const designation =
      matchedTeam?.designation ||
      (role === 'lead'
        ? 'Campus Lead'
        : role === 'crew'
          ? 'Campus Crew Member'
          : 'Student Community Member');

    return {
      id: matchedProfile?.uid || matchedTeam?.uid || matchedTeam?.id || matchedLb?.id || decodedParam,
      name: matchedProfile?.name || matchedTeam?.name || matchedLb?.name || 'Community Member',
      department:
        matchedProfile?.department || matchedTeam?.department || matchedLb?.department || 'CSE',
      year: matchedProfile?.year || matchedTeam?.year || matchedLb?.year || 'Student',
      bio:
        matchedProfile?.bio ||
        matchedTeam?.bio ||
        `Active ${designation} at ${siteSettings.collegeName} practicing competitive programming and DSA.`,
      photoUrl: matchedProfile?.photoUrl || matchedTeam?.photoUrl || '',
      role,
      designation,
      hackerRankHandle: handle,
      hackerRankUrl:
        matchedProfile?.hackerRankUrl ||
        (handle ? `https://www.hackerrank.com/profile/${handle.replace(/^@/, '')}` : undefined),
      githubUrl: matchedProfile?.githubUrl,
      linkedinUrl: matchedProfile?.linkedinUrl,
      skills:
        matchedProfile?.skills && matchedProfile.skills.length > 0
          ? matchedProfile.skills
          : matchedLb
            ? ['Competitive Programming', 'DSA']
            : ['Problem Solving'],
      completedDsaCount: matchedProfile?.completedDsaCount,
      completedRoadmapCount: matchedProfile?.completedRoadmapCount,
      rank: lbIndex >= 0 ? lbIndex + 1 : undefined,
      score: matchedLb?.score,
      problemsSolved: matchedLb?.problemsSolved,
    };
  }, [
    decodedParam,
    normalizedParam,
    teamMembers,
    publicProfiles,
    leaderboard,
    siteSettings.collegeName,
  ]);

  const handleCopyLink = async () => {
    try {
      const shareUrl =
        typeof window !== 'undefined'
          ? window.location.href
          : `/members/${encodeURIComponent(decodedParam)}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      addToast('Profile link copied', 'Share this public member profile URL.', 'success');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      addToast('Copy failed', 'Copy the URL directly from your browser address bar.', 'info');
    }
  };

  if (!member) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-6">
        <PageSeo
          title="Member Profile Not Found"
          description="This HackerRank Campus Crew member profile could not be found."
          noIndex
        />
        <Link
          to="/team"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Campus Crew</span>
        </Link>

        <div className="p-8 sm:p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-center space-y-3">
          <UserIcon className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            Member Profile Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            No public community profile matched this identifier. Explore our Campus Crew roster or
            live leaderboard standings.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/team"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
            >
              Meet Campus Crew
            </Link>
            <Link
              to="/leaderboard"
              className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64]"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const profileUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/members/${encodeURIComponent(member.id)}`
      : `/members/${encodeURIComponent(member.id)}`;

  const sameAs = [member.hackerRankUrl, member.githubUrl, member.linkedinUrl].filter(
    (u): u is string => Boolean(u)
  );

  const personSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: member.name,
    jobTitle: member.designation,
    description: member.bio,
    url: profileUrl,
    image: toAbsoluteUrl(member.photoUrl),
    affiliation: {
      '@type': 'EducationalOrganization',
      name: SITE_NAME,
    },
    knowsAbout: member.skills,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  const isOwnProfile = Boolean(currentUser && currentUser.id === member.id);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <PageSeo
        title={`${member.name} – ${member.designation}`}
        description={`${member.name} (${member.department}, ${member.year}) · ${member.designation} at ${siteSettings.collegeName}.${member.skills.length ? ` Skills: ${member.skills.slice(0, 4).join(', ')}.` : ''} ${member.bio}`}
        canonicalPath={`/members/${encodeURIComponent(member.id)}`}
        type="profile"
        image={member.photoUrl}
        imageAlt={`${member.name} profile photo`}
        profile={{
          username: member.hackerRankHandle || member.id,
        }}
        keywords={[
          member.name,
          member.designation,
          member.department,
          member.year,
          member.hackerRankHandle || '',
          ...member.skills,
        ]}
        structuredData={personSchema}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={member.role === 'member' ? '/leaderboard' : '/team'}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{member.role === 'member' ? 'Back to Leaderboard' : 'Back to Campus Crew'}</span>
        </Link>

        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <Link
              to="/profile"
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors"
            >
              Edit My Profile
            </Link>
          )}
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            )}
            <span>{copiedLink ? 'Link Copied' : 'Share Profile'}</span>
          </button>
        </div>
      </div>

      <article className="p-6 sm:p-9 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
          <MemberAvatar
            name={member.name}
            photoUrl={member.photoUrl}
            variant={member.role}
            sizeClass="w-20 h-20 sm:w-24 sm:h-24"
            textClass="text-2xl"
          />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#009942] dark:text-[#00EA64]">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {member.designation} · {siteSettings.collegeName}
              </span>
            </div>

            <h1 className="font-mono text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white truncate">
              {member.name}
            </h1>

            <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400">
              {member.department} · {member.year}
              {member.hackerRankHandle ? ` · HackerRank: ${member.hackerRankHandle}` : ''}
            </p>
          </div>
        </header>

        <section className="space-y-2.5">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Community Bio
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
            {member.bio}
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-1">
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>Campus Rank</span>
            </p>
            <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {member.rank !== undefined ? `#${member.rank}` : 'Active'}
            </p>
            {member.score !== undefined && (
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {member.score.toLocaleString()} pts
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-1">
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>Problems Solved</span>
            </p>
            <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {member.problemsSolved !== undefined ? member.problemsSolved : '—'}
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Verified HackerRank track
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-1">
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>Roadmap Progress</span>
            </p>
            <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {member.completedRoadmapCount !== undefined
                ? `${member.completedRoadmapCount} modules`
                : 'Exploring'}
            </p>
            {member.completedDsaCount !== undefined && (
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {member.completedDsaCount}
                {totalDsaModules > 0 ? ` / ${totalDsaModules}` : ''} DSA completed
              </p>
            )}
          </div>
        </section>

        {member.skills.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Technical Focus & Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {member.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] text-slate-700 dark:text-slate-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {(member.hackerRankUrl || member.githubUrl || member.linkedinUrl) && (
          <section className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
            {member.hackerRankUrl && (
              <a
                href={member.hackerRankUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg text-xs font-mono border border-[#00EA64]/40 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] inline-flex items-center gap-1.5 hover:bg-[#00EA64]/20 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>HackerRank</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
            {member.githubUrl && (
              <a
                href={member.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-[#00EA64] transition-colors"
              >
                <Github className="w-3.5 h-3.5" aria-hidden="true" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
            {member.linkedinUrl && (
              <a
                href={member.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-[#00EA64] transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>LinkedIn</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </section>
        )}
      </article>
    </div>
  );
};
