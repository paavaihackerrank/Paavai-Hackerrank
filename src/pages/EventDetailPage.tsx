import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Lock,
  MapPin,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import {
  CampusEvent,
  EventCertificate,
  EventRegistration,
  ROLE_META,
  buildAttendeeTicketCode,
  getEffectiveEventMode,
  isOnlineAttendanceEnabled,
  isOnlineEvent,
} from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { SafeImage } from '../components/SafeImage';
import { MemberAvatar } from '../components/MemberAvatar';
import { DriveDocumentViewer } from '../components/DriveDocumentViewer';
import { StudentEventTicketModal } from '../components/StudentEventTicketModal';
import { RsvpQrPassCard } from '../components/RsvpQrPassCard';
import { EventCountdownTimer } from '../components/EventCountdownTimer';
import {
  AttendeeFilterBar,
  AttendeeSortOption,
  AttendeeStatusFilter,
} from '../components/AttendeeFilterBar';
import { PageSeo, SITE_NAME, toAbsoluteUrl } from '../components/PageSeo';
import { downloadCertificatePng } from '../lib/certificateCanvas';
import { printEventNaacReport } from '../lib/eventReportPrint';

function isEventDatePast(targetISO?: string): boolean {
  if (!targetISO) return true;
  const targetMs = new Date(targetISO).getTime();
  if (!Number.isFinite(targetMs)) return true;
  return targetMs <= Date.now();
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function downloadEventIcs(event: CampusEvent, eventUrl: string, campusLocation: string): void {
  const start = new Date(event.dateISO);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const now = new Date();

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HRCC Paavai//Campus Event Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@paavai-hackerrank`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(`${event.title} — HRCC Paavai`)}`,
    `DESCRIPTION:${escapeIcsText(`${event.description}\n\nEvent Page: ${eventUrl}`)}`,
    `LOCATION:${escapeIcsText(`${event.venue}, ${campusLocation}`)}`,
    `URL:${eventUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeSlug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  link.download = `hrcc-paavai-${safeSlug || event.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    events,
    registrations,
    eventCheckIns,
    certificates,
    unstopParticipants,
    teamMembers,
    currentUser,
    can,
    siteSettings,
    registerForEvent,
    cancelRegistration,
    resendEventTicketEmail,
    crewCheckInAttendeeByTicket,
    markOnlineEventAttendance,
    toggleOnlineEventAttendance,
    claimParticipationCertificate,
    syncEventFromUnstop,
    approveEvent,
    rejectEvent,
    addToast,
  } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [activeTicketReg, setActiveTicketReg] = useState<EventRegistration | null>(null);
  const [syncingUnstop, setSyncingUnstop] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [togglingAttendance, setTogglingAttendance] = useState(false);
  const [resendingTicket, setResendingTicket] = useState(false);
  const [claimingCert, setClaimingCert] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<AttendeeStatusFilter>('all');
  const [attendeeDeptFilter, setAttendeeDeptFilter] = useState('all');
  const [attendeeYearFilter, setAttendeeYearFilter] = useState('all');
  const [attendeeSortBy, setAttendeeSortBy] = useState<AttendeeSortOption>('newest');
  const [checkingInRegId, setCheckingInRegId] = useState<string | null>(null);
  const [resendingRowId, setResendingRowId] = useState<string | null>(null);

  const resetAttendeeFilters = useCallback(() => {
    setAttendeeSearch('');
    setAttendeeStatusFilter('all');
    setAttendeeDeptFilter('all');
    setAttendeeYearFilter('all');
    setAttendeeSortBy('newest');
  }, []);

  const isCrewOrLead = currentUser?.role === 'lead' || currentUser?.role === 'crew';
  const isLead = can('canApproveContent');

  const event = useMemo(() => {
    if (!eventId) return undefined;
    const found = events.find((e) => e.id === eventId);
    if (!found) return undefined;
    if (found.status !== 'approved' && !isCrewOrLead) return undefined;
    return found;
  }, [events, eventId, isCrewOrLead]);

  const [isPast, setIsPast] = useState<boolean>(() => isEventDatePast(event?.dateISO));

  useEffect(() => {
    setIsPast(isEventDatePast(event?.dateISO));
  }, [event?.dateISO]);

  const handleCountdownExpire = useCallback(() => {
    setIsPast(true);
  }, []);

  const organizerMember = useMemo(() => {
    if (!event) return undefined;
    const targetName = event.createdByName.trim().toLowerCase();
    return teamMembers.find((tm) => tm.name.trim().toLowerCase() === targetName);
  }, [event, teamMembers]);

  const relatedEvents = useMemo(() => {
    if (!event) return [];
    return events
      .filter((e) => e.id !== event.id && e.status === 'approved')
      .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())
      .slice(0, 3);
  }, [events, event]);

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
            The requested event does not exist or is awaiting Campus Lead review. Browse published
            coding contests and workshops on the Events schedule.
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

  const effectiveMode = getEffectiveEventMode(event);
  const onlineEvent = isOnlineEvent(event);
  const onlineAttendanceOpen = isOnlineAttendanceEnabled(event);

  const eventRegs = registrations.filter((r) => r.eventId === event.id);
  const eventChecks = eventCheckIns.filter((c) => c.eventId === event.id);
  const eventCerts = certificates.filter((c) => c.eventId === event.id);
  const eventUnstopRows = unstopParticipants.filter((u) => u.eventId === event.id);
  const awardWinners = eventCerts.filter((c) => c.awardType !== 'Participation');

  const regCount = eventRegs.length;
  const remainingSeats = Math.max(0, event.capacity - regCount);
  const fillPercent = event.capacity > 0 ? Math.min(100, Math.round((regCount / event.capacity) * 100)) : 0;
  const turnoutPercent =
    regCount > 0 ? Math.min(100, Math.round((eventChecks.length / regCount) * 100)) : 0;

  const myRegistration = currentUser
    ? eventRegs.find((r) => r.userId === currentUser.id)
    : undefined;
  const myCheckIn = currentUser
    ? eventChecks.find((c) => c.userId === currentUser.id)
    : undefined;
  const myCertificate = currentUser
    ? eventCerts.find((c) => c.recipientUid === currentUser.id)
    : undefined;

  const isRegistered = Boolean(myRegistration);
  const isCheckedIn = Boolean(myCheckIn);

  const checkInByUserId = new Map(eventChecks.map((c) => [c.userId, c]));
  const checkedInRegsCount = eventRegs.reduce(
    (acc, reg) => acc + (checkInByUserId.has(reg.userId) ? 1 : 0),
    0
  );
  const pendingRegsCount = Math.max(0, eventRegs.length - checkedInRegsCount);

  const attendeeDepartmentFacets = Array.from(
    eventRegs.reduce((map, reg) => {
      const dept = reg.department.trim();
      if (dept) map.set(dept, (map.get(dept) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const attendeeYearFacets = Array.from(
    eventRegs.reduce((map, reg) => {
      const yr = reg.year.trim();
      if (yr) map.set(yr, (map.get(yr) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const searchTokens = attendeeSearch
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filteredEventAttendees = eventRegs
    .filter((reg) => {
      const checked = checkInByUserId.has(reg.userId);
      if (attendeeStatusFilter === 'checked_in' && !checked) return false;
      if (attendeeStatusFilter === 'pending' && checked) return false;
      if (attendeeDeptFilter !== 'all' && reg.department !== attendeeDeptFilter) return false;
      if (attendeeYearFilter !== 'all' && reg.year !== attendeeYearFilter) return false;
      if (searchTokens.length === 0) return true;

      const passCode = (
        reg.ticketCode || buildAttendeeTicketCode(reg.eventId, reg.userId)
      ).toLowerCase();
      const haystack = `${reg.userName} ${reg.registerNumber} ${reg.department} ${reg.year} ${reg.userEmail} ${passCode}`.toLowerCase();
      return searchTokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => {
      if (attendeeSortBy === 'name_asc') return a.userName.localeCompare(b.userName);
      if (attendeeSortBy === 'reg_asc') return a.registerNumber.localeCompare(b.registerNumber);
      if (attendeeSortBy === 'status') {
        const aChecked = checkInByUserId.has(a.userId) ? 1 : 0;
        const bChecked = checkInByUserId.has(b.userId) ? 1 : 0;
        if (bChecked !== aChecked) return bChecked - aChecked;
        return a.userName.localeCompare(b.userName);
      }
      return b.registeredAt.localeCompare(a.registeredAt);
    });

  const renderHighlighted = (text: string): React.ReactNode => {
    if (searchTokens.length === 0 || !text) return text;
    const escaped = searchTokens
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    if (!escaped) return text;
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <mark
          key={idx}
          className="bg-[#00EA64]/25 text-inherit rounded-xs px-0.5"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  const handleRsvp = async () => {
    setRsvpLoading(true);
    try {
      await registerForEvent(event.id);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCancelRsvp = async () => {
    setRsvpLoading(true);
    try {
      await cancelRegistration(event.id);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleMarkOnlineAttendance = async () => {
    setMarkingAttendance(true);
    try {
      const res = await markOnlineEventAttendance(event.id);
      if (!res.ok && res.error) {
        addToast('Attendance not recorded', res.error, 'error');
      }
    } finally {
      setMarkingAttendance(false);
    }
  };

  const handleToggleOnlineAttendance = async () => {
    setTogglingAttendance(true);
    try {
      await toggleOnlineEventAttendance(event.id, !onlineAttendanceOpen);
    } finally {
      setTogglingAttendance(false);
    }
  };

  const parsedStartDate = new Date(event.dateISO);
  const formattedDate = Number.isNaN(parsedStartDate.getTime())
    ? event.dateISO
    : parsedStartDate.toLocaleString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  const formattedShortDate = Number.isNaN(parsedStartDate.getTime())
    ? event.dateISO
    : parsedStartDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
  const formattedTime = Number.isNaN(parsedStartDate.getTime())
    ? ''
    : parsedStartDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

  const eventUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/events/${encodeURIComponent(event.id)}`
      : `/events/${encodeURIComponent(event.id)}`;

  const handleDownloadCert = (cert: EventCertificate) => {
    const verifyUrl = `${window.location.origin}/certificates/${encodeURIComponent(cert.certId)}`;
    downloadCertificatePng({
      certificate: cert,
      verificationUrl: verifyUrl,
      leadName: siteSettings.leadName || 'Campus Lead',
    });
  };

  const handleClaimCert = async () => {
    setClaimingCert(true);
    await claimParticipationCertificate(event.id);
    setClaimingCert(false);
  };

  const handleResendTicket = async () => {
    if (!myRegistration) return;
    setResendingTicket(true);
    await resendEventTicketEmail(myRegistration.id);
    setResendingTicket(false);
  };

  const eventSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate: event.dateISO,
    eventAttendanceMode: onlineEvent
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : effectiveMode === 'hybrid'
      ? 'https://schema.org/MixedEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    isAccessibleForFree: true,
    url: eventUrl,
    image: [toAbsoluteUrl(event.bannerImage)],
    location: onlineEvent
      ? {
          '@type': 'VirtualLocation',
          url: event.meetingUrl || eventUrl,
        }
      : {
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

  const roleDisplayLabel =
    ROLE_META[event.createdByRole]?.label ||
    (event.createdByRole === 'lead' ? 'Campus Lead' : 'Campus Crew');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
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

      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to All Events</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadEventIcs(event, eventUrl, siteSettings.campusLocation)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            <span>Add to Calendar</span>
          </button>

          {!onlineEvent && (
            <Link
              to="/checkin"
              className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <QrCode className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>QR Check-In</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
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

      {/* Pending / Rejected Preview Banner for Admin & Crew */}
      {event.status !== 'approved' && isCrewOrLead && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
              {event.status === 'pending'
                ? 'Pending Campus Lead Approval · Crew/Lead Preview'
                : 'Event Rejected · Hidden from Public Schedule'}
            </p>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
              Created by {event.createdByName} ({roleDisplayLabel}). Only signed-in Campus Crew and
              Campus Lead can preview this page until published.
            </p>
          </div>
          {isLead && event.status === 'pending' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={async () => {
                  setUpdatingStatus(true);
                  await approveEvent(event.id);
                  setUpdatingStatus(false);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Approve &amp; Publish</span>
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={async () => {
                  setUpdatingStatus(true);
                  await rejectEvent(event.id);
                  setUpdatingStatus(false);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-mono border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reject</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full-Width Hero Banner */}
      <header className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
        <div className="aspect-[16/8] sm:aspect-[21/9] relative overflow-hidden">
          <SafeImage
            src={event.bannerImage}
            alt={event.title}
            priority
            className="w-full h-full object-cover"
            fallbackTitle={event.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B10]/95 via-[#070B10]/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <p className="font-mono text-xs font-semibold text-[#00EA64] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{event.category}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {onlineEvent
                    ? 'Online Event'
                    : effectiveMode === 'hybrid'
                    ? 'Hybrid Event'
                    : 'In-Person'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{event.membersOnly ? 'Verified Members Only' : 'Open Campus Event'}</span>
                <span aria-hidden="true">·</span>
                <span>{isPast ? 'Completed' : 'Accepting Registrations'}</span>
              </p>
              <h1 className="font-mono text-2xl sm:text-4xl font-bold text-white leading-tight [text-wrap:balance]">
                {event.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{formattedDate}</span>
                <span aria-hidden="true">·</span>
                <span>{event.venue}</span>
              </p>
            </div>

            <div className="font-mono text-xs text-slate-200 tabular-nums md:text-right shrink-0 space-y-0.5">
              <p className="text-slate-400">Hosted by {siteSettings.chapterName}</p>
              <p className="text-sm font-bold text-white">
                {regCount.toLocaleString()} / {event.capacity.toLocaleString()} seats reserved
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Dynamic Countdown Timer (Activates automatically when the event is upcoming) */}
      {!isPast && (
        <EventCountdownTimer
          targetDateISO={event.dateISO}
          formattedStartDate={formattedDate}
          venue={event.venue}
          onExpire={handleCountdownExpire}
        />
      )}

      {/* Main 2-Column Asymmetric Layout (Left: Full Details & Specs · Right: Sticky Registration & Pass Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Main Content (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* 01. About & Event Overview */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                About This Event
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-w-prose">
                {event.description}
              </p>
            </div>

            {/* Structured Institutional Specification Matrix */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
              <h3 className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
                Complete Event Details
              </h3>
              <dl className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Event Format
                  </dt>
                  <dd className="sm:col-span-2 font-medium text-slate-900 dark:text-white">
                    {event.category}
                    {onlineEvent
                      ? ' · Online Session (No QR Check-In Required)'
                      : effectiveMode === 'hybrid'
                      ? ' · Hybrid Session (In-Person + Online)'
                      : event.unstopMode
                      ? ` · ${event.unstopMode}`
                      : ' · In-Person Campus Session'}
                  </dd>
                </div>

                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Date &amp; Start Time
                  </dt>
                  <dd className="sm:col-span-2 font-medium text-slate-900 dark:text-white tabular-nums">
                    {formattedDate}
                  </dd>
                </div>

                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {onlineEvent ? 'Online Platform' : 'Venue & Campus'}
                  </dt>
                  <dd className="sm:col-span-2 text-slate-900 dark:text-white space-y-1">
                    <span className="font-medium block">{event.venue}</span>
                    {!onlineEvent && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">
                        {siteSettings.collegeName} · {siteSettings.campusLocation}
                      </span>
                    )}
                    {event.meetingUrl && (isRegistered || isCrewOrLead) && (
                      <a
                        href={event.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#009942] dark:text-[#00EA64] hover:underline"
                      >
                        <Video className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Join Online Session</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </dd>
                </div>

                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Eligibility &amp; Access
                  </dt>
                  <dd className="sm:col-span-2 font-medium text-slate-900 dark:text-white">
                    {event.membersOnly
                      ? 'Verified HRCC Paavai Student Members Only'
                      : 'Open to All Verified Paavai Engineering College Students'}
                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                      {onlineEvent
                        ? 'Free online admission · No QR check-in pass required'
                        : 'Free admission · Unique Entry Pass QR emailed upon registration'}
                    </span>
                  </dd>
                </div>

                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Seat Capacity
                  </dt>
                  <dd className="sm:col-span-2 font-mono text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums">
                    {regCount.toLocaleString()} reserved · {remainingSeats.toLocaleString()} remaining
                    (Capacity: {event.capacity.toLocaleString()})
                  </dd>
                </div>

                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Attendance &amp; Rewards
                  </dt>
                  <dd className="sm:col-span-2 text-slate-900 dark:text-white">
                    {onlineEvent ? (
                      onlineAttendanceOpen ? (
                        <>
                          <span className="font-medium text-[#009942] dark:text-[#00EA64]">
                            Online Attendance Enabled
                          </span>{' '}
                          — mark attendance directly on this page (no QR needed) for +50
                          leaderboard points &amp; verifiable E-Certificate.
                        </>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">
                          No QR check-in required for this online event. Attendance marking is
                          optional and can be enabled by the admin if needed.
                        </span>
                      )
                    ) : (
                      <>
                        <span className="font-medium">+50 Campus Leaderboard Points</span> &amp;
                        Verifiable E-Certificate upon gate QR check-in
                      </>
                    )}
                  </dd>
                </div>

                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Event Reference ID
                  </dt>
                  <dd className="sm:col-span-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {event.id}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Event Brochure / Schedule Attachment */}
            {event.documentUrl && (
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                    Official Event Brochure &amp; Schedule
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Inspect rules, round timings, problem syllabus, and guidelines directly in the
                    embedded viewer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocModalOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-semibold border border-[#00EA64]/50 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/20 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span>Open Event Document</span>
                </button>
              </div>
            )}
          </section>

          {/* 02. Unstop Integration Block (when linked) */}
          {event.unstopUrl && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400">
                    Unstop Event Integration
                    {event.unstopCompetitionId ? ` · ID #${event.unstopCompetitionId}` : ''}
                  </p>
                  <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    Live Unstop Listing &amp; Metrics
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Synchronized directly from the public Unstop event listing.
                    {event.unstopSyncedAt
                      ? ` Updated ${new Date(event.unstopSyncedAt).toLocaleString('en-IN')}.`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {can('canCreateEvents') && (
                    <button
                      type="button"
                      disabled={syncingUnstop}
                      onClick={async () => {
                        setSyncingUnstop(true);
                        await syncEventFromUnstop(event.id);
                        setSyncingUnstop(false);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-mono font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-sky-500 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingUnstop ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{syncingUnstop ? 'Syncing…' : 'Sync Unstop'}</span>
                    </button>
                  )}
                  <a
                    href={event.unstopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-sky-600 text-white hover:bg-sky-500 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Open on Unstop</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                    <span>Unstop Regs</span>
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {event.unstopRegistrationsCount !== undefined
                      ? event.unstopRegistrationsCount.toLocaleString('en-IN')
                      : '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                    <span>Page Views</span>
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {event.unstopViewsCount !== undefined
                      ? event.unstopViewsCount.toLocaleString('en-IN')
                      : '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                    <span>Deadline</span>
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {event.unstopDeadline
                      ? new Date(event.unstopDeadline).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'See Unstop'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                    <span>Mode / Prize</span>
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {event.unstopPrize || event.unstopMode || 'Campus'}
                  </p>
                </div>
              </div>

              {event.unstopOrganiser && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                  Listed Organiser:{' '}
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {event.unstopOrganiser}
                  </span>
                </p>
              )}
            </section>
          )}

          {/* 03. Participation & Attendance Workflow */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 sm:p-8 space-y-5">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              How Participation Works
            </h2>
            {onlineEvent ? (
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <li className="space-y-1.5">
                  <p className="font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    01. RSVP Online
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Reserve your seat with your verified Paavai student account. No QR pass or
                    physical gate check-in is required for online events.
                  </p>
                </li>
                <li className="space-y-1.5">
                  <p className="font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    02. Join Virtually
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Join via {event.venue} at start time.{' '}
                    {onlineAttendanceOpen
                      ? 'Online attendance is active — click Mark My Attendance on this page during the session.'
                      : 'If the admin enables attendance for this session, a direct attendance button appears on this page.'}
                  </p>
                </li>
                <li className="space-y-1.5">
                  <p className="font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    03. Points &amp; E-Certificate
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    When attendance is enabled and recorded, you earn +50 leaderboard points and
                    unlock your verifiable PNG E-Certificate.
                  </p>
                </li>
              </ol>
            ) : (
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <li className="space-y-1.5">
                  <p className="font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    01. Reserve Seat &amp; Receive QR
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Register with your verified Paavai student account. Your unique Entry Pass QR code
                    is emailed immediately and saved on your Profile.
                  </p>
                </li>
                <li className="space-y-1.5">
                  <p className="font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    02. Venue Gate QR Check-In
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Present your unique Entry Pass QR to Campus Crew at {event.venue} to log verified
                    attendance and earn +50 leaderboard points.
                  </p>
                </li>
                <li className="space-y-1.5">
                  <p className="font-mono text-xs font-bold text-[#009942] dark:text-[#00EA64]">
                    03. Claim Verifiable E-Certificate
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Once checked in, download your QR-verifiable PNG E-Certificate directly from this
                    event page or your Profile and add it to LinkedIn.
                  </p>
                </li>
              </ol>
            )}
          </section>

          {/* 04. Event Host & Organizing Chapter */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 sm:p-8 space-y-4">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Event Organizer &amp; Contact
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <MemberAvatar
                  name={event.createdByName}
                  photoUrl={organizerMember?.photoUrl}
                  variant={event.createdByRole === 'lead' ? 'lead' : 'crew'}
                  sizeClass="w-12 h-12"
                  textClass="text-sm"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate">
                    {event.createdByName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {roleDisplayLabel} · {siteSettings.chapterName}
                    {organizerMember?.department ? ` · ${organizerMember.department}` : ''}
                  </p>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Queries: {siteSettings.contactEmail}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {organizerMember ? (
                  <Link
                    to={`/members/${encodeURIComponent(organizerMember.uid)}`}
                    className="px-3.5 py-2 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
                  >
                    View Organizer Profile
                  </Link>
                ) : (
                  <Link
                    to="/team"
                    className="px-3.5 py-2 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
                  >
                    Meet Campus Crew
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* 05. Award Winners & Recognitions (if issued) */}
          {awardWinners.length > 0 && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                  <span>Verified Award Winners ({awardWinners.length})</span>
                </h2>
                <Link
                  to="/certificates"
                  className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
                >
                  Verify Certificates →
                </Link>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {awardWinners.map((winner) => (
                  <div
                    key={winner.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {winner.recipientName}
                      </p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {winner.awardType}
                        {winner.awardTitle ? ` · ${winner.awardTitle}` : ''}
                        {winner.department ? ` · ${winner.department}` : ''}
                      </p>
                    </div>
                    <Link
                      to={`/certificates/${encodeURIComponent(winner.certId)}`}
                      className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
                    >
                      {winner.certId} →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 06. Organizer / Admin Operations Panel (Visible ONLY to Campus Crew & Campus Lead) */}
          {isCrewOrLead && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64] inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Organizer Operations · {isLead ? 'Campus Lead' : 'Campus Crew'}</span>
                  </p>
                  <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    Live Event Telemetry &amp; Institutional Reports
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      printEventNaacReport({
                        event,
                        registrations,
                        checkIns: eventCheckIns,
                        certificates,
                        siteSettings,
                      })
                    }
                    className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Print NAAC Report</span>
                  </button>
                  <Link
                    to={isLead ? '/dashboard/lead' : '/dashboard/crew'}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <span>Manage in Dashboard</span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 font-mono">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Portal Regs</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {regCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {onlineEvent ? 'Online Attendance' : 'QR Check-Ins'}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[#009942] dark:text-[#00EA64]">
                    {eventChecks.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Turnout Rate</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {turnoutPercent}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">E-Certificates</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {eventCerts.length}
                  </p>
                </div>
              </div>

              {onlineEvent && can('canEditDeleteAnyEvent') && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      Online Participant Attendance:{' '}
                      <span
                        className={
                          onlineAttendanceOpen
                            ? 'text-[#009942] dark:text-[#00EA64]'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {onlineAttendanceOpen ? 'Enabled' : 'Disabled'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {onlineAttendanceOpen
                        ? 'Registered participants can mark their attendance directly on this event page (no QR code needed).'
                        : 'QR check-in is off for online events. Enable this if you want participants to mark attendance.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={togglingAttendance}
                    onClick={handleToggleOnlineAttendance}
                    className={`px-3.5 py-2 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors ${
                      onlineAttendanceOpen
                        ? 'border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-amber-500'
                        : 'bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {togglingAttendance
                        ? 'Updating…'
                        : onlineAttendanceOpen
                        ? 'Disable Attendance'
                        : 'Enable Participant Attendance'}
                    </span>
                  </button>
                </div>
              )}

              {eventUnstopRows.length > 0 && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 tabular-nums">
                  Unstop CSV Roster Imported: {eventUnstopRows.length} participant
                  {eventUnstopRows.length === 1 ? '' : 's'} reconciled for this event.
                </p>
              )}
            </section>
          )}

          {/* 07. Crew & Lead Attendee Roster (Visible ONLY to Campus Crew & Campus Lead) */}
          {can('canViewRegistrations') && (
            <section
              aria-label="Event attendee roster"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                      {isLead ? 'Admin & Crew Roster' : 'Crew Roster'} · Live RSVP &amp; Attendance List
                    </p>
                    <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      Event Attendees ({eventRegs.length})
                    </h2>
                  </div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {onlineEvent
                      ? onlineAttendanceOpen
                        ? `${checkedInRegsCount} marked present · ${pendingRegsCount} awaiting attendance`
                        : `${eventRegs.length} RSVPed · Online attendance off (no QR)`
                      : `${checkedInRegsCount} checked in · ${pendingRegsCount} awaiting check-in`}
                  </p>
                </div>

                <AttendeeFilterBar
                  searchQuery={attendeeSearch}
                  onSearchChange={setAttendeeSearch}
                  statusFilter={attendeeStatusFilter}
                  onStatusFilterChange={setAttendeeStatusFilter}
                  departmentFilter={attendeeDeptFilter}
                  onDepartmentFilterChange={setAttendeeDeptFilter}
                  yearFilter={attendeeYearFilter}
                  onYearFilterChange={setAttendeeYearFilter}
                  sortBy={attendeeSortBy}
                  onSortByChange={setAttendeeSortBy}
                  departments={attendeeDepartmentFacets}
                  years={attendeeYearFacets}
                  totalCount={eventRegs.length}
                  checkedInCount={checkedInRegsCount}
                  pendingCount={pendingRegsCount}
                  filteredCount={filteredEventAttendees.length}
                  onResetFilters={resetAttendeeFilters}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] text-xs font-mono text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4 font-semibold">Attendee</th>
                      <th className="py-3 px-4 font-semibold">Register No.</th>
                      <th className="py-3 px-4 font-semibold">Dept &amp; Year</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Crew Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredEventAttendees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 px-4 text-center text-xs font-mono text-slate-500 dark:text-slate-400 space-y-3"
                        >
                          <p>
                            {eventRegs.length === 0
                              ? 'No students have RSVPed for this event yet.'
                              : 'No registrants match the active search or filter criteria.'}
                          </p>
                          {eventRegs.length > 0 && (
                            <button
                              type="button"
                              onClick={resetAttendeeFilters}
                              className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors"
                            >
                              Reset Search &amp; Filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredEventAttendees.map((reg) => {
                        const chk = checkInByUserId.get(reg.userId);
                        const ticketCode =
                          reg.ticketCode || buildAttendeeTicketCode(reg.eventId, reg.userId);
                        return (
                          <tr
                            key={reg.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-[#17202C]/50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {renderHighlighted(reg.userName)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {renderHighlighted(reg.userEmail)}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                              {renderHighlighted(reg.registerNumber)}
                              {!onlineEvent && (
                                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                  {renderHighlighted(ticketCode)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                              {renderHighlighted(reg.department)} · {renderHighlighted(reg.year)}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              {chk ? (
                                <span className="font-semibold text-[#009942] dark:text-[#00EA64]">
                                  {onlineEvent ? 'Present' : 'Checked In'}
                                </span>
                              ) : (
                                <span className="text-slate-600 dark:text-slate-400">
                                  RSVP Confirmed
                                </span>
                              )}
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {chk
                                  ? new Date(chk.checkedInAt).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : reg.registeredAt}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {onlineEvent ? (
                                  onlineAttendanceOpen && !chk ? (
                                    <button
                                      type="button"
                                      disabled={checkingInRegId === reg.id}
                                      onClick={async () => {
                                        setCheckingInRegId(reg.id);
                                        await crewCheckInAttendeeByTicket(
                                          reg.registerNumber || reg.userEmail,
                                          event.id
                                        );
                                        setCheckingInRegId(null);
                                      }}
                                      className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                      {checkingInRegId === reg.id ? 'Marking…' : 'Mark Present'}
                                    </button>
                                  ) : (
                                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                      {chk ? 'Recorded' : 'No QR needed'}
                                    </span>
                                  )
                                ) : (
                                  <>
                                    {!chk && (
                                      <button
                                        type="button"
                                        disabled={checkingInRegId === reg.id}
                                        onClick={async () => {
                                          setCheckingInRegId(reg.id);
                                          await crewCheckInAttendeeByTicket(ticketCode, event.id);
                                          setCheckingInRegId(null);
                                        }}
                                        className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 whitespace-nowrap shrink-0"
                                      >
                                        {checkingInRegId === reg.id ? 'Checking…' : 'Check In'}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setActiveTicketReg(reg)}
                                      title="View or download this attendee's unique RSVP QR code"
                                      className="px-2.5 py-1.5 rounded-md text-[11px] font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                    >
                                      <QrCode className="w-3 h-3" aria-hidden="true" />
                                      <span>View QR</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={resendingRowId === reg.id}
                                      onClick={async () => {
                                        setResendingRowId(reg.id);
                                        await resendEventTicketEmail(reg.id);
                                        setResendingRowId(null);
                                      }}
                                      title="Email unique Entry Pass QR to attendee"
                                      className="px-2.5 py-1.5 rounded-md text-[11px] font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                      {resendingRowId === reg.id ? 'Sending…' : 'Email QR'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Right Sticky Registration, Entry Pass QR & E-Certificate Sidebar (4 cols) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 space-y-5">
            {/* Registration Status Header */}
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                {isPast
                  ? 'Event Concluded'
                  : onlineEvent
                  ? 'Online Event Registration Open'
                  : 'Event Registration Open'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isPast
                  ? `This event was conducted on ${formattedShortDate}. Verified attendees can claim or download their E-Certificate below.`
                  : onlineEvent
                  ? onlineAttendanceOpen
                    ? 'Reserve your spot for this online session — no QR check-in needed. Online attendance is enabled for participants.'
                    : 'Reserve your spot for this online session — no QR code check-in is required.'
                  : 'Reserve your seat before start time to receive your unique Entry Pass QR via email.'}
              </p>
            </div>

            {/* Key Quick-Facts */}
            <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Calendar className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{formattedShortDate}</p>
                  {formattedTime && (
                    <p className="text-slate-500 dark:text-slate-400 tabular-nums">{formattedTime}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                {onlineEvent ? (
                  <Globe className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <MapPin className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <p className="font-medium text-slate-900 dark:text-white">{event.venue}</p>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className="space-y-1.5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Seat Availability</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {remainingSeats} left
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[#00EA64] transition-all duration-300"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {regCount} of {event.capacity} seats filled ({fillPercent}%)
              </p>
            </div>

            {/* Primary Student RSVP Action & Pass / Online Attendance Block */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {isRegistered && myRegistration ? (
                onlineEvent ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{isCheckedIn ? 'Attendance Recorded' : 'Online RSVP Confirmed'}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isCheckedIn && myCheckIn?.checkedInAt
                            ? `Recorded on ${new Date(myCheckIn.checkedInAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : 'No QR pass or gate check-in needed for this online event.'}
                        </p>
                      </div>
                    </div>

                    {event.meetingUrl && (
                      <a
                        href={event.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold border border-[#00EA64]/60 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/20 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <Video className="w-4 h-4" aria-hidden="true" />
                        <span>Join Online Session</span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}

                    {onlineAttendanceOpen && !isCheckedIn && (
                      <button
                        type="button"
                        disabled={markingAttendance}
                        onClick={handleMarkOnlineAttendance}
                        className="w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <UserCheck className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {markingAttendance ? 'Recording Attendance…' : 'Mark My Attendance'}
                        </span>
                      </button>
                    )}

                    {!onlineAttendanceOpen && !isCheckedIn && (
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 leading-relaxed">
                        Attendance tracking is currently off for this online event. If the admin
                        enables it, you can mark attendance right here.
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                      <Link
                        to="/profile"
                        className="text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap"
                      >
                        My Profile →
                      </Link>
                      {!isPast && !isCheckedIn && (
                        <button
                          type="button"
                          disabled={rsvpLoading}
                          onClick={handleCancelRsvp}
                          className="text-slate-500 hover:text-red-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {rsvpLoading ? 'Cancelling…' : 'Cancel RSVP'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <RsvpQrPassCard
                    registration={myRegistration}
                    event={event}
                    isCheckedIn={isCheckedIn}
                    checkedInAt={myCheckIn?.checkedInAt}
                    isPast={isPast}
                    resendingTicket={resendingTicket}
                    cancelingRsvp={rsvpLoading}
                    onEnlarge={() => setActiveTicketReg(myRegistration)}
                    onResendEmail={handleResendTicket}
                    onCancelRsvp={handleCancelRsvp}
                  />
                )
              ) : isPast ? (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center py-1">
                  RSVP closed for this completed event.
                </p>
              ) : !currentUser ? (
                <Link
                  to={`/login?redirect=/events/${encodeURIComponent(event.id)}`}
                  className="w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>Sign In to RSVP</span>
                </Link>
              ) : can('canRegisterForEvents') ? (
                <button
                  type="button"
                  disabled={rsvpLoading || regCount >= event.capacity || event.status !== 'approved'}
                  onClick={handleRsvp}
                  className="w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {rsvpLoading
                    ? 'Submitting RSVP…'
                    : event.status !== 'approved'
                    ? 'Awaiting Approval'
                    : regCount >= event.capacity
                    ? 'Event Full'
                    : 'RSVP Now'}
                </button>
              ) : null}

              {/* E-Certificate Action when checked in or already issued */}
              {myCertificate ? (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-mono text-[#009942] dark:text-[#00EA64] font-semibold">
                    E-Certificate Issued ({myCertificate.certId})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadCert(myCertificate)}
                      className="py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download PNG</span>
                    </button>
                    <Link
                      to={`/certificates/${encodeURIComponent(myCertificate.certId)}`}
                      className="py-2 px-3 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Verify</span>
                    </Link>
                  </div>
                </div>
              ) : isCheckedIn ? (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={claimingCert}
                    onClick={handleClaimCert}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold border border-[#00EA64] bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/25 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Award className="w-4 h-4" aria-hidden="true" />
                    <span>{claimingCert ? 'Issuing Certificate…' : 'Claim Participation E-Certificate'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {/* More Campus Events */}
      {relatedEvents.length > 0 && (
        <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              More Campus Events
            </h2>
            <Link
              to="/events"
              className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
            >
              View All Events →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {relatedEvents.map((rel) => (
              <Link
                key={rel.id}
                to={`/events/${encodeURIComponent(rel.id)}`}
                className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] hover:border-[#00EA64]/60 transition-colors flex flex-col"
              >
                <div className="aspect-[16/9] bg-slate-900 overflow-hidden">
                  <SafeImage
                    src={rel.bannerImage}
                    alt={rel.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    fallbackTitle={rel.title}
                  />
                </div>
                <div className="p-4 space-y-1.5 flex-1">
                  <p className="font-mono text-[11px] text-[#009942] dark:text-[#00EA64]">
                    {rel.category} ·{' '}
                    {new Date(rel.dateISO).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#009942] dark:group-hover:text-[#00EA64] transition-colors line-clamp-2">
                    {rel.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rel.venue}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      <DriveDocumentViewer
        url={docModalOpen && event.documentUrl ? event.documentUrl : null}
        title={`${event.title} — Event Document`}
        subtitle={`${event.category} · ${event.venue}`}
        onClose={() => setDocModalOpen(false)}
      />

      {activeTicketReg && (
        <StudentEventTicketModal
          registration={activeTicketReg}
          event={event}
          isCheckedIn={checkInByUserId.has(activeTicketReg.userId)}
          onClose={() => setActiveTicketReg(null)}
          onResendEmail={async (regId) => {
            await resendEventTicketEmail(regId);
          }}
        />
      )}
    </div>
  );
};
