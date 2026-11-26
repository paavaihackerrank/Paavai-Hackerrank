import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Lock,
  MapPin,
  QrCode,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SafeImage } from '../components/SafeImage';
import { DriveDocumentViewer } from '../components/DriveDocumentViewer';
import { PageSeo, toAbsoluteUrl } from '../components/PageSeo';
import { CHAPTER_IMAGES, getEffectiveEventMode } from '../config/rbacAndData';

function formatCountdown(targetISO: string, nowMs: number) {
  const diff = new Date(targetISO).getTime() - nowMs;
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export const EventsPage: React.FC = () => {
  const {
    events,
    registrations,
    currentUser,
    can,
    registerForEvent,
    cancelRegistration,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const queryFilter = (searchParams.get('q') || '').trim();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'members' | 'past'>('all');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [viewerDoc, setViewerDoc] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Only approved events appear on the public Events page
  const approvedEvents = useMemo(
    () =>
      events
        .filter((e) => e.status === 'approved')
        .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const qLower = queryFilter.toLowerCase();
    return approvedEvents.filter((ev) => {
      const isUpcoming = new Date(ev.dateISO).getTime() > nowMs;
      if (filter === 'upcoming' && !isUpcoming) return false;
      if (filter === 'past' && isUpcoming) return false;
      if (filter === 'members' && !ev.membersOnly) return false;
      if (qLower) {
        const hay = `${ev.title} ${ev.category} ${ev.venue} ${ev.description}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [approvedEvents, filter, nowMs, queryFilter]);

  const nextEvent = approvedEvents.find((e) => new Date(e.dateISO).getTime() > nowMs) || approvedEvents[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <PageSeo
        title={queryFilter ? `Events matching "${queryFilter}"` : 'Events & Coding Sprints'}
        description={
          queryFilter
            ? `Browse ${filteredEvents.length} HackerRank Campus Crew coding events matching "${queryFilter}" at Paavai Engineering College.`
            : `Browse ${approvedEvents.length} upcoming coding contests, DSA workshops, and hackathons hosted by HackerRank Campus Crew at Paavai Engineering College.`
        }
        canonicalPath="/events"
        image={nextEvent?.bannerImage || CHAPTER_IMAGES.hackathonArena}
        keywords={['Coding Contests', 'DSA Workshops', 'Hackathons', 'Paavai Events']}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'HackerRank Campus Crew Events',
          itemListElement: approvedEvents.slice(0, 10).map((ev, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: toAbsoluteUrl(`/events/${encodeURIComponent(ev.id)}`),
            name: ev.title,
          })),
        }}
      />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Campus Schedule · Contests & Technical Labs
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Events & Coding Sprints
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Browse upcoming algorithmic contests, workshops, and bootcamps at Paavai Engineering
            College. Sign in to reserve your seat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <Link
            to="/checkin"
            className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-800 dark:text-slate-100 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <QrCode className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>QR Check-In</span>
          </Link>

          {/* Segmented Filter Control */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#121821] border border-slate-200 dark:border-slate-800">
            {(
              [
                ['all', 'All Events'],
                ['upcoming', 'Upcoming'],
                ['members', 'Members Only'],
                ['past', 'Past'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? 'bg-white dark:bg-[#1B2432] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {queryFilter && (
        <div className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-600 dark:text-slate-300">
            Showing events matching <strong className="text-slate-900 dark:text-white">&quot;{queryFilter}&quot;</strong> ({filteredEvents.length})
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

      {filteredEvents.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
            No events match this filter right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredEvents.map((ev) => {
            const countdown = formatCountdown(ev.dateISO, nowMs);
            const isPast = !countdown;
            const regCount = registrations.filter((r) => r.eventId === ev.id).length;
            const isRegistered = Boolean(
              currentUser &&
                registrations.some((r) => r.eventId === ev.id && r.userId === currentUser.id)
            );
            const isMembersBlockedForGuest = !currentUser;

            return (
              <article
                key={ev.id}
                className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col"
              >
                <div className="aspect-[16/9] relative overflow-hidden bg-slate-900">
                  <SafeImage
                    src={ev.bannerImage}
                    alt={ev.title}
                    className="w-full h-full object-cover"
                    fallbackTitle={ev.title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14]/85 via-[#0B0F14]/20 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-mono text-slate-200">
                    <span>
                      {ev.category}
                      {getEffectiveEventMode(ev) === 'online'
                        ? ' · Online'
                        : getEffectiveEventMode(ev) === 'hybrid'
                        ? ' · Hybrid'
                        : ''}{' '}
                      · {ev.membersOnly ? 'Members Only' : 'Open Event'}
                    </span>
                    <span className="tabular-nums">
                      {regCount} / {ev.capacity} seats
                    </span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <h2 className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                      <Link
                        to={`/events/${encodeURIComponent(ev.id)}`}
                        className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                      >
                        {ev.title}
                      </Link>
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {new Date(ev.dateISO).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        {ev.venue}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {ev.description}
                    </p>

                    {ev.unstopUrl && (
                      <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sky-800 dark:text-sky-300">
                          <span className="font-semibold">Unstop Synced</span>
                          {ev.unstopRegistrationsCount !== undefined && (
                            <span className="tabular-nums">
                              {ev.unstopRegistrationsCount.toLocaleString('en-IN')} registered
                            </span>
                          )}
                          {ev.unstopMode && <span>· {ev.unstopMode}</span>}
                          {ev.unstopPrize && <span>· Prize: {ev.unstopPrize}</span>}
                        </div>
                        <a
                          href={ev.unstopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono font-semibold text-sky-700 dark:text-sky-300 hover:underline whitespace-nowrap shrink-0"
                        >
                          <span>Unstop</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Live Countdown Timer */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    {countdown ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                          Starts in
                        </span>
                        <div className="flex items-center gap-3 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                          <span>{String(countdown.days).padStart(2, '0')}d</span>
                          <span className="text-slate-400">:</span>
                          <span>{String(countdown.hours).padStart(2, '0')}h</span>
                          <span className="text-slate-400">:</span>
                          <span>{String(countdown.minutes).padStart(2, '0')}m</span>
                          <span className="text-slate-400">:</span>
                          <span className="text-[#009942] dark:text-[#00EA64]">
                            {String(countdown.seconds).padStart(2, '0')}s
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        Event completed · Recap available in Gallery
                      </p>
                    )}

                    {/* Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          Host: {ev.createdByName}
                        </span>
                        {ev.documentUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewerDoc({
                                url: ev.documentUrl!,
                                title: `${ev.title} — Event Document`,
                                subtitle: `${ev.category} · ${ev.venue}`,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Event Doc</span>
                          </button>
                        )}
                        <Link
                          to={`/events/${encodeURIComponent(ev.id)}`}
                          className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap"
                        >
                          View Details →
                        </Link>
                      </div>

                      {isPast ? (
                        <span className="text-xs font-mono text-slate-500">Registration closed</span>
                      ) : isRegistered ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#009942] dark:text-[#00EA64]">
                            <CheckCircle2 className="w-4 h-4" />
                            Registered
                          </span>
                          <button
                            type="button"
                            onClick={() => cancelRegistration(ev.id)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isMembersBlockedForGuest ? (
                        <Link
                          to="/login"
                          className="px-4 py-2 rounded-md text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-[#00EA64] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Login to Register</span>
                        </Link>
                      ) : can('canRegisterForEvents') ? (
                        <button
                          type="button"
                          onClick={() => registerForEvent(ev.id)}
                          className="px-4 py-2 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors whitespace-nowrap shrink-0"
                        >
                          Register Now
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DriveDocumentViewer
        url={viewerDoc?.url ?? null}
        title={viewerDoc?.title}
        subtitle={viewerDoc?.subtitle}
        onClose={() => setViewerDoc(null)}
      />
    </div>
  );
};
