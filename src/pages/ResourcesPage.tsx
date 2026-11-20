import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, ExternalLink, Lock, X } from 'lucide-react';
import { ResourceTrack, CHAPTER_IMAGES } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { PageSeo } from '../components/PageSeo';

const TRACKS: Array<'All' | ResourceTrack> = [
  'All',
  'DSA',
  'Python',
  'Java',
  'SQL',
  'Problem Solving',
];

export const ResourcesPage: React.FC = () => {
  const { resources, can, currentUser, completedResourceIds, toggleResourceCompleted } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFilter = (searchParams.get('q') || '').trim();
  const [selectedTrack, setSelectedTrack] = useState<'All' | ResourceTrack>('All');

  const canViewFull = can('canViewFullResources');

  const filtered = useMemo(() => {
    const qLower = queryFilter.toLowerCase();
    return resources.filter((r) => {
      if (selectedTrack !== 'All' && r.track !== selectedTrack) return false;
      if (qLower) {
        const hay = `${r.title} ${r.track} ${r.level} ${r.summary} ${(r.topics || []).join(' ')}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [resources, selectedTrack, queryFilter]);

  const unlockedCount = resources.filter((r) => canViewFull || r.access === 'basic').length;
  const completedCount = resources.filter((r) => completedResourceIds.includes(r.id)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <PageSeo
        title={queryFilter ? `Roadmap: "${queryFilter}"` : 'Learning Roadmap & Practice Sheets'}
        description={`Explore ${resources.length} curated practice tracks across DSA, Python, Java, SQL, and Problem Solving by HackerRank Campus Crew at Paavai Engineering College.`}
        canonicalPath="/resources"
        image={CHAPTER_IMAGES.dsaWorkshop}
        keywords={['DSA Roadmap', 'Python Track', 'Java Practice', 'SQL Problems', 'Paavai']}
      />
      <header className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
              Curated Curriculum · 5 Core Tracks
            </p>
            <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Learning Roadmap & Practice Sheets
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              {canViewFull
                ? 'Full member access unlocked: complete intermediate & advanced modules across DSA, Python, Java, SQL, and Problem Solving.'
                : 'Guests can access foundational Beginner modules. Log in as a community member to unlock intermediate, advanced, and placement sheets.'}
            </p>
          </div>

          {currentUser && (
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] min-w-[220px]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400">Roadmap Progress</span>
                <span className="font-semibold text-[#009942] dark:text-[#00EA64] tabular-nums">
                  {completedCount} / {resources.length}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[#00EA64] transition-all duration-300"
                  style={{
                    width: `${resources.length ? Math.round((completedCount / resources.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Track Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {TRACKS.map((track) => (
            <button
              key={track}
              type="button"
              onClick={() => setSelectedTrack(track)}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedTrack === track
                  ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                  : 'bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#00EA64]/60'
              }`}
            >
              {track}
            </button>
          ))}
        </div>
      </header>

      {queryFilter && (
        <div className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-600 dark:text-slate-300">
            Showing roadmap modules matching <strong className="text-slate-900 dark:text-white">&quot;{queryFilter}&quot;</strong> ({filtered.length})
          </span>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('q');
              setSearchParams(next);
            }}
            className="text-[#009942] dark:text-[#00EA64] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear filter</span>
          </button>
        </div>
      )}

      {/* Resource Access Banner for Guests */}
      {!canViewFull && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                Basic Roadmap Preview ({unlockedCount} of {resources.length} modules unlocked)
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Sign in with your Paavai member account to unlock Trees, Graphs, Dynamic
                Programming, SQL Window Functions, and the 50-Problem Placement Sprint.
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="px-4 py-2 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Sign In to Unlock All
          </Link>
        </div>
      )}

      {/* Roadmap Modules Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {resources.length === 0
              ? 'No learning roadmap modules have been published yet.'
              : 'No learning modules found for this track.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((res, index) => {
          const isLocked = res.access === 'full' && !canViewFull;
          const isCompleted = completedResourceIds.includes(res.id);

          return (
            <article
              key={res.id}
              className={`p-6 rounded-xl border bg-white dark:bg-[#121821] flex flex-col justify-between gap-5 transition-colors ${
                isLocked
                  ? 'border-slate-200/80 dark:border-slate-800/70 opacity-85'
                  : 'border-slate-200 dark:border-slate-800 hover:border-[#00EA64]/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span>
                    {String(index + 1).padStart(2, '0')}. {res.track} · {res.level}
                  </span>
                  <span className="tabular-nums">
                    {res.problemCount} problems · {res.estimatedHours}h
                  </span>
                </div>

                <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {res.title}
                </h2>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {res.summary}
                </p>

                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                  Topics: {res.topics.join(' · ')}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                {isLocked ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      Members Only
                    </span>
                    <Link
                      to="/login"
                      className="text-xs font-mono font-semibold text-[#009942] dark:text-[#00EA64] hover:underline"
                    >
                      Login to access →
                    </Link>
                  </>
                ) : (
                  <>
                    {currentUser ? (
                      <button
                        type="button"
                        onClick={() => toggleResourceCompleted(res.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          isCompleted
                            ? 'text-[#009942] dark:text-[#00EA64]'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                        <span>{isCompleted ? 'Completed' : 'Mark complete'}</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        Open Starter Module
                      </span>
                    )}

                    <a
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-white hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Open Practice</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      )}
    </div>
  );
};
