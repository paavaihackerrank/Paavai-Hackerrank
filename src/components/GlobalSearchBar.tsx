import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

type SearchScope = 'all' | 'events' | 'resources' | 'members';

interface SearchResultItem {
  id: string;
  scope: Exclude<SearchScope, 'all'>;
  title: string;
  subtitle: string;
  tags: string[];
  to?: string;
  memberModal?: {
    name: string;
    department: string;
    year: string;
    bio: string;
    hackerRankHandle?: string;
    hackerRankUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    skills: string[];
    completedDsaCount?: number;
    completedRoadmapCount?: number;
  };
}

const normalize = (v?: string) => (v || '').trim().toLowerCase().replace(/^@/, '');

export const GlobalSearchBar: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const {
    events,
    resources,
    teamMembers,
    publicProfiles,
    leaderboard,
    can,
    siteSettings,
  } = useApp();

  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const [queryText, setQueryText] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedMemberModal, setSelectedMemberModal] =
    useState<SearchResultItem['memberModal'] | null>(null);

  const canViewFullResources = can('canViewFullResources');
  const canViewFullLeaderboard = can('canViewFullLeaderboard');

  // Build searchable catalog from live Firestore collections (strictly RBAC-safe, non-PII)
  const catalog = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];

    // 1. Approved Events
    events
      .filter((ev) => ev.status === 'approved')
      .forEach((ev) => {
        const formattedDate = new Date(ev.dateISO).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        items.push({
          id: `evt_${ev.id}`,
          scope: 'events',
          title: ev.title,
          subtitle: `${ev.category} · ${formattedDate} · ${ev.venue}`,
          tags: [ev.category, ev.venue, ev.membersOnly ? 'Members Only' : 'Open'],
          to: `/events?q=${encodeURIComponent(ev.title)}`,
        });
      });

    // 2. Visible Learning Roadmap Modules
    resources
      .filter((res) => canViewFullResources || res.access === 'basic')
      .forEach((res) => {
        items.push({
          id: `res_${res.id}`,
          scope: 'resources',
          title: res.title,
          subtitle: `${res.track} · ${res.level} · ${res.problemCount} problems`,
          tags: [res.track, res.level, ...(res.topics || [])],
          to: `/resources?q=${encodeURIComponent(res.title)}`,
        });
      });

    // 3. Community Members (deduplicated across teamMembers, publicProfiles, and visible leaderboard)
    const memberMap = new Map<string, SearchResultItem>();

    teamMembers.forEach((tm) => {
      const key = normalize(tm.name);
      memberMap.set(key, {
        id: `tm_${tm.id}`,
        scope: 'members',
        title: tm.name,
        subtitle: `${tm.designation} · ${tm.department} · ${tm.year}`,
        tags: [
          tm.designation,
          tm.department,
          tm.year,
          tm.hackerRankHandle || '',
          tm.role === 'lead' ? 'Campus Lead' : 'Campus Crew',
        ].filter(Boolean),
        to: `/team?q=${encodeURIComponent(tm.name)}`,
      });
    });

    const visibleLeaderboard = canViewFullLeaderboard
      ? [...leaderboard].sort((a, b) => b.score - a.score)
      : [...leaderboard]
          .sort((a, b) => b.score - a.score)
          .slice(0, siteSettings.publicLeaderboardLimit);

    visibleLeaderboard.forEach((lb, idx) => {
      const key = normalize(lb.name);
      const existing = memberMap.get(key);
      if (existing) {
        existing.tags = Array.from(
          new Set([...existing.tags, lb.hackerRankHandle, `Rank #${idx + 1}`].filter(Boolean))
        );
      } else {
        memberMap.set(key, {
          id: `lb_${lb.id}`,
          scope: 'members',
          title: lb.name,
          subtitle: `Rank #${idx + 1} · ${lb.department} · ${lb.hackerRankHandle}`,
          tags: [lb.department, lb.year, lb.hackerRankHandle, 'Leaderboard'].filter(Boolean),
          to: `/leaderboard?q=${encodeURIComponent(lb.name)}`,
        });
      }
    });

    publicProfiles.forEach((pp) => {
      const key = normalize(pp.name);
      const existing = memberMap.get(key);
      if (existing) {
        existing.tags = Array.from(
          new Set([
            ...existing.tags,
            ...(pp.skills || []),
            pp.hackerRankHandle || '',
          ].filter(Boolean))
        );
      } else {
        memberMap.set(key, {
          id: `pp_${pp.id}`,
          scope: 'members',
          title: pp.name,
          subtitle: `${pp.department} · ${pp.year}${pp.hackerRankHandle ? ` · ${pp.hackerRankHandle}` : ''}`,
          tags: [
            pp.department,
            pp.year,
            pp.hackerRankHandle || '',
            ...(pp.skills || []),
          ].filter(Boolean),
          memberModal: {
            name: pp.name,
            department: pp.department,
            year: pp.year,
            bio: pp.bio,
            hackerRankHandle: pp.hackerRankHandle,
            hackerRankUrl: pp.hackerRankUrl,
            githubUrl: pp.githubUrl,
            linkedinUrl: pp.linkedinUrl,
            skills: pp.skills || [],
            completedDsaCount: pp.completedDsaCount,
            completedRoadmapCount: pp.completedRoadmapCount,
          },
        });
      }
    });

    items.push(...memberMap.values());
    return items;
  }, [
    events,
    resources,
    teamMembers,
    publicProfiles,
    leaderboard,
    canViewFullResources,
    canViewFullLeaderboard,
    siteSettings.publicLeaderboardLimit,
  ]);

  const filteredResults = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const scoped = scope === 'all' ? catalog : catalog.filter((item) => item.scope === scope);
    if (!q) {
      return scoped.slice(0, 8);
    }
    const terms = q.split(/\s+/).filter(Boolean);
    return scoped
      .filter((item) => {
        const haystack = `${item.title} ${item.subtitle} ${item.tags.join(' ')}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 12);
  }, [catalog, queryText, scope]);

  useEffect(() => {
    setActiveIndex(0);
  }, [queryText, scope]);

  // Global keyboard shortcuts: Cmd/Ctrl+K or '/' to focus, Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileModalOpen(true);
          window.setTimeout(() => mobileInputRef.current?.focus(), 20);
        } else {
          setDropdownOpen(true);
          inputRef.current?.focus();
        }
        return;
      }

      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileModalOpen(true);
          window.setTimeout(() => mobileInputRef.current?.focus(), 20);
        } else {
          setDropdownOpen(true);
          inputRef.current?.focus();
        }
        return;
      }

      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setMobileModalOpen(false);
        setSelectedMemberModal(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close desktop dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectResult = (item: SearchResultItem) => {
    setDropdownOpen(false);
    setMobileModalOpen(false);
    setQueryText('');
    onNavigate?.();

    if (item.to) {
      navigate(item.to);
    } else if (item.memberModal) {
      setSelectedMemberModal(item.memberModal);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
      }
    } else if (e.key === 'Enter' && filteredResults[activeIndex]) {
      e.preventDefault();
      selectResult(filteredResults[activeIndex]);
    }
  };

  const renderScopeIcon = (itemScope: SearchResultItem['scope']) => {
    if (itemScope === 'events') {
      return <Calendar className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0" aria-hidden="true" />;
    }
    if (itemScope === 'resources') {
      return <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />;
    }
    return <UserIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />;
  };

  const scopeLabel: Record<SearchResultItem['scope'], string> = {
    events: 'Event',
    resources: 'Roadmap',
    members: 'Member',
  };

  const renderResultsList = () => (
    <div className="space-y-2">
      {/* Scope Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter search results"
        className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800"
      >
        {(
          [
            ['all', 'All'],
            ['events', 'Events'],
            ['resources', 'Roadmap'],
            ['members', 'Members'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              scope === key
                ? 'bg-white dark:bg-[#121821] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Matches */}
      {filteredResults.length === 0 ? (
        <div className="py-6 px-3 text-center space-y-1">
          <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            No matching events, modules, or members
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Try searching by event title, track (DSA, SQL), skill tag, or member name.
          </p>
        </div>
      ) : (
        <ul role="listbox" aria-label="Search suggestions" className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredResults.map((item, idx) => {
            const isHighlighted = idx === activeIndex;
            return (
              <li key={item.id} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectResult(item)}
                  className={`w-full px-3 py-2.5 text-left flex items-start justify-between gap-3 rounded-md transition-colors ${
                    isHighlighted
                      ? 'bg-slate-100 dark:bg-[#192230]'
                      : 'hover:bg-slate-50 dark:hover:bg-[#161e2a]'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5">{renderScopeIcon(item.scope)}</span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                      {item.tags.length > 0 && (
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {item.tags.slice(0, 4).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                    {scopeLabel[item.scope]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <div ref={containerRef} className="relative flex items-center">
        {/* Desktop Inline Search Input */}
        <div className="hidden md:flex items-center relative">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={queryText}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => {
              setQueryText(e.target.value);
              setDropdownOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search events, modules, members..."
            aria-label="Global search for events, roadmap modules, or members"
            aria-expanded={dropdownOpen}
            className="w-48 lg:w-56 xl:w-60 h-9 pl-8 pr-12 rounded-md text-xs bg-slate-100/90 dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00EA64] transition-colors"
          />
          {queryText ? (
            <button
              type="button"
              onClick={() => {
                setQueryText('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="absolute right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-300 dark:border-slate-700 absolute right-2 pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Mobile Search Trigger Button */}
        <button
          type="button"
          onClick={() => {
            setMobileModalOpen(true);
            window.setTimeout(() => mobileInputRef.current?.focus(), 20);
          }}
          aria-label="Open global search"
          className="md:hidden w-9 h-9 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors shrink-0"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Desktop Results Popover */}
        {dropdownOpen && (
          <div className="hidden md:block absolute right-0 top-11 w-[420px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] shadow-2xl z-50">
            {renderResultsList()}
          </div>
        )}
      </div>

      {/* Mobile Search Overlay */}
      {mobileModalOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs p-4 pt-6 flex items-start justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Global Search"
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  ref={mobileInputRef}
                  type="search"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search events, modules, members..."
                  aria-label="Search events, roadmap modules, or members"
                  className="w-full h-10 pl-9 pr-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00EA64]"
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileModalOpen(false)}
                aria-label="Close search"
                className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderResultsList()}
          </div>
        </div>
      )}

      {/* Non-PII Community Member Quick Profile Modal (for Spotlight / PublicProfile results) */}
      {selectedMemberModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs p-4 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMemberModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedMemberModal.name} community profile`}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-mono text-xs text-[#009942] dark:text-[#00EA64]">
                  Community Member · {selectedMemberModal.department} · {selectedMemberModal.year}
                </p>
                <h3 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                  {selectedMemberModal.name}
                </h3>
                {selectedMemberModal.hackerRankHandle && (
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    HackerRank: {selectedMemberModal.hackerRankHandle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberModal(null)}
                aria-label="Close member preview"
                className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedMemberModal.bio && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedMemberModal.bio}
              </p>
            )}

            {(selectedMemberModal.completedRoadmapCount !== undefined ||
              selectedMemberModal.completedDsaCount !== undefined) && (
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {selectedMemberModal.completedRoadmapCount ?? 0} roadmap modules completed ·{' '}
                {selectedMemberModal.completedDsaCount ?? 0} DSA modules
              </p>
            )}

            {selectedMemberModal.skills.length > 0 && (
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                Skills: {selectedMemberModal.skills.join(' · ')}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {selectedMemberModal.hackerRankUrl && (
                <a
                  href={selectedMemberModal.hackerRankUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 hover:border-[#00EA64] inline-flex items-center gap-1"
                >
                  <span>HackerRank</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {selectedMemberModal.githubUrl && (
                <a
                  href={selectedMemberModal.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 hover:border-[#00EA64] inline-flex items-center gap-1"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {selectedMemberModal.linkedinUrl && (
                <a
                  href={selectedMemberModal.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 hover:border-[#00EA64] inline-flex items-center gap-1"
                >
                  <span>LinkedIn</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
