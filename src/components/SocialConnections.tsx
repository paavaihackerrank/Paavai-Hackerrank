import React, { useEffect, useState } from 'react';
import { CheckCircle2, Code2, ExternalLink, Github, Globe, Linkedin } from 'lucide-react';
import { UserAccount } from '../config/rbacAndData';

interface SocialConnectionsProps {
  user: UserAccount;
  onSave: (updates: {
    hackerRankHandle: string;
    hackerRankUrl: string;
    githubUrl: string;
    linkedinUrl: string;
  }) => Promise<void>;
}

function normalizeSocialUrl(raw: string, fallbackBase?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('.')) return `https://${trimmed}`;
  if (fallbackBase) {
    return `${fallbackBase}${trimmed.replace(/^@/, '')}`;
  }
  return `https://${trimmed}`;
}

function isSafeHttpUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * 'Social Connections' section on ProfilePage allowing members to link their
 * HackerRank, GitHub, and LinkedIn profiles to showcase their technical portfolio.
 */
export const SocialConnections: React.FC<SocialConnectionsProps> = ({
  user,
  onSave,
}) => {
  const [hackerRankUrl, setHackerRankUrl] = useState(
    user.hackerRankUrl ||
      (user.hackerRankHandle && user.hackerRankHandle !== '@paavai_coder'
        ? `https://www.hackerrank.com/profile/${user.hackerRankHandle.replace(/^@/, '')}`
        : '')
  );
  const [githubUrl, setGithubUrl] = useState(user.githubUrl ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedinUrl ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHackerRankUrl(
      user.hackerRankUrl ||
        (user.hackerRankHandle && user.hackerRankHandle !== '@paavai_coder'
          ? `https://www.hackerrank.com/profile/${user.hackerRankHandle.replace(/^@/, '')}`
          : '')
    );
    setGithubUrl(user.githubUrl ?? '');
    setLinkedinUrl(user.linkedinUrl ?? '');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normHR = normalizeSocialUrl(
      hackerRankUrl,
      'https://www.hackerrank.com/profile/'
    );
    const normGH = normalizeSocialUrl(githubUrl, 'https://github.com/');
    const normLI = normalizeSocialUrl(linkedinUrl, 'https://www.linkedin.com/in/');

    if (!isSafeHttpUrl(normHR) || !isSafeHttpUrl(normGH) || !isSafeHttpUrl(normLI)) {
      setError('Enter valid http(s) URLs or usernames for your social profiles.');
      return;
    }

    // Derive clean handle from HackerRank URL if provided
    let derivedHandle = user.hackerRankHandle || '';
    if (normHR) {
      const parts = normHR.replace(/\/+$/, '').split('/');
      const slug = parts[parts.length - 1];
      if (slug) derivedHandle = slug.startsWith('@') ? slug : `@${slug}`;
    }

    setError('');
    setSaving(true);
    await onSave({
      hackerRankHandle: derivedHandle,
      hackerRankUrl: normHR,
      githubUrl: normGH,
      linkedinUrl: normLI,
    });
    setHackerRankUrl(normHR);
    setGithubUrl(normGH);
    setLinkedinUrl(normLI);
    setSaving(false);
  };

  const links = [
    {
      label: 'HackerRank',
      url: user.hackerRankUrl || '',
      icon: Code2,
      connected: Boolean(user.hackerRankUrl),
    },
    {
      label: 'GitHub',
      url: user.githubUrl || '',
      icon: Github,
      connected: Boolean(user.githubUrl),
    },
    {
      label: 'LinkedIn',
      url: user.linkedinUrl || '',
      icon: Linkedin,
      connected: Boolean(user.linkedinUrl),
    },
  ];

  const connectedCount = links.filter((l) => l.connected).length;

  return (
    <section
      aria-labelledby="social-connections-heading"
      className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Technical Portfolio · Public Showcase</span>
          </p>
          <h2
            id="social-connections-heading"
            className="font-mono text-xl font-bold text-slate-900 dark:text-white"
          >
            Social Connections ({connectedCount} / 3 Linked)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {links.map((item) => {
            const Icon = item.icon;
            return item.connected ? (
              <a
                key={item.label}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono border border-[#00EA64]/40 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] inline-flex items-center gap-1.5 hover:bg-[#00EA64]/20 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{item.label}</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            ) : (
              <span
                key={item.label}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 text-slate-400 inline-flex items-center gap-1.5"
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="social-hackerrank"
              className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
                <span>HackerRank Profile</span>
              </span>
              {user.hackerRankUrl && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
              )}
            </label>
            <input
              id="social-hackerrank"
              type="text"
              value={hackerRankUrl}
              onChange={(e) => setHackerRankUrl(e.target.value)}
              placeholder="https://www.hackerrank.com/profile/username"
              className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label
              htmlFor="social-github"
              className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <span>GitHub Profile</span>
              </span>
              {user.githubUrl && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
              )}
            </label>
            <input
              id="social-github"
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username"
              className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label
              htmlFor="social-linkedin"
              className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>LinkedIn Profile</span>
              </span>
              {user.linkedinUrl && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" />
              )}
            </label>
            <input
              id="social-linkedin"
              type="text"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/username"
              className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Linked technical profiles are displayed on your public community portfolio and weekly
            Member Spotlight.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving Links...' : 'Save Social Connections'}
          </button>
        </div>
      </form>
    </section>
  );
};
