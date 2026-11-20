import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { CampusEvent, UserRole } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getCountdownParts(targetMs: number, nowMs: number): CountdownParts {
  const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  return { days, hours, minutes, seconds };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const UpcomingEventsTicker: React.FC = () => {
  const { authReady } = useApp();
  const [liveEvents, setLiveEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [manualIndex, setManualIndex] = useState<number | null>(null);

  // Real-time Firestore listener strictly scoped to approved events (public-safe)
  useEffect(() => {
    if (!authReady) return;

    const approvedEventsQuery = query(
      collection(db, 'events'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(
      approvedEventsQuery,
      (snap) => {
        const mapped: CampusEvent[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            title: String(x.title || ''),
            category: (x.category as CampusEvent['category']) || 'Workshop',
            dateISO: String(x.dateISO || new Date().toISOString()),
            venue: String(x.venue || ''),
            description: String(x.description || ''),
            membersOnly: Boolean(x.membersOnly),
            capacity: Number(x.capacity || 100),
            status: 'approved',
            createdByName: String(x.createdByName || 'Crew'),
            createdByRole: (x.createdByRole as UserRole) || 'crew',
            bannerImage: String(x.bannerImage || ''),
          };
        });
        setLiveEvents(mapped);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'events');
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  // 1-second live countdown clock
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Sort upcoming approved events chronologically, prioritizing Contest & Workshop first on initial focus
  const upcomingEvents = useMemo(() => {
    return liveEvents
      .filter((ev) => {
        const ts = new Date(ev.dateISO).getTime();
        return Number.isFinite(ts) && ts > nowMs;
      })
      .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
  }, [liveEvents, nowMs]);

  const defaultIndex = useMemo(() => {
    if (upcomingEvents.length === 0) return 0;
    const contestOrWorkshopIdx = upcomingEvents.findIndex(
      (ev) => ev.category === 'Contest' || ev.category === 'Workshop'
    );
    return contestOrWorkshopIdx >= 0 ? contestOrWorkshopIdx : 0;
  }, [upcomingEvents]);

  const activeIndex = useMemo(() => {
    if (upcomingEvents.length === 0) return 0;
    if (manualIndex === null) return defaultIndex;
    return ((manualIndex % upcomingEvents.length) + upcomingEvents.length) % upcomingEvents.length;
  }, [upcomingEvents.length, manualIndex, defaultIndex]);

  const activeEvent = upcomingEvents[activeIndex];

  if (loading) {
    return (
      <section
        aria-label="Upcoming Events Ticker"
        className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D131B]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="h-5 w-64 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-44 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </section>
    );
  }

  if (!activeEvent) {
    return (
      <section
        aria-label="Upcoming Events Ticker"
        className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D131B]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Timer
              className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
              aria-hidden="true"
            />
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              Upcoming Events
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span>No upcoming coding contests or workshops scheduled right now.</span>
          </div>
          <Link
            to="/events"
            className="font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
          >
            Browse event archive →
          </Link>
        </div>
      </section>
    );
  }

  const targetMs = new Date(activeEvent.dateISO).getTime();
  const countdown = getCountdownParts(targetMs, nowMs);
  const formattedDate = new Date(activeEvent.dateISO).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrev = () => {
    if (upcomingEvents.length <= 1) return;
    setManualIndex(activeIndex - 1);
  };

  const handleNext = () => {
    if (upcomingEvents.length <= 1) return;
    setManualIndex(activeIndex + 1);
  };

  return (
    <section
      aria-label="Upcoming Events Live Countdown Ticker"
      className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D131B]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Live Event Details */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <Timer
            className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5 sm:mt-0"
            aria-hidden="true"
          />
          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-mono font-semibold text-[#009942] dark:text-[#00EA64] whitespace-nowrap shrink-0">
              Upcoming Events
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <Link
              to="/events"
              className="font-mono font-semibold text-slate-900 dark:text-white hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors truncate max-w-[240px] sm:max-w-[340px] md:max-w-md"
              title={activeEvent.title}
            >
              {activeEvent.title}
            </Link>
            <span aria-hidden="true" className="text-slate-400 hidden sm:inline">
              ·
            </span>
            <span className="text-slate-600 dark:text-slate-400 truncate">
              {activeEvent.category} · {formattedDate} · {activeEvent.venue}
            </span>
          </div>
        </div>

        {/* Right: Live Ticking Countdown + Switcher */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div
            className="flex items-center gap-1.5 font-mono text-xs tabular-nums"
            aria-live="off"
            aria-label={`Countdown: ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds`}
          >
            <span className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121821] text-slate-900 dark:text-white font-semibold whitespace-nowrap">
              {pad2(countdown.days)}d
            </span>
            <span className="text-slate-400" aria-hidden="true">
              :
            </span>
            <span className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121821] text-slate-900 dark:text-white font-semibold whitespace-nowrap">
              {pad2(countdown.hours)}h
            </span>
            <span className="text-slate-400" aria-hidden="true">
              :
            </span>
            <span className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121821] text-slate-900 dark:text-white font-semibold whitespace-nowrap">
              {pad2(countdown.minutes)}m
            </span>
            <span className="text-slate-400" aria-hidden="true">
              :
            </span>
            <span className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121821] text-[#009942] dark:text-[#00EA64] font-semibold whitespace-nowrap">
              {pad2(countdown.seconds)}s
            </span>
          </div>

          {upcomingEvents.length > 1 && (
            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2.5">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous upcoming event"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#00EA64] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 px-1 whitespace-nowrap">
                {activeIndex + 1}/{upcomingEvents.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next upcoming event"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#00EA64] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <Link
            to="/events"
            className="font-mono text-xs text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
          >
            Register →
          </Link>
        </div>
      </div>
    </section>
  );
};
