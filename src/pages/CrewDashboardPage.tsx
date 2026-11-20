import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Download,
  Edit3,
  Mail,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  ACADEMIC_YEARS,
  CHAPTER_IMAGES,
  CampusEvent,
  DEPARTMENTS,
  GalleryPhoto,
  ResourceTrack,
} from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

import { MemberDirectoryPanel, JoinRequestsPanel, SiteSettingsPanel } from './AdminPanelPage';
import { EventCheckInQRGenerator } from '../components/EventCheckInQRGenerator';

type DashboardTab =
  | 'members'
  | 'events'
  | 'checkins'
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
    eventCheckIns,
    joinRequests,
    createEvent,
    updateEvent,
    deleteEvent,
    approveEvent,
    rejectEvent,
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
  } = useApp();

  const isLead = can('canApproveContent') && mode !== 'crew';
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    mode === 'lead' ? 'members' : 'events'
  );

  // Event form state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evCategory, setEvCategory] = useState<CampusEvent['category']>('Workshop');
  const [evDate, setEvDate] = useState('2026-12-28T10:00');
  const [evVenue, setEvVenue] = useState('CSE Seminar Hall, Paavai Campus');
  const [evDesc, setEvDesc] = useState('');
  const [evCapacity, setEvCapacity] = useState(120);
  const [evMembersOnly, setEvMembersOnly] = useState(false);

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
  const [resTopics, setResTopics] = useState('Graphs, Greedy, Complexity');

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

  const tabs: Array<{ id: DashboardTab; label: string; badge?: number }> = [
    ...(isLead ? [{ id: 'members' as const, label: 'Member Management', badge: users.length }] : []),
    { id: 'events', label: 'Events' },
    { id: 'checkins', label: 'QR Check-Ins', badge: eventCheckIns.length },
    { id: 'announcements', label: 'Announcements' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'resources', label: 'Resources' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'registrations', label: 'Registrations' },
    ...(isLead
      ? [
          { id: 'approvals' as const, label: 'Pending Content', badge: totalPending },
          { id: 'join_requests' as const, label: 'Join Inquiries', badge: pendingJoinCount },
          { id: 'settings' as const, label: 'Site Settings' },
        ]
      : []),
  ];

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evDesc.trim()) return;
    if (editingEventId && can('canEditDeleteAnyEvent')) {
      updateEvent(editingEventId, {
        title: evTitle.trim(),
        category: evCategory,
        dateISO: new Date(evDate).toISOString(),
        venue: evVenue.trim(),
        description: evDesc.trim(),
        capacity: Number(evCapacity) || 100,
        membersOnly: evMembersOnly,
      });
      setEditingEventId(null);
    } else {
      createEvent({
        title: evTitle.trim(),
        category: evCategory,
        dateISO: new Date(evDate).toISOString(),
        venue: evVenue.trim(),
        description: evDesc.trim(),
        capacity: Number(evCapacity) || 100,
        membersOnly: evMembersOnly,
        bannerImage: CHAPTER_IMAGES.hackathonArena,
      });
    }
    setEvTitle('');
    setEvDesc('');
  };

  const startEditEvent = (ev: CampusEvent) => {
    setEditingEventId(ev.id);
    setEvTitle(ev.title);
    setEvCategory(ev.category);
    setEvDate(ev.dateISO.slice(0, 16));
    setEvVenue(ev.venue);
    setEvDesc(ev.description);
    setEvCapacity(ev.capacity);
    setEvMembersOnly(ev.membersOnly);
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
    if (!galTitle.trim() || !galCaption.trim()) return;
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
    addResource({
      title: resTitle.trim(),
      track: resTrack,
      level: resLevel,
      access: resAccess,
      estimatedHours: Number(resHours) || 6,
      problemCount: Number(resProblems) || 20,
      summary: resSummary.trim(),
      url: resUrl.trim() || 'https://www.hackerrank.com',
      topics: resTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setResTitle('');
    setResSummary('');
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

        {/* Summary Metrics */}
        <div className="flex items-center gap-6 text-xs font-mono shrink-0">
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
          {isLead && (
            <Link
              to="/debug/emails"
              className="px-3 py-2 rounded-lg text-xs font-mono font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              <span>Email Debug Logs</span>
            </Link>
          )}
        </div>
      </header>

      {/* Dashboard Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                : 'bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#00EA64]/50'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                  activeTab === tab.id
                    ? 'bg-[#0B0F14] text-[#00EA64]'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

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
                  onClick={() => {
                    setEditingEventId(null);
                    setEvTitle('');
                    setEvDesc('');
                  }}
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
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={evDate}
                  onChange={(e) => setEvDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={evVenue}
                  onChange={(e) => setEvVenue(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
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
                events.map((ev) => (
                  <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate">
                        {ev.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ev.category} · {new Date(ev.dateISO).toLocaleDateString('en-IN')} · By{' '}
                        {ev.createdByName} ·{' '}
                        <span className={`font-mono font-semibold capitalize ${statusTextClass(ev.status)}`}>
                          {ev.status}
                        </span>
                      </p>
                    </div>
                    {can('canEditDeleteAnyEvent') && (
                      <div className="flex items-center gap-2 shrink-0">
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
                      </div>
                    )}
                  </div>
                ))
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
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Image URL
              </label>
              <input
                type="text"
                required
                value={galUrl}
                onChange={(e) => setGalUrl(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
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
            {/* Export CSV Button — Hidden for Crew, Visible ONLY to Lead */}
            {can('canExportRegistrations') && (
              <button
                type="button"
                onClick={exportRegistrationsCSV}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
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
                  <th className="py-3 px-4 text-right">Registered At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No event registrations recorded yet.
                    </td>
                  </tr>
                ) : (
                  registrations.map((reg) => {
                    const ev = events.find((e) => e.id === reg.eventId);
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
        </div>
      )}

      {/* TAB: QR CHECK-INS (Crew & Lead) */}
      {activeTab === 'checkins' && <EventCheckInQRGenerator />}

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
                        {ev.title}
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
  );
};
