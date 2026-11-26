import React from 'react';
import { Link } from 'react-router-dom';
import {
  Code2,
  ExternalLink,
  Github,
  Instagram,
  Linkedin,
  Terminal,
  Youtube,
} from 'lucide-react';
import { ROLE_META } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

export const Footer: React.FC = () => {
  const { currentUser, currentRole, siteSettings } = useApp();

  const hackerRankUrl =
    siteSettings.hackerRankClubUrl && /^https?:\/\//i.test(siteSettings.hackerRankClubUrl)
      ? siteSettings.hackerRankClubUrl
      : 'https://www.hackerrank.com/community';

  const socialProfiles = [
    {
      name: 'Instagram',
      handle: '@hackerrank',
      href: 'https://www.instagram.com/hackerrank/',
      icon: Instagram,
      ariaLabel: 'Follow HackerRank Campus Crew on Instagram (opens in a new tab)',
    },
    {
      name: 'LinkedIn',
      handle: 'HackerRank',
      href: 'https://www.linkedin.com/company/hackerrank/',
      icon: Linkedin,
      ariaLabel: 'Connect with HackerRank Campus Crew on LinkedIn (opens in a new tab)',
    },
    {
      name: 'GitHub',
      handle: 'hackerrank',
      href: 'https://github.com/hackerrank',
      icon: Github,
      ariaLabel: 'Explore HackerRank repositories on GitHub (opens in a new tab)',
    },
    {
      name: 'YouTube',
      handle: '@HackerRankOfficial',
      href: 'https://www.youtube.com/@HackerRankOfficial',
      icon: Youtube,
      ariaLabel: 'Watch HackerRank Campus Crew sessions on YouTube (opens in a new tab)',
    },
    {
      name: 'HackerRank',
      handle: 'Community Portal',
      href: hackerRankUrl,
      icon: Code2,
      ariaLabel: 'Open official HackerRank community page (opens in a new tab)',
    },
  ];

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0D1219] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-200 dark:border-slate-800">
          {/* Brand & Campus Info */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5 font-mono text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-md bg-[#00EA64] text-[#0B0F14] flex items-center justify-center shrink-0">
                <Terminal className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span>
                {siteSettings.chapterName} – {siteSettings.collegeName}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              {siteSettings.tagline} Official student-driven algorithmic programming and interview
              preparation chapter at {siteSettings.collegeName}.
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {siteSettings.campusLocation} · {siteSettings.contactEmail}
            </p>
          </div>

          {/* Explore Links */}
          <div className="md:col-span-2">
            <h3 className="font-mono text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Explore
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link
                  to="/events"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  Events &amp; Contests
                </Link>
              </li>
              <li>
                <Link
                  to="/leaderboard"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  Campus Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  to="/resources"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  Learning Roadmap
                </Link>
              </li>
              <li>
                <Link
                  to="/gallery"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  Event Gallery
                </Link>
              </li>
              <li>
                <Link
                  to="/certificates"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  Verify E-Certificate
                </Link>
              </li>
            </ul>
          </div>

          {/* Community Links */}
          <div className="md:col-span-2">
            <h3 className="font-mono text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Community
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link
                  to="/team"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  Crew &amp; Leadership
                </Link>
              </li>
              {siteSettings.applicationsOpen && (
                <li>
                  <Link
                    to="/join"
                    className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                  >
                    Request to Join
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to="/contact"
                  className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                >
                  FAQ &amp; Contact
                </Link>
              </li>
              {currentUser && (
                <li>
                  <Link
                    to="/profile"
                    className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                  >
                    My Profile
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Official HackerRank Campus Crew Social Profiles */}
          <div className="md:col-span-3">
            <h3 className="font-mono text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Official Socials
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {socialProfiles.map((profile) => {
                const Icon = profile.icon;
                return (
                  <li key={profile.name}>
                    <a
                      href={profile.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={profile.ariaLabel}
                      className="group inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors whitespace-nowrap"
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-[#009942] dark:group-hover:text-[#00EA64]">
                        {profile.name}
                      </span>
                      <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                        ·
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {profile.handle}
                      </span>
                      <ExternalLink
                        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            Made by the HackerRank Campus Crew, Paavai Engineering College
          </p>
          <p className="font-mono">
            {currentUser
              ? `Signed in: ${ROLE_META[currentRole].label}`
              : 'Paavai Engineering College · Verified Portal'}
          </p>
        </div>
      </div>
    </footer>
  );
};
