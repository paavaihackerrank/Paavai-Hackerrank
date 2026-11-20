import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Code2, ShieldCheck, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const TeamPage: React.FC = () => {
  const { teamMembers } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFilter = (searchParams.get('q') || '').trim();
  const qLower = queryFilter.toLowerCase();

  const visibleMembers = qLower
    ? teamMembers.filter((m) =>
        `${m.name} ${m.designation} ${m.department} ${m.year} ${m.hackerRankHandle} ${m.bio}`
          .toLowerCase()
          .includes(qLower)
      )
    : teamMembers;

  const leads = visibleMembers
    .filter((m) => m.role === 'lead')
    .sort((a, b) => a.name.localeCompare(b.name));
  const crewMembers = visibleMembers
    .filter((m) => m.role === 'crew')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-14">
      <header className="max-w-2xl space-y-3">
        <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
          Chapter Leadership · Paavai Engineering College
        </p>
        <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          Meet the Campus Crew
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          Live roster of verified Campus Leads and Campus Crew members actively organizing
          competitions, mentoring peers, and curating coding roadmaps across campus.
        </p>
      </header>

      {queryFilter && (
        <div className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-600 dark:text-slate-300">
            Showing team members matching <strong className="text-slate-900 dark:text-white">&quot;{queryFilter}&quot;</strong> ({visibleMembers.length})
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

      {visibleMembers.length === 0 ? (
        <div className="p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-center space-y-2">
          <Users className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
            No leadership profiles published yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Campus Lead and promoted Campus Crew members appear here automatically in real time.
          </p>
        </div>
      ) : (
        <>
          {/* Campus Lead Section */}
          <section aria-labelledby="campus-lead-heading" className="space-y-4">
            <h2
              id="campus-lead-heading"
              className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400"
            >
              01. Campus Lead{leads.length === 1 ? '' : 's'} ({leads.length})
            </h2>
            {leads.length === 0 ? (
              <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500">
                No Campus Lead profile listed yet.
              </p>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <article
                    key={lead.id}
                    className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col md:flex-row md:items-center gap-6"
                  >
                    <div className="w-20 h-20 rounded-xl bg-[#00EA64]/15 border border-[#00EA64]/40 text-[#009942] dark:text-[#00EA64] flex items-center justify-center font-mono text-2xl font-bold shrink-0">
                      {getInitials(lead.name)}
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64]">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {lead.designation} · {lead.department} · {lead.year}
                        </span>
                      </div>
                      <h3 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                        {lead.name}
                      </h3>
                      {lead.bio && (
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                          {lead.bio}
                        </p>
                      )}
                      {lead.hackerRankHandle && (
                        <p className="pt-2 inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                          <Code2 className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                          <span>HackerRank: {lead.hackerRankHandle}</span>
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Campus Crew Grid */}
          <section aria-labelledby="crew-members-heading" className="space-y-5">
            <h2
              id="crew-members-heading"
              className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400"
            >
              02. Campus Crew Members ({crewMembers.length})
            </h2>
            {crewMembers.length === 0 ? (
              <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500">
                No Campus Crew members have been assigned yet. Verified students promoted to Crew by
                the Campus Lead appear here automatically.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {crewMembers.map((member) => (
                  <article
                    key={member.id}
                    className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 flex items-center justify-center font-mono text-sm font-bold shrink-0">
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#009942] dark:text-[#00EA64]">
                            {member.designation}
                          </p>
                          <h3 className="font-mono text-lg font-bold text-slate-900 dark:text-white truncate">
                            {member.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {member.department} · {member.year}
                          </p>
                        </div>
                      </div>
                      {member.bio && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {member.bio}
                        </p>
                      )}
                    </div>

                    {member.hackerRankHandle && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <Code2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                        <span>{member.hackerRankHandle}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
