import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Calendar, ChevronRight, Code2, Megaphone, Trophy, Users } from 'lucide-react';
import { CHAPTER_IMAGES, ROLE_META } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { SafeImage } from '../components/SafeImage';

export const HomePage: React.FC = () => {
  const {
    siteSettings,
    announcements,
    events,
    leaderboard,
    resources,
    teamMembers,
    currentRole,
    currentUser,
    can,
  } = useApp();

  const approvedAnnouncements = announcements.filter((a) => a.status === 'approved');
  const approvedEvents = events.filter((e) => e.status === 'approved');
  const upcomingEvents = approvedEvents
    .filter((e) => new Date(e.dateISO).getTime() > Date.now())
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
  const nextEvent = upcomingEvents[0];

  const topThree = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 3);
  const totalProblemsSolved = leaderboard.reduce(
    (sum, entry) => sum + (Number(entry.problemsSolved) || 0),
    0
  );
  const activeTracksCount = new Set(resources.map((r) => r.track)).size;

  return (
    <div>
      {/* Approved Campus Announcement Strip */}
      {approvedAnnouncements.length > 0 && (
        <div className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/90 dark:bg-[#101720]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Megaphone className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64] shrink-0" aria-hidden="true" />
              <span className="font-mono font-semibold text-slate-900 dark:text-white shrink-0">
                {approvedAnnouncements[0].title}:
              </span>
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {approvedAnnouncements[0].message}
              </span>
            </div>
            <Link
              to="/events"
              className="font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              <span>View schedule</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-tech-grid border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Copy Column */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-center space-y-6"
            >
              <p className="font-mono text-xs sm:text-sm font-medium text-[#009942] dark:text-[#00EA64]">
                {siteSettings.chapterName} · {siteSettings.collegeName}
              </p>

              <h1 className="font-mono text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
                {siteSettings.tagline}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                The official student-led competitive programming community at{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {siteSettings.collegeName}
                </span>
                . Practice structured DSA roadmaps, compete in weekly timed contests, and climb the
                verified campus leaderboard alongside peers across every engineering department.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {can('canSubmitJoinRequest') ? (
                  <Link
                    to="/join"
                    className="px-6 py-3 rounded-lg font-semibold text-sm bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Request to Join</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                ) : can('canAccessCrewDashboard') ? (
                  <Link
                    to="/dashboard"
                    className="px-6 py-3 rounded-lg font-semibold text-sm bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Open Crew Dashboard</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link
                    to="/resources"
                    className="px-6 py-3 rounded-lg font-semibold text-sm bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Start Learning Roadmap</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                )}

                <Link
                  to="/events"
                  className="px-6 py-3 rounded-lg font-medium text-sm border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Events
                </Link>
              </div>

              <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Viewing as {ROLE_META[currentRole].label}</span>
                {currentUser ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Signed in: {currentUser.name}</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Sign in with your @paavai.edu.in email for full member access</span>
                  </>
                )}
              </div>
            </motion.div>

            {/* Right Visual Anchor (16:9 / stretched cleanly) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6"
            >
              <div className="relative h-full min-h-[280px] lg:min-h-[400px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
                <SafeImage
                  src={CHAPTER_IMAGES.hero}
                  alt="Paavai Engineering College students collaborating during a HackerRank Campus Crew coding session"
                  className="w-full h-full object-cover"
                  fallbackTitle="Paavai Campus Coding Lab"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14]/90 via-[#0B0F14]/30 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-6 text-white">
                  <p className="font-mono text-xs text-[#00EA64]">
                    Namakkal Campus · Weekly Algorithmic Labs
                  </p>
                  <p className="text-sm sm:text-base font-medium mt-1 text-slate-100">
                    Hands-on problem solving across CSE, IT, AI & DS, Cyber Security, and ECE.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Full-width Quantitative Proof Strip below Hero Split (100% live from Firestore) */}
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/90 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {teamMembers.length}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Active Campus Lead &amp; Crew mentors
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {approvedEvents.length}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Published campus contests &amp; workshops
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {totalProblemsSolved.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Problems solved across {leaderboard.length} ranked coder{leaderboard.length === 1 ? '' : 's'}
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#009942] dark:text-[#00EA64]">
                {activeTracksCount} {activeTracksCount === 1 ? 'Track' : 'Tracks'}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {resources.length} live roadmap module{resources.length === 1 ? '' : 's'} available
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About the Crew Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
              About the Chapter
            </p>
            <h2 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Built by Paavai students for disciplined problem solving.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              The HackerRank Campus Crew at Paavai Engineering College bridges classroom computer
              science theory and technical hiring standards. Every week, senior mentors publish
              curated practice sheets, run proctored mock coding rounds, and review optimal code
              live on campus.
            </p>
            <div className="pt-2">
              <Link
                to="/team"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#009942] dark:text-[#00EA64] hover:underline"
              >
                <span>Meet the Campus Lead & Crew</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              <Code2 className="w-5 h-5 text-[#009942] dark:text-[#00EA64] mb-3" aria-hidden="true" />
              <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                01. Structured Roadmaps
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Step-by-step progression from Big-O basics and SQL aggregations to Dynamic
                Programming, Graphs, and placement mock tests.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              <Trophy className="w-5 h-5 text-[#009942] dark:text-[#00EA64] mb-3" aria-hidden="true" />
              <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                02. Weekly Rated Contests
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Compete against peers in timed HackerRank contests with transparent campus rankings
                and detailed post-contest editorials.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              <Users className="w-5 h-5 text-[#009942] dark:text-[#00EA64] mb-3" aria-hidden="true" />
              <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                03. Peer Code Reviews
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Get feedback on runtime complexity, clean code style, and edge-case testing directly
                from Campus Crew mentors.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              <Calendar className="w-5 h-5 text-[#009942] dark:text-[#00EA64] mb-3" aria-hidden="true" />
              <h3 className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                04. Placement Bootcamps
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Dedicated SQL clinics, interview coding sprints, and mock technical panels tailored
                for 3rd and 4th-year placement drives.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Spotlight Row: Next Upcoming Event + Current Top 3 Coders */}
      <section className="border-y border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0E141C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Next Event Card */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121821] flex flex-col justify-between">
            <div>
              <p className="font-mono text-xs text-[#009942] dark:text-[#00EA64]">
                Next Up on Campus
              </p>
              {nextEvent ? (
                <>
                  <h3 className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
                    {nextEvent.title}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-2">
                    {new Date(nextEvent.dateISO).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {nextEvent.venue} · {nextEvent.membersOnly ? 'Members Only' : 'Open to All'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
                    {nextEvent.description}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500 mt-3">
                  New contests and workshops are being scheduled. Check back soon.
                </p>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {upcomingEvents.length} upcoming event{upcomingEvents.length === 1 ? '' : 's'} scheduled
              </span>
              <Link
                to="/events"
                className="px-4 py-2 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors whitespace-nowrap shrink-0"
              >
                View All Events
              </Link>
            </div>
          </div>

          {/* Top 3 Leaderboard Snapshot */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121821] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-[#009942] dark:text-[#00EA64]">
                  Campus Standings
                </p>
                <Link
                  to="/leaderboard"
                  className="text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Full table →
                </Link>
              </div>
              <h3 className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-2">
                Current Top Coders
              </h3>

              {topThree.length === 0 ? (
                <p className="text-sm text-slate-500 mt-4">
                  No leaderboard standings published yet.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
                  {topThree.map((entry, idx) => (
                    <div key={entry.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-sm font-bold tabular-nums w-6 text-[#009942] dark:text-[#00EA64]">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {entry.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.department} · {entry.year}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                        {entry.score.toLocaleString()} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              {can('canViewFullLeaderboard')
                ? `Full campus standings unlocked (${leaderboard.length} coders).`
                : 'Guests preview Top 10 rankings. Log in to view all standings.'}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Band */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
        <div className="p-8 sm:p-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Ready to represent Paavai on the HackerRank leaderboard?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Apply for membership to unlock complete DSA & SQL study tracks, members-only coding
              clinics, and verified contest rankings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to={currentUser ? '/events' : '/join'}
              className="px-6 py-3 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors whitespace-nowrap shrink-0"
            >
              {currentUser ? 'Browse Upcoming Contests' : 'Submit Join Request'}
            </Link>
            <Link
              to="/contact"
              className="px-5 py-3 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
            >
              Read FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
