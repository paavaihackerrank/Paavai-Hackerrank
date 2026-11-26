import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, QrCode } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface DashboardWidgetProps {
  onOpenCheckIns?: () => void;
}

interface MonthlyAttendanceDatum {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  attendance: number;
  registrations: number;
  eventsCount: number;
}

type ChartSeriesMode = 'attendance' | 'compare';

function toYearMonthKey(rawDate?: string): string | null {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    payload?: MonthlyAttendanceDatum;
  }>;
}

const AttendanceTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  const turnoutPct =
    datum.registrations > 0
      ? Math.min(100, Math.round((datum.attendance / datum.registrations) * 100))
      : null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E141C] px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-mono font-semibold text-slate-900 dark:text-white mb-1.5">
        {datum.fullMonthLabel}
      </p>
      <div className="space-y-1 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Verified Attendance</span>
          <span className="font-bold text-[#009942] dark:text-[#00EA64]">
            {datum.attendance.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Registrations</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {datum.registrations.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Events Hosted</span>
          <span className="text-slate-700 dark:text-slate-300">{datum.eventsCount}</span>
        </div>
        {turnoutPct !== null && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Turnout Rate</span>
            <span className="font-semibold text-slate-900 dark:text-white">{turnoutPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ onOpenCheckIns }) => {
  const { events, eventCheckIns, registrations } = useApp();
  const [seriesMode, setSeriesMode] = useState<ChartSeriesMode>('attendance');

  const { chartData, totalAttendance, totalRegistrations, peakMonth, avgMonthly } = useMemo(() => {
    const now = new Date();
    const buckets: MonthlyAttendanceDatum[] = [];
    const bucketMap = new Map<string, MonthlyAttendanceDatum>();

    // Build chronological buckets for the last 6 months (inclusive of current month)
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullMonthLabel = d.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      const entry: MonthlyAttendanceDatum = {
        monthKey,
        monthLabel,
        fullMonthLabel,
        attendance: 0,
        registrations: 0,
        eventsCount: 0,
      };
      buckets.push(entry);
      bucketMap.set(monthKey, entry);
    }

    const eventDateById = new Map<string, string>();
    events.forEach((ev) => {
      eventDateById.set(ev.id, ev.dateISO);
      if (ev.status === 'approved') {
        const key = toYearMonthKey(ev.dateISO);
        if (key && bucketMap.has(key)) {
          bucketMap.get(key)!.eventsCount += 1;
        }
      }
    });

    eventCheckIns.forEach((chk) => {
      const key =
        toYearMonthKey(chk.checkedInAt) || toYearMonthKey(eventDateById.get(chk.eventId));
      if (key && bucketMap.has(key)) {
        bucketMap.get(key)!.attendance += 1;
      }
    });

    registrations.forEach((reg) => {
      const key =
        toYearMonthKey(eventDateById.get(reg.eventId)) || toYearMonthKey(reg.registeredAt);
      if (key && bucketMap.has(key)) {
        bucketMap.get(key)!.registrations += 1;
      }
    });

    const totalAtt = buckets.reduce((sum, item) => sum + item.attendance, 0);
    const totalReg = buckets.reduce((sum, item) => sum + item.registrations, 0);
    const peak = buckets.reduce<MonthlyAttendanceDatum | null>(
      (best, item) => (!best || item.attendance > best.attendance ? item : best),
      null
    );

    return {
      chartData: buckets,
      totalAttendance: totalAtt,
      totalRegistrations: totalReg,
      peakMonth: peak && peak.attendance > 0 ? peak : null,
      avgMonthly: Math.round(totalAtt / buckets.length),
    };
  }, [events, eventCheckIns, registrations]);

  const hasAnyAttendance = totalAttendance > 0;
  const hasAnySeriesData =
    seriesMode === 'attendance' ? totalAttendance > 0 : totalAttendance > 0 || totalRegistrations > 0;

  return (
    <section
      aria-label="Event attendance over the last 6 months"
      className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-5 sm:p-6 flex flex-col justify-between gap-5"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3
              className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
              aria-hidden="true"
            />
            <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white truncate">
              Event Attendance · Last 6 Months
            </h2>
          </div>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            <span>
              Total Checked In:{' '}
              <strong className="text-slate-900 dark:text-white">
                {totalAttendance.toLocaleString()}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Avg / Month:{' '}
              <strong className="text-slate-900 dark:text-white">
                {avgMonthly.toLocaleString()}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Peak:{' '}
              <strong className="text-[#009942] dark:text-[#00EA64]">
                {peakMonth ? `${peakMonth.monthLabel} (${peakMonth.attendance})` : 'No check-ins yet'}
              </strong>
            </span>
          </p>
        </div>

        {/* Interactive Mode Switcher */}
        <div
          role="group"
          aria-label="Chart metric view"
          className="inline-flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] self-start sm:self-auto shrink-0"
        >
          <button
            type="button"
            onClick={() => setSeriesMode('attendance')}
            aria-pressed={seriesMode === 'attendance'}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors ${
              seriesMode === 'attendance'
                ? 'bg-[#00EA64] text-[#0B0F14]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={() => setSeriesMode('compare')}
            aria-pressed={seriesMode === 'compare'}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors ${
              seriesMode === 'compare'
                ? 'bg-[#00EA64] text-[#0B0F14]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            vs. Registrations
          </button>
        </div>
      </div>

      {/* Bar Chart Viewport */}
      <div className="w-full h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
            barGap={6}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(148, 163, 184, 0.22)"
            />
            <XAxis
              dataKey="monthLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.15))]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              content={<AttendanceTooltip />}
            />
            {seriesMode === 'compare' && (
              <Bar
                dataKey="registrations"
                name="Registrations"
                fill="#64748B"
                fillOpacity={0.45}
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            )}
            <Bar
              dataKey="attendance"
              name="Verified Attendance"
              fill="#00EA64"
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Empty State Guidance Footer */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 font-mono text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#00EA64]" aria-hidden="true" />
            <span>Verified QR Attendance</span>
          </span>
          {seriesMode === 'compare' && (
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-500/50" aria-hidden="true" />
              <span>Portal Registrations ({totalRegistrations.toLocaleString()})</span>
            </span>
          )}
        </div>

        {!hasAnySeriesData && (
          <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              {hasAnyAttendance
                ? ''
                : 'Attendance bars update live as Campus Crew scans student QR passes.'}
            </span>
            {onOpenCheckIns && (
              <button
                type="button"
                onClick={onOpenCheckIns}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Open QR Scanner</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export { MemberCheckInSummaryWidget } from './MemberCheckInSummaryWidget';
export default DashboardWidget;
