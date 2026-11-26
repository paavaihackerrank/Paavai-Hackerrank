import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Building2, Lock, Search, Trophy, Users } from 'lucide-react';
import { DEPARTMENTS, CHAPTER_IMAGES } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { PageSeo } from '../components/PageSeo';
import { MemberAvatar } from '../components/MemberAvatar';

type SortField = 'rank' | 'name' | 'department' | 'year' | 'score' | 'problemsSolved';
type LeaderboardView = 'individual' | 'departments';

interface DepartmentStanding {
  rank: number;
  department: string;
  totalScore: number;
  avgScore: number;
  totalSolved: number;
  coderCount: number;
  eventsAttended: number;
  topCoderName: string;
  topCoderScore: number;
}

export const LeaderboardPage: React.FC = () => {
  const { leaderboard, publicProfiles, teamMembers, can, siteSettings } = useApp();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [search, setSearch] = useState(urlQuery);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<LeaderboardView>('individual');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setSearch(urlQuery);
  }, [urlQuery]);

  const canViewFull = can('canViewFullLeaderboard');
  const guestLimit = siteSettings.publicLeaderboardLimit;

  const photoLookup = useMemo(() => {
    const map = new Map<string, string>();
    teamMembers.forEach((tm) => {
      if (tm.photoUrl) {
        if (tm.uid) map.set(tm.uid, tm.photoUrl);
        if (tm.hackerRankHandle) {
          map.set(tm.hackerRankHandle.trim().toLowerCase().replace(/^@/, ''), tm.photoUrl);
        }
      }
    });
    publicProfiles.forEach((pp) => {
      if (pp.photoUrl) {
        map.set(pp.uid, pp.photoUrl);
        if (pp.hackerRankHandle) {
          map.set(pp.hackerRankHandle.trim().toLowerCase().replace(/^@/, ''), pp.photoUrl);
        }
      }
    });
    return map;
  }, [publicProfiles, teamMembers]);

  // Compute canonical global rank dynamically descending by score -> solved -> eventsAttended
  const rankedList = useMemo(() => {
    const byScore = [...leaderboard].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const solvedDiff = (b.solvedCount ?? b.problemsSolved) - (a.solvedCount ?? a.problemsSolved);
      if (solvedDiff !== 0) return solvedDiff;
      const eventsDiff = (b.eventsAttended ?? 0) - (a.eventsAttended ?? 0);
      if (eventsDiff !== 0) return eventsDiff;
      return a.name.localeCompare(b.name);
    });
    return byScore.map((entry, idx) => ({
      ...entry,
      problemsSolved: entry.solvedCount ?? entry.problemsSolved,
      rank: idx + 1,
    }));
  }, [leaderboard]);

  // Inter-Department Cup standings aggregated across all ranked campus coders
  const departmentStandings = useMemo<DepartmentStanding[]>(() => {
    const map = new Map<
      string,
      {
        totalScore: number;
        totalSolved: number;
        coderCount: number;
        eventsAttended: number;
        topCoderName: string;
        topCoderScore: number;
      }
    >();

    rankedList.forEach((row) => {
      const dept = (row.department || 'Other').trim() || 'Other';
      const existing = map.get(dept);
      if (!existing) {
        map.set(dept, {
          totalScore: row.score,
          totalSolved: row.problemsSolved,
          coderCount: 1,
          eventsAttended: row.eventsAttended ?? 0,
          topCoderName: row.name,
          topCoderScore: row.score,
        });
      } else {
        existing.totalScore += row.score;
        existing.totalSolved += row.problemsSolved;
        existing.coderCount += 1;
        existing.eventsAttended += row.eventsAttended ?? 0;
        if (row.score > existing.topCoderScore) {
          existing.topCoderScore = row.score;
          existing.topCoderName = row.name;
        }
      }
    });

    return Array.from(map.entries())
      .map(([department, stats]) => ({
        rank: 0,
        department,
        totalScore: stats.totalScore,
        avgScore: stats.coderCount > 0 ? Math.round(stats.totalScore / stats.coderCount) : 0,
        totalSolved: stats.totalSolved,
        coderCount: stats.coderCount,
        eventsAttended: stats.eventsAttended,
        topCoderName: stats.topCoderName,
        topCoderScore: stats.topCoderScore,
      }))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
        return a.department.localeCompare(b.department);
      })
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [rankedList]);

  // Enforce RBAC visibility cap: Guests strictly see Top 10
  const accessiblePool = useMemo(
    () => (canViewFull ? rankedList : rankedList.slice(0, guestLimit)),
    [rankedList, canViewFull, guestLimit]
  );

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = accessiblePool.filter((row) => {
      const matchesDept = deptFilter === 'ALL' || row.department === deptFilter;
      const matchesQuery =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.registerNumber.toLowerCase().includes(q) ||
        row.hackerRankHandle.toLowerCase().includes(q);
      return matchesDept && matchesQuery;
    });

    return list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'rank' || sortField === 'score' || sortField === 'problemsSolved') {
        return (a[sortField] - b[sortField]) * mul;
      }
      return a[sortField].localeCompare(b[sortField]) * mul;
    });
  }, [accessiblePool, deptFilter, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'score' || field === 'problemsSolved' ? 'desc' : 'asc');
    }
  };

  const handleInspectDepartment = (department: string) => {
    setDeptFilter(department);
    setViewMode('individual');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-8">
      <PageSeo
        title="Campus Leaderboard"
        description={`Explore verified competitive programming standings and Inter-Department Cup rankings across ${leaderboard.length} coders at ${siteSettings.collegeName}.`}
        canonicalPath="/leaderboard"
        image={CHAPTER_IMAGES.awardCeremony}
        keywords={['Campus Leaderboard', 'Inter-Department Cup', 'HackerRank Standings', 'Top Coders Paavai']}
      />

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Verified Standings · {siteSettings.collegeName}
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Campus Leaderboard
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            {canViewFull
              ? `Displaying all ${leaderboard.length} ranked Paavai coders across ${departmentStandings.length} active departments.`
              : `Guest preview showing the Top ${guestLimit} of ${leaderboard.length} ranked coders plus live Inter-Department Cup standings.`}
          </p>
        </div>

        {/* View Toggle + Search & Department Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {viewMode === 'individual' && (
            <>
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or handle..."
                  aria-label="Search leaderboard"
                  className="h-10 pl-9 pr-3 w-full sm:w-52 rounded-lg text-sm bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
              <select
                aria-label="Filter by department"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-10 px-3 rounded-lg text-sm bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </header>

      {/* Top-3 Inter-Department Cup Leader Strip */}
      {departmentStandings.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Inter-Department Cup · Top Contenders
              </h2>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-1">
              <button
                type="button"
                onClick={() => setViewMode('individual')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  viewMode === 'individual'
                    ? 'bg-[#00EA64] text-[#0B0F14]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Individual ({rankedList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('departments')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  viewMode === 'departments'
                    ? 'bg-[#00EA64] text-[#0B0F14]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Inter-Department Cup ({departmentStandings.length})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {departmentStandings.slice(0, 3).map((dept) => (
              <button
                key={dept.department}
                type="button"
                onClick={() => handleInspectDepartment(dept.department)}
                className={`text-left p-5 rounded-xl border transition-colors bg-white dark:bg-[#121821] ${
                  dept.rank === 1
                    ? 'border-[#00EA64]/50 hover:border-[#00EA64]'
                    : 'border-slate-200 dark:border-slate-800 hover:border-[#00EA64]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-xs font-bold ${
                      dept.rank === 1
                        ? 'text-[#009942] dark:text-[#00EA64]'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    #{dept.rank} DEPARTMENT
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {dept.coderCount} coder{dept.coderCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xl font-bold text-slate-900 dark:text-white">
                  {dept.department}
                </p>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl font-extrabold tabular-nums text-[#009942] dark:text-[#00EA64]">
                    {dept.totalScore.toLocaleString()}
                    <span className="text-xs font-normal text-slate-500 ml-1">pts</span>
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {dept.totalSolved} solved
                  </span>
                </div>
                <p className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 truncate">
                  Top coder: <strong className="text-slate-800 dark:text-slate-200">{dept.topCoderName}</strong>
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Active Standings Table */}
      {viewMode === 'departments' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] text-xs font-mono text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4 font-semibold">Rank</th>
                  <th className="py-3.5 px-4 font-semibold">Department</th>
                  <th className="py-3.5 px-4 font-semibold">Top Coder</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Ranked Coders</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total Solved</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Avg Score</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-sm">
                {departmentStandings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      No department standings available yet.
                    </td>
                  </tr>
                ) : (
                  departmentStandings.map((dept) => (
                    <tr
                      key={dept.department}
                      onClick={() => handleInspectDepartment(dept.department)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-[#17202C]/70 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                        <span
                          className={
                            dept.rank <= 3
                              ? 'text-[#009942] dark:text-[#00EA64]'
                              : 'text-slate-600 dark:text-slate-400'
                          }
                        >
                          #{String(dept.rank).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono font-bold text-slate-900 dark:text-white">
                          {dept.department}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {dept.eventsAttended} verified event check-in{dept.eventsAttended === 1 ? '' : 's'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {dept.topCoderName}
                        </p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {dept.topCoderScore.toLocaleString()} pts
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {dept.coderCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {dept.totalSolved.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {dept.avgScore.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-[#009942] dark:text-[#00EA64]">
                        {dept.totalScore.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
          {deptFilter !== 'ALL' && (
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] flex items-center justify-between text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-300">
                Filtered by department: <strong className="text-[#009942] dark:text-[#00EA64]">{deptFilter}</strong>
              </span>
              <button
                type="button"
                onClick={() => setDeptFilter('ALL')}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
              >
                Show all departments
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] text-xs font-mono text-slate-500 dark:text-slate-400">
                  {(
                    [
                      ['rank', 'Rank', 'text-left'],
                      ['name', 'Coder', 'text-left'],
                      ['department', 'Department', 'text-left'],
                      ['year', 'Year', 'text-left'],
                      ['problemsSolved', 'Solved', 'text-right'],
                      ['score', 'Score', 'text-right'],
                    ] as const
                  ).map(([field, label, align]) => (
                    <th key={field} className={`py-3.5 px-4 font-semibold ${align}`}>
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors ${
                          align === 'text-right' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <span>{label}</span>
                        <ArrowUpDown
                          className={`w-3.5 h-3.5 ${
                            sortField === field ? 'text-[#009942] dark:text-[#00EA64]' : 'opacity-50'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-sm">
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      {leaderboard.length === 0
                        ? 'No leaderboard standings published yet.'
                        : 'No coders match your current search or department filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#17202C]/70 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                        <span
                          className={
                            row.rank <= 3
                              ? 'text-[#009942] dark:text-[#00EA64]'
                              : 'text-slate-600 dark:text-slate-400'
                          }
                        >
                          #{String(row.rank).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar
                            name={row.name}
                            photoUrl={
                              (row.uid ? photoLookup.get(row.uid) : undefined) ||
                              photoLookup.get(row.hackerRankHandle.trim().toLowerCase().replace(/^@/, '')) ||
                              ''
                            }
                            variant="member"
                            sizeClass="w-8 h-8"
                            textClass="text-[11px]"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/members/${encodeURIComponent(row.uid || row.hackerRankHandle || row.id)}`}
                              className="font-semibold text-slate-900 dark:text-white hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors block truncate"
                            >
                              {row.name}
                            </Link>
                            <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
                              {row.hackerRankHandle} · {row.registerNumber}
                              {row.eventsAttended
                                ? ` · ${row.eventsAttended} event${row.eventsAttended === 1 ? '' : 's'}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {row.department}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 tabular-nums">
                        {row.year}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {row.problemsSolved}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {row.score.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Guest Top-10 Lock Notice */}
          {!canViewFull && leaderboard.length > guestLimit && (
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    {leaderboard.length - guestLimit} more ranked students hidden in Guest view
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Sign in as a Student Community Member to inspect full Paavai campus rankings and
                    track your own standing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors whitespace-nowrap shrink-0"
                >
                  Login to Unlock
                </Link>
                {siteSettings.applicationsOpen && (
                  <Link
                    to="/join"
                    className="px-4 py-2 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
                  >
                    Request to Join
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
