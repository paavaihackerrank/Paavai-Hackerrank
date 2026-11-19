import React from 'react';
import { Code2, Github, Linkedin } from 'lucide-react';
import { TEAM_MEMBERS } from '../config/rbacAndData';
import { SafeImage } from '../components/SafeImage';

export const TeamPage: React.FC = () => {
  const lead = TEAM_MEMBERS.find((m) => m.isLead);
  const crewMembers = TEAM_MEMBERS.filter((m) => !m.isLead);

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
          The student engineers who author weekly coding problems, mentor peers through DSA
          roadmaps, and organize HackerRank competitions across campus.
        </p>
      </header>

      {/* Featured Campus Lead Card */}
      {lead && (
        <section aria-labelledby="campus-lead-heading" className="space-y-4">
          <h2
            id="campus-lead-heading"
            className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400"
          >
            01. Campus Lead
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
            <div className="md:col-span-4 lg:col-span-3 aspect-square md:aspect-auto overflow-hidden bg-slate-900">
              <SafeImage
                src={lead.photo}
                alt={`${lead.name}, ${lead.designation}`}
                className={`w-full h-full object-cover ${lead.photoPosition ?? 'object-top'}`}
                fallbackTitle={lead.name}
              />
            </div>
            <div className="md:col-span-8 lg:col-span-9 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="text-xs font-mono text-[#009942] dark:text-[#00EA64]">
                  {lead.designation} · {lead.department} · {lead.year}
                </div>
                <h3 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  {lead.name}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {lead.bio}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
                <a
                  href={lead.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                >
                  <Github className="w-4 h-4" aria-hidden="true" />
                  <span>GitHub</span>
                </a>
                <a
                  href={lead.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                >
                  <Linkedin className="w-4 h-4" aria-hidden="true" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href={lead.hackerrank}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                >
                  <Code2 className="w-4 h-4" aria-hidden="true" />
                  <span>HackerRank</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Campus Crew Grid */}
      <section aria-labelledby="crew-members-heading" className="space-y-5">
        <h2
          id="crew-members-heading"
          className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400"
        >
          02. Campus Crew Members
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {crewMembers.map((member) => (
            <article
              key={member.id}
              className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col"
            >
              <div className="aspect-square overflow-hidden bg-slate-900">
                <SafeImage
                  src={member.photo}
                  alt={`${member.name}, ${member.designation}`}
                  className={`w-full h-full object-cover ${member.photoPosition ?? 'object-top'}`}
                  fallbackTitle={member.name}
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-[#009942] dark:text-[#00EA64]">
                    {member.designation}
                  </p>
                  <h3 className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {member.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {member.department} · {member.year}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                    {member.bio}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-mono">
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${member.name} on GitHub`}
                    className="text-slate-500 dark:text-slate-400 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${member.name} on LinkedIn`}
                    className="text-slate-500 dark:text-slate-400 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a
                    href={member.hackerrank}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${member.name} on HackerRank`}
                    className="text-slate-500 dark:text-slate-400 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                  >
                    <Code2 className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
