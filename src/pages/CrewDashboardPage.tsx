import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  LucideIcon,
  Mail,
  Megaphone,
  Plus,
  QrCode,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ACADEMIC_YEARS,
  CHAPTER_IMAGES,
  CampusEvent,
  DEPARTMENTS,
  EventMode,
  GalleryPhoto,
  ResourceTrack,
  buildAttendeeTicketCode,
  getEffectiveEventMode,
  isOnlineAttendanceEnabled,
  isOnlineEvent,
} from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { DRIVE_SHARING_HINT, validateDriveOrHttpsUrl } from '../lib/driveUtils';
import { printEventNaacReport } from '../lib/eventReportPrint';
import { SafeImage } from '../components/SafeImage';

import { MemberDirectoryPanel, JoinRequestsPanel, SiteSettingsPanel } from './AdminPanelPage';
import { EventCheckInQRGenerator } from '../components/EventCheckInQRGenerator';
import { UnstopCsvImporterPanel } from '../components/UnstopCsvImporterPanel';
import { CertificatesManagerPanel } from '../components/CertificatesManagerPanel';
import { DashboardWidget, MemberCheckInSummaryWidget } from '../components/DashboardWidget';
import { AttendanceCsvExportModal } from '../components/AttendanceCsvExportModal';
import { PageSeo } from '../components/PageSeo';

type DashboardTab =
  | 'members'
  | 'events'
  | 'checkins'
  | 'certificates'
  | 'announcements'
  | 'gallery'
  | 'resources'
  | 'leaderboard'
  | 'registrations'
  | 'approvals'
  | 'join_requests'
  | 'settings';

