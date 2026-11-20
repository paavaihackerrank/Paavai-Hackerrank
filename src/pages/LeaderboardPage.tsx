import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Lock, Search } from 'lucide-react';
import { DEPARTMENTS } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

type SortField = 'rank' | 'name' | 'department' | 'year' | 'score' | 'problemsSolved';

export const LeaderboardPage: React.FC = () => {
  const { leaderboard, can, siteSettings } = useApp();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [search, setSearch] = useState(urlQuery);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setSearch(urlQuery);
  }, [urlQuery]);

  const canViewFull = can('canViewFullLeaderboard');
  const guestLimit = siteSettings.publicLeaderboardLimit;

  // Compute canonical global rank by descending score
  const rankedList = useMemo(() => {
    const byScore = [...leaderboard].sort((a, b) => b.score - a.score);
    return byScore.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [leaderboard]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-8">
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
              ? `Displaying all ${leaderboard.length} ranked Paavai coders. Click any column header to sort.`
              : `Guest preview showing the Top ${guestLimit} of ${leaderboard.length} ranked coders. Sign in to unlock full campus standings.`}
          </p>
        </div>

        {/* Search & Department Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
              className="h-10 pl-9 pr-3 w-full sm:w-56 rounded-lg text-sm bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
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
        </div>
      </header>

      {/* Sortable Leaderboard Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
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
                      <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.hackerRankHandle} · {row.registerNumber}
                      </p>
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
              <Link
                to="/join"
                className="px-4 py-2 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
              >
                Request to Join
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
