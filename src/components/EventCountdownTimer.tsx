import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export interface EventCountdownTimerProps {
  targetDateISO: string;
  formattedStartDate: string;
  venue?: string;
  onExpire?: () => void;
}

interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeRemaining(targetMs: number, nowMs: number): CountdownParts | null {
  if (!Number.isFinite(targetMs)) return null;
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { totalMs: diff, days, hours, minutes, seconds };
}

export const EventCountdownTimer: React.FC<EventCountdownTimerProps> = ({
  targetDateISO,
  formattedStartDate,
  venue,
  onExpire,
}) => {
  const targetMs = new Date(targetDateISO).getTime();
  const [remaining, setRemaining] = useState<CountdownParts | null>(() =>
    computeRemaining(targetMs, Date.now())
  );

  useEffect(() => {
    const initial = computeRemaining(targetMs, Date.now());
    setRemaining(initial);
    if (!initial) return;

    const timerId = window.setInterval(() => {
      const next = computeRemaining(targetMs, Date.now());
      if (!next) {
        setRemaining(null);
        window.clearInterval(timerId);
        onExpire?.();
        return;
      }
      setRemaining(next);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [targetMs, onExpire]);

  if (!remaining) return null;

  const isUnderOneHour = remaining.totalMs <= 60 * 60 * 1000;
  const isUnder24Hours = remaining.totalMs <= 24 * 60 * 60 * 1000;

  const urgencyLabel = isUnderOneHour
    ? 'Starting Within 1 Hour'
    : isUnder24Hours
      ? 'Starting Within 24 Hours'
      : 'Upcoming Event Countdown';

  const units = [
    { label: 'Days', value: remaining.days },
    { label: 'Hours', value: remaining.hours },
    { label: 'Minutes', value: remaining.minutes },
    { label: 'Seconds', value: remaining.seconds },
  ] as const;

  return (
    <section
      aria-label={`Time remaining until event starts on ${formattedStartDate}`}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] px-5 py-4 sm:px-6 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div className="space-y-1 min-w-0">
        <p
          className={`font-mono text-xs font-semibold inline-flex items-center gap-1.5 ${
            isUnder24Hours
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-[#009942] dark:text-[#00EA64]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{urgencyLabel}</span>
        </p>
        <h2 className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          Time Remaining Until Event Start
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          <span>Starts {formattedStartDate}</span>
          {venue ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>{venue}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* Live 4-Unit Monospace Tabular Countdown */}
      <div
        aria-live="off"
        className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800 border-t md:border-t-0 pt-3 md:pt-0 shrink-0"
      >
        {units.map((unit, idx) => (
          <div
            key={unit.label}
            className={`px-3 sm:px-4 text-center min-w-[4rem] sm:min-w-[4.75rem] ${
              idx === 0 ? 'pl-0 md:pl-4' : ''
            } ${idx === units.length - 1 ? 'pr-0' : ''}`}
          >
            <p
              className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums leading-none ${
                idx === units.length - 1
                  ? isUnder24Hours
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-[#009942] dark:text-[#00EA64]'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {String(unit.value).padStart(2, '0')}
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {unit.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EventCountdownTimer;