export const CrewDashboardPage: React.FC<{ mode?: 'lead' | 'crew' }> = ({ mode }) => {
  const {
    currentUser,
    can,
    users,
    events,
    announcements,
    gallery,
    resources,
    leaderboard,
    registrations,
    unstopParticipants,
    eventCheckIns,
    certificates,
    joinRequests,
    siteSettings,
    createEvent,
    updateEvent,
    deleteEvent,
    approveEvent,
    rejectEvent,
    toggleOnlineEventAttendance,
    fetchUnstopEventDetails,
    syncEventFromUnstop,
    createAnnouncement,
    deleteAnnouncement,
    approveAnnouncement,
    rejectAnnouncement,
    addGalleryPhoto,
    deleteGalleryPhoto,
    addResource,
    deleteResource,
    upsertLeaderboardEntry,
    deleteLeaderboardEntry,
    exportRegistrationsCSV,
    resendEventTicketEmail,
  } = useApp();

  const isLead = can('canApproveContent') && mode !== 'crew';
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    mode === 'lead' ? 'members' : 'events'
  );
  const [resendingTicketRegId, setResendingTicketRegId] = useState<string | null>(null);
  const [attendanceExportModalOpen, setAttendanceExportModalOpen] = useState(false);
  const [attendanceExportEventId, setAttendanceExportEventId] = useState<string>('all');
  const [mobileSectionNavOpen, setMobileSectionNavOpen] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({
    community: true,
    operations: true,
    governance: true,
    events_ops: true,
    content_community: true,
  });

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters((prev) => ({
      ...prev,
      [clusterId]: !(prev[clusterId] ?? true),
    }));
  };

  // Event form state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evCategory, setEvCategory] = useState<CampusEvent['category']>('Workshop');
  const [evMode, setEvMode] = useState<EventMode>('offline');
  const [evAttendanceEnabled, setEvAttendanceEnabled] = useState(false);
  const [evMeetingUrl, setEvMeetingUrl] = useState('');
  const [evDate, setEvDate] = useState('2026-12-28T10:00');
  const [evVenue, setEvVenue] = useState('CSE Seminar Hall, Paavai Campus');
  const [evDesc, setEvDesc] = useState('');
  const [evCapacity, setEvCapacity] = useState(120);
  const [evMembersOnly, setEvMembersOnly] = useState(false);
  const [evBannerUrl, setEvBannerUrl] = useState(CHAPTER_IMAGES.hackathonArena);
  const [evDocUrl, setEvDocUrl] = useState('');
  const [evUnstopUrl, setEvUnstopUrl] = useState('');
  const [evUnstopCompetitionId, setEvUnstopCompetitionId] = useState('');
  const [evUnstopRegistrationsCount, setEvUnstopRegistrationsCount] = useState<number | undefined>(
    undefined
  );
  const [evUnstopViewsCount, setEvUnstopViewsCount] = useState<number | undefined>(undefined);
  const [evUnstopDeadline, setEvUnstopDeadline] = useState('');
  const [evUnstopOrganiser, setEvUnstopOrganiser] = useState('');
  const [evUnstopMode, setEvUnstopMode] = useState('');
  const [evUnstopPrize, setEvUnstopPrize] = useState('');
  const [evUnstopSyncedAt, setEvUnstopSyncedAt] = useState('');
  const [fetchingUnstop, setFetchingUnstop] = useState(false);
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);
  const [togglingAttendanceId, setTogglingAttendanceId] = useState<string | null>(null);

  // Announcement form state
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annPriority, setAnnPriority] = useState<'Normal' | 'Important'>('Normal');

  // Gallery form state
  const [galTitle, setGalTitle] = useState('');
  const [galCat, setGalCat] = useState<GalleryPhoto['category']>('Workshop');
  const [galUrl, setGalUrl] = useState(CHAPTER_IMAGES.dsaWorkshop);
  const [galCaption, setGalCaption] = useState('');

  // Resource form state
  const [resTitle, setResTitle] = useState('');
  const [resTrack, setResTrack] = useState<ResourceTrack>('DSA');
  const [resLevel, setResLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [resAccess, setResAccess] = useState<'basic' | 'full'>('full');
  const [resHours, setResHours] = useState(8);
  const [resProblems, setResProblems] = useState(25);
  const [resSummary, setResSummary] = useState('');
  const [resUrl, setResUrl] = useState('https://www.hackerrank.com/domains/algorithms');
  const [resDocUrl, setResDocUrl] = useState('');
  const [resTopics, setResTopics] = useState('Graphs, Greedy, Complexity');

  const evBannerValidation = useMemo(
    () => validateDriveOrHttpsUrl(evBannerUrl, { allowEmpty: false, allowRelative: true }),
    [evBannerUrl]
  );
  const evDocValidation = useMemo(
    () => validateDriveOrHttpsUrl(evDocUrl, { allowEmpty: true }),
    [evDocUrl]
  );
  const galValidation = useMemo(
    () => validateDriveOrHttpsUrl(galUrl, { allowEmpty: false, allowRelative: true }),
    [galUrl]
  );
  const resDocValidation = useMemo(
    () => validateDriveOrHttpsUrl(resDocUrl, { allowEmpty: true }),
    [resDocUrl]
  );

  // Leaderboard form state
  const [lbEditId, setLbEditId] = useState<string | undefined>(undefined);
  const [lbName, setLbName] = useState('');
  const [lbReg, setLbReg] = useState('');
  const [lbDept, setLbDept] = useState(DEPARTMENTS[0]);
  const [lbYear, setLbYear] = useState(ACADEMIC_YEARS[1]);
  const [lbScore, setLbScore] = useState(1800);
  const [lbSolved, setLbSolved] = useState(140);
  const [lbHandle, setLbHandle] = useState('@coder_pec');

  const pendingEvents = events.filter((e) => e.status === 'pending');
  const pendingAnnouncements = announcements.filter((a) => a.status === 'pending');
  const totalPending = pendingEvents.length + pendingAnnouncements.length;
  const pendingJoinCount = joinRequests.filter((r) => r.status === 'pending').length;

  type TabCluster = {
    id: string;
    title: string;
    items: Array<{
      id: DashboardTab;
      label: string;
      icon: LucideIcon;
      badge?: number;
      highlightWhenNonZero?: boolean;
    }>;
  };

  const tabClusters: TabCluster[] = isLead
    ? [
        {
          id: 'community',
          title: 'People & Access',
          items: [
            { id: 'members', label: 'Member Management', icon: Users, badge: users.length },
            {
              id: 'join_requests',
              label: 'Join Inquiries',
              icon: UserPlus,
              badge: pendingJoinCount,
              highlightWhenNonZero: true,
            },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          ],
        },
        {
          id: 'operations',
          title: 'Events & Content',
          items: [
            { id: 'events', label: 'Events', icon: Calendar },
            { id: 'checkins', label: 'QR Check-Ins', icon: QrCode, badge: eventCheckIns.length },
            {
              id: 'registrations',
              label: 'Registrations',
              icon: ClipboardList,
              badge: registrations.length + unstopParticipants.length,
            },
            {
              id: 'certificates',
              label: 'E-Certificates',
              icon: Award,
              badge: certificates.length,
            },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'gallery', label: 'Gallery', icon: ImageIcon },
            { id: 'resources', label: 'Resources', icon: BookOpen },
          ],
        },
        {
          id: 'governance',
          title: 'Approvals & Settings',
          items: [
            {
              id: 'approvals',
              label: 'Pending Content',
              icon: ShieldCheck,
              badge: totalPending,
              highlightWhenNonZero: true,
            },
            { id: 'settings', label: 'Site Settings', icon: Settings },
          ],
        },
      ]
    : [
        {
          id: 'events_ops',
          title: 'Events & Attendance',
          items: [
            { id: 'events', label: 'Events', icon: Calendar },
            { id: 'checkins', label: 'QR Check-Ins', icon: QrCode, badge: eventCheckIns.length },
            {
              id: 'registrations',
              label: 'Registrations',
              icon: ClipboardList,
              badge: registrations.length + unstopParticipants.length,
            },
            {
              id: 'certificates',
              label: 'E-Certificates',
              icon: Award,
              badge: certificates.length,
            },
          ],
        },
        {
          id: 'content_community',
          title: 'Community & Content',
          items: [
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'gallery', label: 'Gallery', icon: ImageIcon },
            { id: 'resources', label: 'Resources', icon: BookOpen },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          ],
        },
      ];

  const activeClusterAndItem =
    tabClusters
      .flatMap((cluster) => cluster.items.map((item) => ({ clusterTitle: cluster.title, item })))
      .find((entry) => entry.item.id === activeTab) ?? {
      clusterTitle: tabClusters[0].title,
      item: tabClusters[0].items[0],
    };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEvTitle('');
    setEvMode('offline');
    setEvAttendanceEnabled(false);
    setEvMeetingUrl('');
    setEvVenue('CSE Seminar Hall, Paavai Campus');
    setEvDesc('');
    setEvBannerUrl(CHAPTER_IMAGES.hackathonArena);
    setEvDocUrl('');
    setEvUnstopUrl('');
    setEvUnstopCompetitionId('');
    setEvUnstopRegistrationsCount(undefined);
    setEvUnstopViewsCount(undefined);
    setEvUnstopDeadline('');
    setEvUnstopOrganiser('');
    setEvUnstopMode('');
    setEvUnstopPrize('');
    setEvUnstopSyncedAt('');
  };

  const handleFetchFromUnstop = async () => {
    if (!evUnstopUrl.trim() || fetchingUnstop) return;
    setFetchingUnstop(true);
    const res = await fetchUnstopEventDetails(evUnstopUrl.trim());
    setFetchingUnstop(false);
    if (!res.ok || !res.data) return;

    const d = res.data;
    setEvUnstopUrl(d.unstopUrl);
    setEvUnstopCompetitionId(d.unstopCompetitionId);
    setEvUnstopRegistrationsCount(d.unstopRegistrationsCount);
    setEvUnstopViewsCount(d.unstopViewsCount);
    setEvUnstopDeadline(d.unstopDeadline || '');
    setEvUnstopOrganiser(d.unstopOrganiser || '');
    setEvUnstopMode(d.unstopMode || '');
    setEvUnstopPrize(d.unstopPrize || '');
    setEvUnstopSyncedAt(d.unstopSyncedAt);

    if (d.title) setEvTitle(d.title);
    if (d.category) setEvCategory(d.category);
    if (d.dateISO) {
      const dt = new Date(d.dateISO);
      if (!Number.isNaN(dt.getTime())) {
        setEvDate(dt.toISOString().slice(0, 16));
      }
    }
    if (d.venue) setEvVenue(d.venue);
    if (d.description) setEvDesc(d.description);
    if (d.bannerImage) setEvBannerUrl(d.bannerImage);
    const inferredMode = getEffectiveEventMode({ unstopMode: d.unstopMode, venue: d.venue });
    setEvMode(inferredMode);
    if (inferredMode === 'online') {
      setEvAttendanceEnabled(false);
    }
    if (d.unstopRegistrationsCount > evCapacity) {
      setEvCapacity(Math.min(5000, Math.max(100, d.unstopRegistrationsCount + 50)));
    }
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evDesc.trim()) return;
    if (!evBannerValidation.valid || (evDocUrl.trim() && !evDocValidation.valid)) return;
    const cleanBanner = evBannerUrl.trim() || CHAPTER_IMAGES.hackathonArena;
    const cleanDoc = evDocUrl.trim() || undefined;
    const cleanMeetingUrl = evMode === 'online' || evMode === 'hybrid' ? evMeetingUrl.trim() : '';
    const resolvedAttendanceEnabled =
      evMode === 'online' ? (can('canEditDeleteAnyEvent') ? evAttendanceEnabled : false) : true;
    const cleanUnstopUrl = evUnstopUrl.trim();
    const unstopFields = {
      unstopUrl: cleanUnstopUrl,
      unstopCompetitionId: evUnstopCompetitionId.trim(),
      ...(evUnstopRegistrationsCount !== undefined
        ? { unstopRegistrationsCount: evUnstopRegistrationsCount }
        : {}),
      ...(evUnstopViewsCount !== undefined ? { unstopViewsCount: evUnstopViewsCount } : {}),
      unstopDeadline: evUnstopDeadline.trim(),
      unstopOrganiser: evUnstopOrganiser.trim(),
      unstopMode: evUnstopMode.trim(),
      unstopPrize: evUnstopPrize.trim(),
      unstopSyncedAt: evUnstopSyncedAt.trim(),
    };

    if (editingEventId && can('canEditDeleteAnyEvent')) {
      updateEvent(editingEventId, {
        title: evTitle.trim(),
        category: evCategory,
        eventMode: evMode,
        attendanceEnabled: resolvedAttendanceEnabled,
        meetingUrl: cleanMeetingUrl,
        dateISO: new Date(evDate).toISOString(),
        venue: evVenue.trim() || (evMode === 'online' ? 'Online (Virtual Session)' : 'Paavai Campus'),
        description: evDesc.trim(),
        capacity: Number(evCapacity) || 100,
        membersOnly: evMembersOnly,
        bannerImage: cleanBanner,
        documentUrl: cleanDoc ?? '',
        ...unstopFields,
      });
    } else {
      createEvent({
        title: evTitle.trim(),
        category: evCategory,
        eventMode: evMode,
        attendanceEnabled: resolvedAttendanceEnabled,
        ...(cleanMeetingUrl ? { meetingUrl: cleanMeetingUrl } : {}),
        dateISO: new Date(evDate).toISOString(),
        venue: evVenue.trim() || (evMode === 'online' ? 'Online (Virtual Session)' : 'Paavai Campus'),
        description: evDesc.trim(),
        capacity: Number(evCapacity) || 100,
        membersOnly: evMembersOnly,
        bannerImage: cleanBanner,
        documentUrl: cleanDoc,
        ...(cleanUnstopUrl ? unstopFields : {}),
      });
    }
    resetEventForm();
  };

  const startEditEvent = (ev: CampusEvent) => {
    const resolvedMode = getEffectiveEventMode(ev);
    setEditingEventId(ev.id);
    setEvTitle(ev.title);
    setEvCategory(ev.category);
    setEvMode(resolvedMode);
    setEvAttendanceEnabled(resolvedMode === 'online' ? isOnlineAttendanceEnabled(ev) : true);
    setEvMeetingUrl(ev.meetingUrl || '');
    setEvDate(ev.dateISO.slice(0, 16));
    setEvVenue(ev.venue);
    setEvDesc(ev.description);
    setEvCapacity(ev.capacity);
    setEvMembersOnly(ev.membersOnly);
    setEvBannerUrl(ev.bannerImage || CHAPTER_IMAGES.hackathonArena);
    setEvDocUrl(ev.documentUrl || '');
    setEvUnstopUrl(ev.unstopUrl || '');
    setEvUnstopCompetitionId(ev.unstopCompetitionId || '');
    setEvUnstopRegistrationsCount(ev.unstopRegistrationsCount);
    setEvUnstopViewsCount(ev.unstopViewsCount);
    setEvUnstopDeadline(ev.unstopDeadline || '');
    setEvUnstopOrganiser(ev.unstopOrganiser || '');
    setEvUnstopMode(ev.unstopMode || '');
    setEvUnstopPrize(ev.unstopPrize || '');
    setEvUnstopSyncedAt(ev.unstopSyncedAt || '');
  };

  const handleAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    createAnnouncement({
      title: annTitle,
      message: annMessage,
      priority: annPriority,
    });
    setAnnTitle('');
    setAnnMessage('');
  };

  const handleGallerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!galTitle.trim() || !galCaption.trim() || !galValidation.valid) return;
    addGalleryPhoto({
      title: galTitle.trim(),
      category: galCat,
      imageUrl: galUrl.trim(),
      caption: galCaption.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setGalTitle('');
    setGalCaption('');
  };

  const handleResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resSummary.trim()) return;
    if (resDocUrl.trim() && !resDocValidation.valid) return;
    addResource({
      title: resTitle.trim(),
      track: resTrack,
      level: resLevel,
      access: resAccess,
      estimatedHours: Number(resHours) || 6,
      problemCount: Number(resProblems) || 20,
      summary: resSummary.trim(),
      url: resUrl.trim() || 'https://www.hackerrank.com',
      documentUrl: resDocUrl.trim() || undefined,
      topics: resTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setResTitle('');
    setResSummary('');
    setResDocUrl('');
  };

  const handleLeaderboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lbName.trim() || !lbReg.trim()) return;
    upsertLeaderboardEntry({
      id: lbEditId,
      name: lbName.trim(),
      registerNumber: lbReg.trim().toUpperCase(),
      department: lbDept,
      year: lbYear,
      score: Number(lbScore) || 0,
      problemsSolved: Number(lbSolved) || 0,
      hackerRankHandle: lbHandle.trim() || '@coder_pec',
    });
    setLbEditId(undefined);
    setLbName('');
    setLbReg('');
  };

  const statusTextClass = (status: string) => {
    if (status === 'approved') return 'text-[#009942] dark:text-[#00EA64]';
    if (status === 'pending') return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <PageSeo
        title={`${isLead ? 'Lead Dashboard' : 'Crew Dashboard'} – ${activeClusterAndItem.item.label}`}
        description="Campus Lead and Crew operations console for managing HackerRank Campus Crew events, members, and announcements."
        noIndex
      />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Operations Console · {isLead ? 'Campus Lead Access' : 'Campus Crew Member Access'}
          </p>
          <h1 className="font-mono text-3xl font-bold text-slate-900 dark:text-white">
            {isLead ? 'Lead Dashboard' : 'Crew Dashboard'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isLead
              ? `Signed in as ${currentUser?.name}. Manage member roles, publish events immediately, approve crew drafts, export registrations, and configure chapter settings.`
              : `Signed in as ${currentUser?.name}. New events and announcements enter Pending Approval until reviewed by the Campus Lead.`}
          </p>
        </div>

        {/* Summary Metrics & Admin Export Controls */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-mono shrink-0">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Approved Events</p>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {events.filter((e) => e.status === 'approved').length}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Registrations</p>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {registrations.length}
            </p>
          </div>
          {isLead && (
            <div>
              <p className="text-slate-500 dark:text-slate-400">Pending Queue</p>
              <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {totalPending}
              </p>
            </div>
          )}
          {can('canExportRegistrations') && (
            <button
              type="button"
              onClick={() => {
                setAttendanceExportEventId('all');
                setAttendanceExportModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Attendance CSV</span>
            </button>
          )}
          {isLead && (
            <Link
              to="/debug/emails"
              className="px-3 py-2 rounded-lg text-xs font-mono font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Mail className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>Email Debug Logs</span>
            </Link>
          )}
        </div>
      </header>

      {/* Operations Analytics Row: Member Check-In Summary + 6-Month Event Attendance */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-5 flex">
          <MemberCheckInSummaryWidget
            isLead={isLead}
            onOpenCheckIns={() => setActiveTab('checkins')}
            onOpenMembers={isLead ? () => setActiveTab('members') : undefined}
          />
        </div>
        <div className="xl:col-span-7 flex">
          <DashboardWidget onOpenCheckIns={() => setActiveTab('checkins')} />
        </div>
      </div>

      {/* Workspace Canvas: Clustered Left Sidebar + Active Panel */}
      <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-8">
        <aside
          aria-label={isLead ? 'Lead dashboard feature clusters' : 'Crew dashboard feature clusters'}
          className="w-full lg:w-64 xl:w-[268px] shrink-0 lg:sticky lg:top-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-3 sm:p-4"
        >
          {/* Mobile Section Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileSectionNavOpen((open) => !open)}
            aria-expanded={mobileSectionNavOpen}
            className="lg:hidden w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] flex items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 min-w-0 whitespace-nowrap">
              <activeClusterAndItem.item.icon
                className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
                aria-hidden="true"
              />
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">
                {activeClusterAndItem.clusterTitle} ·
              </span>
              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                {activeClusterAndItem.item.label}
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                mobileSectionNavOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {/* Clustered Single-Line Accordion Navigation List */}
          <nav
            aria-label="Dashboard sections"
            className={`${mobileSectionNavOpen ? 'block mt-3 pt-3 border-t border-slate-200 dark:border-slate-800' : 'hidden'} lg:block space-y-2`}
          >
            {tabClusters.map((cluster, clusterIdx) => {
              const isExpanded = expandedClusters[cluster.id] ?? true;
              const clusterHasActiveTab = cluster.items.some((item) => item.id === activeTab);
              const alertCount = cluster.items.reduce(
                (sum, item) =>
                  sum + (item.highlightWhenNonZero && typeof item.badge === 'number' ? item.badge : 0),
                0
              );

              return (
                <div
                  key={cluster.id}
                  className={
                    clusterIdx > 0
                      ? 'pt-2.5 border-t border-slate-200 dark:border-slate-800/80'
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleCluster(cluster.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`dashboard-cluster-${cluster.id}`}
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 text-left font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18202c] hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{cluster.title}</span>
                      {!isExpanded && clusterHasActiveTab && (
                        <span className="text-[10px] font-medium text-[#009942] dark:text-[#00EA64] shrink-0">
                          · Active
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {!isExpanded && alertCount > 0 && (
                        <span className="text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          {alertCount}
                        </span>
                      )}
                      {!isExpanded && alertCount === 0 && (
                        <span className="text-[11px] font-normal tabular-nums text-slate-400 dark:text-slate-500">
                          {cluster.items.length}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                          isExpanded ? 'rotate-0' : '-rotate-90'
                        }`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>

                  {isExpanded && (
                    <ul id={`dashboard-cluster-${cluster.id}`} className="mt-1 space-y-1">
                      {cluster.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab(item.id);
                                setMobileSectionNavOpen(false);
                              }}
                              aria-current={isActive ? 'page' : undefined}
                              className={`w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between gap-2.5 whitespace-nowrap transition-colors ${
                                isActive
                                  ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18202c] hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <span className="flex items-center gap-2.5 min-w-0">
                                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">{item.label}</span>
                              </span>
                              {typeof item.badge === 'number' && (
                                <span
                                  className={`text-[11px] tabular-nums shrink-0 ${
                                    isActive
                                      ? 'text-[#0B0F14]/80 font-bold'
                                      : item.highlightWhenNonZero && item.badge > 0
                                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                        : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Active Dashboard Panel */}
        <div className="flex-1 min-w-0 w-full">
          {/* TAB 0: MEMBERS & ROLES (Lead ONLY) */}
          {activeTab === 'members' && isLead && <MemberDirectoryPanel />}

      {/* TAB 1: EVENTS MANAGER */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleEventSubmit}
            className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4 h-fit"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {editingEventId ? 'Edit Event' : 'Create Event'}
              </h2>
              {editingEventId && (
                <button
                  type="button"
                  onClick={resetEventForm}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel edit
                </button>
              )}
            </div>
            {!can('canPublishEventsDirectly') && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Crew submissions are saved as Pending Approval until approved by the Campus Lead.
              </p>
            )}

            {/* Unstop Event Connection Box */}
            <div className="p-3.5 rounded-lg border border-sky-500/30 bg-sky-500/5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="event-unstop-url"
                  className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-300 inline-flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Unstop Event Link (Auto-Fetch Details &amp; Registrations)</span>
                </label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="event-unstop-url"
                  type="text"
                  value={evUnstopUrl}
                  onChange={(e) => setEvUnstopUrl(e.target.value)}
                  placeholder="https://unstop.com/hackathons/... or Competition ID"
                  className="flex-1 h-9 px-3 rounded-lg text-xs font-mono bg-white dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="button"
                  disabled={!evUnstopUrl.trim() || fetchingUnstop}
                  onClick={handleFetchFromUnstop}
                  className="h-9 px-3 rounded-lg text-xs font-mono font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  {fetchingUnstop ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{fetchingUnstop ? 'Fetching…' : 'Fetch from Unstop'}</span>
                </button>
              </div>
              {evUnstopSyncedAt && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-sky-500/20">
                  <span className="text-[#009942] dark:text-[#00EA64] font-semibold">
                    ✓ Synced
                  </span>
                  {evUnstopRegistrationsCount !== undefined && (
                    <span>
                      Registered: <strong>{evUnstopRegistrationsCount.toLocaleString('en-IN')}</strong>
                    </span>
                  )}
                  {evUnstopViewsCount !== undefined && evUnstopViewsCount > 0 && (
                    <span>Views: {evUnstopViewsCount.toLocaleString('en-IN')}</span>
                  )}
                  {evUnstopMode && <span>Mode: {evUnstopMode}</span>}
                  {evUnstopPrize && <span>Prize: {evUnstopPrize}</span>}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Event Title
              </label>
              <input
                type="text"
                required
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="e.g., Dynamic Programming Weekend Jam"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={evCategory}
                  onChange={(e) => setEvCategory(e.target.value as CampusEvent['category'])}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="Contest">Contest</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Hackathon">Hackathon</option>
                  <option value="Bootcamp">Bootcamp</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Capacity
                </label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={evCapacity}
                  onChange={(e) => setEvCapacity(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="event-mode-select"
                  className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1"
                >
                  Event Mode
                </label>
                <select
                  id="event-mode-select"
                  value={evMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as EventMode;
                    setEvMode(nextMode);
                    if (nextMode === 'online') {
                      if (evVenue === 'CSE Seminar Hall, Paavai Campus' || !evVenue.trim()) {
                        setEvVenue('Online (Virtual Session)');
                      }
                      if (!editingEventId) setEvAttendanceEnabled(false);
                    } else if (evVenue === 'Online (Virtual Session)') {
                      setEvVenue('CSE Seminar Hall, Paavai Campus');
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="offline">In-Person (Offline · QR Check-In)</option>
                  <option value="online">Online (No QR Check-In)</option>
                  <option value="hybrid">Hybrid (In-Person + Online)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  {evMode === 'online' ? 'Platform / Virtual Venue' : 'Venue'}
                </label>
                <input
                  type="text"
                  value={evVenue}
                  onChange={(e) => setEvVenue(e.target.value)}
                  placeholder={
                    evMode === 'online'
                      ? 'e.g., Google Meet / HackerRank Contest Room'
                      : 'CSE Seminar Hall, Paavai Campus'
                  }
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>

            {(evMode === 'online' || evMode === 'hybrid') && (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B0F14] space-y-3">
                <div>
                  <label
                    htmlFor="event-meeting-url"
                    className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Online Session / Contest Link (optional)
                  </label>
                  <input
                    id="event-meeting-url"
                    type="url"
                    value={evMeetingUrl}
                    onChange={(e) => setEvMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/... or https://www.hackerrank.com/..."
                    className="w-full h-9 px-3 rounded-lg text-xs font-mono bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700"
                  />
                </div>

                {evMode === 'online' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                    {can('canEditDeleteAnyEvent') ? (
                      <label className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={evAttendanceEnabled}
                          onChange={(e) => setEvAttendanceEnabled(e.target.checked)}
                          className="mt-0.5 rounded accent-[#00EA64]"
                        />
                        <span>
                          <strong className="font-semibold block">
                            Enable online attendance for participants
                          </strong>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            QR check-in is disabled for online events. Turn this on if you want
                            registered participants to mark their attendance on the event page.
                          </span>
                        </span>
                      </label>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        QR check-in is automatically disabled for online events. If attendance
                        tracking is needed, the Campus Lead / Admin can enable participant
                        attendance anytime.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                required
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                placeholder="Outline contest format, prerequisites, and rewards..."
                className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400">
                  Event Poster / Banner (Google Drive or Direct URL)
                </label>
                {evBannerUrl.trim() && evBannerValidation.valid && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    <span>{evBannerValidation.isDrive ? 'Drive Banner Ready' : 'Banner Ready'}</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                value={evBannerUrl}
                onChange={(e) => setEvBannerUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                {evBannerValidation.valid ? evBannerValidation.hint : evBannerValidation.error}
              </p>
              {evBannerUrl.trim() && evBannerValidation.valid && (
                <div className="mt-2 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
                  <SafeImage
                    src={evBannerUrl.trim()}
                    alt="Event banner preview"
                    className="w-full h-full object-cover"
                    fallbackTitle="Banner Preview"
                  />
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400">
                  Event Brochure / Schedule Document (optional Google Drive PDF/Docs/Slides)
                </label>
                {evDocUrl.trim() && evDocValidation.valid && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    <span>Doc Ready</span>
                  </span>
                )}
              </div>
              <input
                type="url"
                value={evDocUrl}
                onChange={(e) => setEvDocUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                {evDocUrl.trim()
                  ? evDocValidation.valid
                    ? evDocValidation.hint
                    : evDocValidation.error
                  : DRIVE_SHARING_HINT}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={evMembersOnly}
                onChange={(e) => setEvMembersOnly(e.target.checked)}
                className="rounded accent-[#00EA64]"
              />
              <span>Members-only event (requires verified member account)</span>
            </label>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingEventId
                  ? 'Save Event Changes'
                  : can('canPublishEventsDirectly')
                    ? 'Publish Event Immediately'
                    : 'Submit Event for Approval'}
              </span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              All Campus Events ({events.length})
            </h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              {events.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
                  No events created yet. Use the form to publish a new campus event.
                </p>
              ) : (
                events.map((ev) => {
                  const evEffectiveMode = getEffectiveEventMode(ev);
                  const onlineEv = evEffectiveMode === 'online';
                  const onlineAttOn = isOnlineAttendanceEnabled(ev);
                  return (
                  <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Link
                        to={`/events/${encodeURIComponent(ev.id)}`}
                        className="font-mono text-sm font-bold text-slate-900 dark:text-white hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors truncate block"
                      >
                        {ev.title}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ev.category} ·{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {onlineEv ? 'Online' : evEffectiveMode === 'hybrid' ? 'Hybrid' : 'In-Person'}
                        </span>
                        {onlineEv && (
                          <>
                            {' '}·{' '}
                            <span
                              className={`font-mono ${
                                onlineAttOn
                                  ? 'text-[#009942] dark:text-[#00EA64] font-semibold'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {onlineAttOn ? 'Online Attendance On' : 'No QR Check-In'}
                            </span>
                          </>
                        )}{' '}
                        · {new Date(ev.dateISO).toLocaleDateString('en-IN')} · By{' '}
                        {ev.createdByName} ·{' '}
                        <span className={`font-mono font-semibold capitalize ${statusTextClass(ev.status)}`}>
                          {ev.status}
                        </span>
                      </p>
                      {ev.unstopUrl && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-sky-700 dark:text-sky-300">
                          <span>
                            Unstop Linked
                            {ev.unstopRegistrationsCount !== undefined
                              ? ` · ${ev.unstopRegistrationsCount.toLocaleString('en-IN')} registered`
                              : ''}
                          </span>
                          {ev.unstopMode && <span>· {ev.unstopMode}</span>}
                          <a
                            href={ev.unstopUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {onlineEv && can('canEditDeleteAnyEvent') && (
                        <button
                          type="button"
                          disabled={togglingAttendanceId === ev.id}
                          onClick={async () => {
                            setTogglingAttendanceId(ev.id);
                            await toggleOnlineEventAttendance(ev.id, !onlineAttOn);
                            setTogglingAttendanceId(null);
                          }}
                          title={
                            onlineAttOn
                              ? 'Disable participant attendance marking for this online event'
                              : 'Enable participant attendance marking for this online event'
                          }
                          className={`px-2.5 py-1.5 rounded-md border text-[11px] font-mono inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors ${
                            onlineAttOn
                              ? 'border-[#00EA64]/60 bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/25 font-semibold'
                              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64]'
                          }`}
                        >
                          {onlineAttOn ? (
                            <UserCheck className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <Globe className="w-3 h-3" aria-hidden="true" />
                          )}
                          <span>
                            {togglingAttendanceId === ev.id
                              ? 'Saving…'
                              : onlineAttOn
                              ? 'Attendance: On'
                              : 'Enable Attendance'}
                          </span>
                        </button>
                      )}
                      <Link
                        to={`/events/${encodeURIComponent(ev.id)}`}
                        title="Open dedicated Event Page"
                        className="px-2.5 py-1.5 rounded-md border border-[#00EA64]/45 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/20 text-[11px] font-mono inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        <span>Event Page</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          printEventNaacReport({
                            event: ev,
                            registrations,
                            checkIns: eventCheckIns,
                            certificates,
                            siteSettings,
                          })
                        }
                        title="Print NAAC / IQAC Activity & Verified Attendance Report"
                        className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] hover:text-[#009942] dark:hover:text-[#00EA64] text-[11px] font-mono inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>NAAC Report</span>
                      </button>
                      {can('canExportRegistrations') && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceExportEventId(ev.id);
                            setAttendanceExportModalOpen(true);
                          }}
                          title="Export attendance data for this event as CSV"
                          className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] hover:text-[#009942] dark:hover:text-[#00EA64] text-[11px] font-mono inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3 h-3" aria-hidden="true" />
                          <span>Attendance CSV</span>
                        </button>
                      )}
                      {ev.unstopUrl && (
                        <button
                          type="button"
                          disabled={syncingEventId === ev.id}
                          onClick={async () => {
                            setSyncingEventId(ev.id);
                            await syncEventFromUnstop(ev.id);
                            setSyncingEventId(null);
                          }}
                          title="Refresh live registrations & event details from Unstop"
                          className="px-2.5 py-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 text-[11px] font-mono inline-flex items-center gap-1"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${syncingEventId === ev.id ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{syncingEventId === ev.id ? 'Syncing…' : 'Sync Unstop'}</span>
                        </button>
                      )}
                      {can('canEditDeleteAnyEvent') && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditEvent(ev)}
                            aria-label={`Edit ${ev.title}`}
                            className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#00EA64]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEvent(ev.id)}
                            aria-label={`Delete ${ev.title}`}
                            className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 hover:border-red-500/50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleAnnouncementSubmit}
            className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4 h-fit"
          >
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Post Announcement
            </h2>
            {!can('canPublishAnnouncementsDirectly') && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Crew announcements go to Pending Approval until approved by the Campus Lead.
              </p>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Headline
              </label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g., Contest #15 Leaderboard Updated"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Priority
              </label>
              <select
                value={annPriority}
                onChange={(e) => setAnnPriority(e.target.value as 'Normal' | 'Important')}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              >
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Message
              </label>
              <textarea
                rows={3}
                required
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Write a clear update for students..."
                className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
            >
              {can('canPublishAnnouncementsDirectly')
                ? 'Publish Announcement'
                : 'Submit Announcement for Approval'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Announcement Feed ({announcements.length})
            </h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
              {announcements.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
                  No announcements posted yet.
                </p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {a.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{a.message}</p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {a.date} · {a.priority} · By {a.createdByName} ·{' '}
                        <span className={`font-semibold capitalize ${statusTextClass(a.status)}`}>
                          {a.status}
                        </span>
                      </p>
                    </div>
                    {can('canDeleteAnnouncements') && (
                      <button
                        type="button"
                        onClick={() => deleteAnnouncement(a.id)}
                        aria-label={`Delete ${a.title}`}
                        className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GALLERY MANAGER */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleGallerySubmit}
            className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4 h-fit"
          >
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Upload Gallery Photo
            </h2>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={galTitle}
                onChange={(e) => setGalTitle(e.target.value)}
                placeholder="e.g., Lab B Problem Solving Clinic"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Category
              </label>
              <select
                value={galCat}
                onChange={(e) => setGalCat(e.target.value as GalleryPhoto['category'])}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              >
                <option value="Hackathon">Hackathon</option>
                <option value="Workshop">Workshop</option>
                <option value="Awards">Awards</option>
                <option value="Community">Community</option>
              </select>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400">
                  Google Drive Image Link or Direct URL
                </label>
                {galUrl.trim() && galValidation.valid && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    <span>{galValidation.isDrive ? 'Drive Photo Ready' : 'Photo Ready'}</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={galUrl}
                onChange={(e) => setGalUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                {galValidation.valid ? galValidation.hint : galValidation.error}
              </p>
              {galUrl.trim() && galValidation.valid && (
                <div className="mt-2 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
                  <SafeImage
                    src={galUrl.trim()}
                    alt="Gallery photo preview"
                    className="w-full h-full object-cover"
                    fallbackTitle="Preview"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Caption
              </label>
              <textarea
                rows={2}
                required
                value={galCaption}
                onChange={(e) => setGalCaption(e.target.value)}
                className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
            >
              Add to Gallery
            </button>
          </form>

          <div className="lg:col-span-7 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] h-fit">
            {gallery.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
                No gallery photos uploaded yet.
              </p>
            ) : (
              gallery.map((g) => (
                <div key={g.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {g.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {g.category} · {g.date} · Uploaded by {g.uploadedBy}
                    </p>
                  </div>
                  {can('canDeleteGallery') && (
                    <button
                      type="button"
                      onClick={() => deleteGalleryPhoto(g.id)}
                      aria-label={`Delete ${g.title}`}
                      className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RESOURCES MANAGER */}
      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleResourceSubmit}
            className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4 h-fit"
          >
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Add Roadmap Module
            </h2>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Module Title
              </label>
              <input
                type="text"
                required
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="e.g., Segment Trees & Fenwick Trees"
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Track
                </label>
                <select
                  value={resTrack}
                  onChange={(e) => setResTrack(e.target.value as ResourceTrack)}
                  className="w-full h-10 px-2 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="DSA">DSA</option>
                  <option value="Python">Python</option>
                  <option value="Java">Java</option>
                  <option value="SQL">SQL</option>
                  <option value="Problem Solving">Problem Solving</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Level
                </label>
                <select
                  value={resLevel}
                  onChange={(e) =>
                    setResLevel(e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')
                  }
                  className="w-full h-10 px-2 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Visibility
                </label>
                <select
                  value={resAccess}
                  onChange={(e) => setResAccess(e.target.value as 'basic' | 'full')}
                  className="w-full h-10 px-2 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="basic">Guest + Member</option>
                  <option value="full">Members Only</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Est. Hours
                </label>
                <input
                  type="number"
                  min={1}
                  value={resHours}
                  onChange={(e) => setResHours(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Problems
                </label>
                <input
                  type="number"
                  min={1}
                  value={resProblems}
                  onChange={(e) => setResProblems(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Summary
              </label>
              <textarea
                rows={2}
                required
                value={resSummary}
                onChange={(e) => setResSummary(e.target.value)}
                className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Topics (comma-separated)
              </label>
              <input
                type="text"
                value={resTopics}
                onChange={(e) => setResTopics(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Practice Link
              </label>
              <input
                type="url"
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400">
                  Study Guide / Notes Document (optional Google Drive PDF/Docs/Slides)
                </label>
                {resDocUrl.trim() && resDocValidation.valid && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    <span>Drive Doc Ready</span>
                  </span>
                )}
              </div>
              <input
                type="url"
                value={resDocUrl}
                onChange={(e) => setResDocUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                {resDocUrl.trim()
                  ? resDocValidation.valid
                    ? resDocValidation.hint
                    : resDocValidation.error
                  : DRIVE_SHARING_HINT}
              </p>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
            >
              Add Resource
            </button>
          </form>

          <div className="lg:col-span-7 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] h-fit">
            {resources.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
                No roadmap modules published yet.
              </p>
            ) : (
              resources.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r.track} · {r.level} · {r.access === 'basic' ? 'Public Basic' : 'Members Only'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteResource(r.id)}
                    aria-label={`Remove ${r.title}`}
                    className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: LEADERBOARD UPDATER */}
      {activeTab === 'leaderboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleLeaderboardSubmit}
            className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4 h-fit"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {lbEditId ? 'Update Coder Score' : 'Add Coder to Leaderboard'}
              </h2>
              {lbEditId && (
                <button
                  type="button"
                  onClick={() => {
                    setLbEditId(undefined);
                    setLbName('');
                    setLbReg('');
                  }}
                  className="text-xs text-slate-500"
                >
                  Clear
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Student Name
              </label>
              <input
                type="text"
                required
                value={lbName}
                onChange={(e) => setLbName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Register No.
                </label>
                <input
                  type="text"
                  required
                  value={lbReg}
                  onChange={(e) => setLbReg(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  HackerRank Handle
                </label>
                <input
                  type="text"
                  value={lbHandle}
                  onChange={(e) => setLbHandle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Department
                </label>
                <select
                  value={lbDept}
                  onChange={(e) => setLbDept(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Year
                </label>
                <select
                  value={lbYear}
                  onChange={(e) => setLbYear(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Score
                </label>
                <input
                  type="number"
                  min={0}
                  value={lbScore}
                  onChange={(e) => setLbScore(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Problems Solved
                </label>
                <input
                  type="number"
                  min={0}
                  value={lbSolved}
                  onChange={(e) => setLbSolved(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
            >
              {lbEditId ? 'Save Score Update' : 'Add to Leaderboard'}
            </button>
          </form>

          <div className="lg:col-span-7 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] max-h-[540px] overflow-y-auto">
            {leaderboard.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
                No coders added to the leaderboard yet.
              </p>
            ) : (
              [...leaderboard]
                .sort((a, b) => b.score - a.score)
                .map((entry, idx) => (
                  <div key={entry.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        <span className="font-mono text-[#009942] dark:text-[#00EA64] mr-2">
                          #{idx + 1}
                        </span>
                        {entry.name}
                      </p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {entry.department} · {entry.year} · {entry.score} pts ({entry.problemsSolved}{' '}
                        solved)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setLbEditId(entry.id);
                          setLbName(entry.name);
                          setLbReg(entry.registerNumber);
                          setLbDept(entry.department);
                          setLbYear(entry.year);
                          setLbScore(entry.score);
                          setLbSolved(entry.problemsSolved);
                          setLbHandle(entry.hackerRankHandle);
                        }}
                        className="px-2.5 py-1 rounded text-xs font-mono border border-slate-200 dark:border-slate-700 hover:border-[#00EA64]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLeaderboardEntry(entry.id)}
                        aria-label={`Remove ${entry.name}`}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: REGISTRATIONS (Export CSV ONLY for Campus Lead) */}
      {activeTab === 'registrations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                Event Registrations ({registrations.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {can('canExportRegistrations')
                  ? 'Campus Lead access: view and export attendee rosters as CSV.'
                  : 'Crew access: view-only attendee roster. CSV export is restricted to the Campus Lead.'}
              </p>
            </div>
            {/* Export CSV Buttons — Hidden for Crew, Visible ONLY to Lead / Admin */}
            {can('canExportRegistrations') && (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceExportEventId('all');
                    setAttendanceExportModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export Attendance CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportRegistrationsCSV}
                  className="px-3.5 py-2 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export Registrations CSV</span>
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] text-xs font-mono text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Register No.</th>
                  <th className="py-3 px-4">Dept & Year</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Entry Pass QR</th>
                  <th className="py-3 px-4 text-right">Registered At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No event registrations recorded yet.
                    </td>
                  </tr>
                ) : (
                  registrations.map((reg) => {
                    const ev = events.find((e) => e.id === reg.eventId);
                    const onlineEv = isOnlineEvent(ev);
                    const ticketCode =
                      reg.ticketCode || buildAttendeeTicketCode(reg.eventId, reg.userId);
                    return (
                      <tr key={reg.id}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900 dark:text-white">{reg.userName}</p>
                          <p className="text-xs text-slate-500">{reg.userEmail}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{reg.registerNumber}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {reg.department} · {reg.year}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                          {ev?.title ?? reg.eventId}
                        </td>
                        <td className="py-3 px-4">
                          {onlineEv ? (
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              Online · No QR
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                {ticketCode}
                              </span>
                              <button
                                type="button"
                                disabled={resendingTicketRegId === reg.id}
                                onClick={async () => {
                                  setResendingTicketRegId(reg.id);
                                  await resendEventTicketEmail(reg.id);
                                  setResendingTicketRegId(null);
                                }}
                                title="Email unique Entry Pass QR to student"
                                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300 hover:border-[#00EA64] disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                              >
                                <Mail className="w-3 h-3" aria-hidden="true" />
                                <span>
                                  {resendingTicketRegId === reg.id
                                    ? 'Sending…'
                                    : reg.ticketEmailStatus === 'sent'
                                    ? 'Resend QR'
                                    : 'Send QR'}
                                </span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-500">
                          {reg.registeredAt}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <UnstopCsvImporterPanel />
        </div>
      )}

      {/* TAB: QR CHECK-INS (Crew & Lead) */}
      {activeTab === 'checkins' && <EventCheckInQRGenerator />}

      {/* TAB: VERIFIABLE E-CERTIFICATES (Crew & Lead) */}
      {activeTab === 'certificates' && <CertificatesManagerPanel />}

      {/* TAB 7: PENDING APPROVALS (Campus Lead ONLY) */}
      {activeTab === 'approvals' && isLead && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Pending Crew Events ({pendingEvents.length})
            </h2>
            {pendingEvents.length === 0 ? (
              <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500">
                No pending event submissions right now.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-5 rounded-xl border border-amber-500/30 bg-white dark:bg-[#121821] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-amber-600 dark:text-amber-400">
                        Submitted by {ev.createdByName} · {ev.category} ·{' '}
                        {new Date(ev.dateISO).toLocaleDateString('en-IN')}
                      </p>
                      <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                        <Link
                          to={`/events/${encodeURIComponent(ev.id)}`}
                          className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                        >
                          {ev.title}
                        </Link>
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{ev.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => approveEvent(ev.id)}
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectEvent(ev.id)}
                        className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
              Pending Crew Announcements ({pendingAnnouncements.length})
            </h2>
            {pendingAnnouncements.length === 0 ? (
              <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500">
                No pending announcements waiting for review.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-5 rounded-xl border border-amber-500/30 bg-white dark:bg-[#121821] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-amber-600 dark:text-amber-400">
                        Draft by {ann.createdByName} · {ann.date} · Priority: {ann.priority}
                      </p>
                      <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                        {ann.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{ann.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => approveAnnouncement(ann.id)}
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectAnnouncement(ann.id)}
                        className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 8: JOIN INQUIRIES (Lead ONLY) */}
      {activeTab === 'join_requests' && isLead && <JoinRequestsPanel />}

      {/* TAB 9: SITE SETTINGS (Lead ONLY) */}
      {activeTab === 'settings' && isLead && <SiteSettingsPanel />}
        </div>
      </div>

      {can('canExportRegistrations') && (
        <AttendanceCsvExportModal
          open={attendanceExportModalOpen}
          initialEventId={attendanceExportEventId}
          onClose={() => setAttendanceExportModalOpen(false)}
        />
      )}
    </div>
  );
};
