import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Code2, Image as ImageIcon, ShieldCheck, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MemberAvatar } from '../components/MemberAvatar';
import { PageSeo, toAbsoluteUrl } from '../components/PageSeo';
import { CHAPTER_IMAGES } from '../config/rbacAndData';

export const TeamPage: React.FC = () => {
  const { teamMembers, publicProfiles, currentUser } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFilter = (searchParams.get('q') || '').trim();
  const qLower = queryFilter.toLowerCase();

  const photoByUid = useMemo(() => {
    const map = new Map<string, string>();
    publicProfiles.forEach((p) => {
      if (p.photoUrl) {
        map.set(p.uid, p.photoUrl);
      }
    });
    return map;
  }, [publicProfiles]);

  const enrichedMembers = useMemo(
    () =>
      teamMembers.map((m) => ({
        ...m,
        photoUrl: m.photoUrl || photoByUid.get(m.uid) || '',
      })),
    [teamMembers, photoByUid]
  );

  const visibleMembers = qLower
    ? enrichedMembers.filter((m) =>
        `${m.name} ${m.designation} ${m.department} ${m.year} ${m.hackerRankHandle} ${m.bio}`
          .toLowerCase()
          .includes(qLower)
      )
    : enrichedMembers;

  const leads = visibleMembers
    .filter((m) => m.role === 'lead')
    .sort((a, b) => a.name.localeCompare(b.name));
  const crewMembers = visibleMembers
    .filter((m) => m.role === 'crew')
    .sort((a, b) => a.name.localeCompare(b.name));

  const isLeaderOrCrew =
    currentUser?.role === 'lead' || currentUser?.role === 'crew';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-14">
      <PageSeo
        title={queryFilter ? `Campus Crew matching "${queryFilter}"` : 'Meet the Campus Crew'}
        description={`Meet the ${leads.length + crewMembers.length} Campus Lead and Campus Crew mentors leading competitive programming at Paavai Engineering College.`}
        canonicalPath="/team"
        image={leads[0]?.photoUrl || CHAPTER_IMAGES.leadPortrait}
        keywords={['Campus Lead', 'Campus Crew', 'Student Mentors', 'Paavai Engineering College']}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'HackerRank Campus Crew Team Roster',
          itemListElement: enrichedMembers.map((m, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: toAbsoluteUrl(`/members/${encodeURIComponent(m.uid || m.id)}`),
            name: `${m.name} (${m.designation})`,
          })),
        }}
      />
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-2xl space-y-3">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Chapter Leadership · Paavai Engineering College
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Meet the Campus Crew
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Public live roster of our Campus Lead and Campus Crew mentors organizing contests,
            leading coding workshops, and supporting peers — always visible to all visitors.
          </p>
        </div>

        {isLeaderOrCrew && (
          <Link
            to="/profile"
            className="px-3.5 py-2 rounded-lg text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Update My Photo URL</span>
          </Link>
        )}
      </header>

      {queryFilter && (
        <div className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-600 dark:text-slate-300">
            Showing team members matching{' '}
            <strong className="text-slate-900 dark:text-white">&quot;{queryFilter}&quot;</strong> (
            {visibleMembers.length})
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

      {queryFilter && visibleMembers.length === 0 ? (
        <div className="p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-center space-y-2">
          <Users className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
            No matching Campus Lead or Crew members found
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try clearing the filter or searching by another name, department, or HackerRank handle.
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
              <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500 dark:text-slate-400">
                No Campus Lead profile published yet. Once the Campus Lead signs in, their live
                profile and photo appear here automatically for all visitors.
              </p>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <article
                    key={lead.id}
                    className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col md:flex-row md:items-center gap-6"
                  >
                    <MemberAvatar
                      name={lead.name}
                      photoUrl={lead.photoUrl}
                      variant="lead"
                      sizeClass="w-20 h-20 sm:w-24 sm:h-24"
                      textClass="text-2xl"
                    />
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64]">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {lead.designation} · {lead.department} · {lead.year}
                        </span>
                      </div>
                      <h3 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                        <Link
                          to={`/members/${encodeURIComponent(lead.uid || lead.id)}`}
                          className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                        >
                          {lead.name}
                        </Link>
                      </h3>
                      {lead.bio && (
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                          {lead.bio}
                        </p>
                      )}
                      <div className="pt-2 flex flex-wrap items-center gap-4">
                        {lead.hackerRankHandle && (
                          <p className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                            <Code2 className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                            <span>HackerRank: {lead.hackerRankHandle}</span>
                          </p>
                        )}
                        <Link
                          to={`/members/${encodeURIComponent(lead.uid || lead.id)}`}
                          className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
                        >
                          View Profile →
                        </Link>
                      </div>
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
              <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500 dark:text-slate-400">
                No Campus Crew members have been assigned yet. Verified students promoted to Crew by
                the Campus Lead appear here automatically in real time.
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
                        <MemberAvatar
                          name={member.name}
                          photoUrl={member.photoUrl}
                          variant="crew"
                          sizeClass="w-14 h-14"
                          textClass="text-base"
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#009942] dark:text-[#00EA64]">
                            {member.designation}
                          </p>
                          <h3 className="font-mono text-lg font-bold text-slate-900 dark:text-white truncate">
                            <Link
                              to={`/members/${encodeURIComponent(member.uid || member.id)}`}
                              className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                            >
                              {member.name}
                            </Link>
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

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                      {member.hackerRankHandle ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                          <Code2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64] shrink-0" aria-hidden="true" />
                          <span className="truncate">{member.hackerRankHandle}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">Crew Mentor</span>
                      )}
                      <Link
                        to={`/members/${encodeURIComponent(member.uid || member.id)}`}
                        className="text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
                      >
                        Profile →
                      </Link>
                    </div>
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
