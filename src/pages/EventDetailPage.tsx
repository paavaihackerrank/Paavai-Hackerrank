import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  QrCode,
  Share2,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SafeImage } from '../components/SafeImage';
import { PageSeo, SITE_NAME, toAbsoluteUrl } from '../components/PageSeo';

function formatCountdown(targetISO: string, nowMs: number) {
  const diff = new Date(targetISO).getTime() - nowMs;
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    events,
    registrations,
    currentUser,
    can,
    siteSettings,
    registerForEvent,
    cancelRegistration,
    addToast,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const event = useMemo(() => {
    if (!eventId) return undefined;
    const found = events.find((e) => e.id === eventId);
    if (!found) return undefined;
    const isCrewOrLead = currentUser?.role === 'lead' || currentUser?.role === 'crew';
    if (found.status !== 'approved' && !isCrewOrLead) return undefined;
    return found;
  }, [events, eventId, currentUser?.role]);

  const handleCopyShareLink = async () => {
    try {
      const shareUrl =
        typeof window !== 'undefined' ? window.location.href : `/events/${eventId || ''}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      addToast('Event link copied', 'Share this event page with your classmates.', 'success');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      addToast('Copy failed', 'Copy the URL directly from your browser address bar.', 'info');
    }
  };

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-6">
        <PageSeo
          title="Event Not Found"
          description="This HackerRank Campus Crew event could not be found or is awaiting Campus Lead approval."
          noIndex
        />
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to All Events</span>
        </Link>

        <div className="p-8 sm:p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-center space-y-3">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            Event Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            The requested event does not exist or has not been published yet. Browse upcoming coding
            contests and workshops on the Events schedule.
          </p>
          <div className="pt-2">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors"
            >
              Browse Events Schedule
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const countdown = formatCountdown(event.dateISO, nowMs);
  const isPast = !countdown;
  const regCount = registrations.filter((r) => r.eventId === event.id).length;
  const isRegistered = Boolean(
    currentUser && registrations.some((r) => r.eventId === event.id && r.userId === currentUser.id)
  );
  const formattedDate = new Date(event.dateISO).toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const eventUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/events/${encodeURIComponent(event.id)}`
      : `/events/${encodeURIComponent(event.id)}`;

  const eventSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate: event.dateISO,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    isAccessibleForFree: true,
    url: eventUrl,
    image: [toAbsoluteUrl(event.bannerImage)],
    location: {
      '@type': 'Place',
      name: event.venue,
      address: {
        '@type': 'PostalAddress',
        streetAddress: siteSettings.campusLocation,
        addressLocality: 'Namakkal',
        addressRegion: 'Tamil Nadu',
        postalCode: '637018',
        addressCountry: 'IN',
      },
    },
    organizer: {
      '@type': 'EducationalOrganization',
      name: SITE_NAME,
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <PageSeo
        title={`${event.title} – ${event.category}`}
        description={`${event.category} at ${event.venue} on ${formattedDate}. ${event.description}`}
        canonicalPath={`/events/${encodeURIComponent(event.id)}`}
        type="article"
        image={event.bannerImage}
        imageAlt={`${event.title} event banner`}
        keywords={[
          event.title,
          event.category,
          event.venue,
          event.membersOnly ? 'Members Only Event' : 'Open Campus Event',
        ]}
        article={{
          publishedTime: event.dateISO,
          section: event.category,
          tags: [event.category, event.venue, 'Paavai Engineering College'],
        }}
        noIndex={event.status !== 'approved'}
        structuredData={eventSchema}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to All Events</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/checkin"
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>QR Check-In</span>
          </Link>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            )}
            <span>{copiedLink ? 'Link Copied' : 'Share Event'}</span>
          </button>
        </div>
      </div>

      <article className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
        <div className="aspect-[16/8] sm:aspect-[16/7] relative overflow-hidden bg-slate-900">
          <SafeImage
            src={event.bannerImage}
            alt={event.title}
            className="w-full h-full object-cover"
            fallbackTitle={event.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14]/90 via-[#0B0F14]/30 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-semibold text-[#00EA64]">
                {event.category} · {event.membersOnly ? 'Members Only' : 'Open Campus Event'}
                {event.status !== 'approved' ? ` · ${event.status.toUpperCase()} PREVIEW` : ''}
              </p>
              <h1 className="font-mono text-2xl sm:text-4xl font-bold text-white">
                {event.title}
              </h1>
            </div>
            <span className="px-3 py-1.5 rounded-lg bg-[#0B0F14]/80 border border-slate-700 font-mono text-xs text-slate-200 tabular-nums">
              {regCount} / {event.capacity} seats filled
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-1">
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                <span>Date & Time</span>
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                {formattedDate}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-1">
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                <span>Campus Venue</span>
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                {event.venue}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-1">
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                <span>Event Host</span>
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                {event.createdByName}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
              About This Event
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {event.description}
            </p>
          </div>

          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {countdown ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <Clock className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                  <span>Starts in</span>
                </span>
                <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-semibold tabular-nums text-slate-900 dark:text-white">
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
                Event completed · Check Gallery for highlights
              </p>
            )}

            <div>
              {isPast ? (
                <span className="text-xs font-mono text-slate-500">Registration closed</span>
              ) : isRegistered ? (
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#009942] dark:text-[#00EA64]">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    Registered
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelRegistration(event.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
                  >
                    Cancel Seat
                  </button>
                </div>
              ) : !currentUser ? (
                <Link
                  to={`/login?redirect=/events/${encodeURIComponent(event.id)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign in to Register</span>
                </Link>
              ) : can('canRegisterForEvents') ? (
                <button
                  type="button"
                  disabled={regCount >= event.capacity}
                  onClick={() => registerForEvent(event.id)}
                  className="px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 transition-colors"
                >
                  {regCount >= event.capacity ? 'Event Full' : 'Register Seat'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};
