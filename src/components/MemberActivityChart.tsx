import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CodingActivity, LearningResource } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

interface MemberActivityChartProps {
  resources: LearningResource[];
  completedResourceIds: string[];
  codingActivities: CodingActivity[];
  joinedAt?: string;
}

type RangeDays = 14 | 30 | 90;
type ChartMode = 'cumulative' | 'daily';

interface ChartPoint {
  date: string;
  label: string;
  dsaDaily: number;
  otherDaily: number;
  cumulativeDsa: number;
}

function toLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export const MemberActivityChart: React.FC<MemberActivityChartProps> = ({
  resources,
  completedResourceIds,
  codingActivities,
  joinedAt,
}) => {
  const { theme } = useApp();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [chartMode, setChartMode] = useState<ChartMode>('cumulative');

  const isDark = theme === 'dark';

  const dsaResources = useMemo(
    () => resources.filter((r) => r.track === 'DSA'),
    [resources]
  );

  const completedDsaCount = useMemo(
    () => dsaResources.filter((r) => completedResourceIds.includes(r.id)).length,
    [dsaResources, completedResourceIds]
  );

  const { chartData, activeDaysInRange, periodDsaCompletions, periodAllCompletions } =
    useMemo(() => {
      const today = new Date();
      const endDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startDay = new Date(endDay);
      startDay.setDate(endDay.getDate() - (rangeDays - 1));
      const startStr = toLocalYYYYMMDD(startDay);

      // Aggregate logged coding_activities per date
      const dsaMap = new Map<string, number>();
      const otherMap = new Map<string, number>();
      let loggedDsaBeforeStart = 0;
      let totalLoggedDsaAllTime = 0;

      for (const act of codingActivities) {
        if (!act.date) continue;
        if (act.platform === 'DSA Roadmap') {
          totalLoggedDsaAllTime += act.count;
          if (act.date < startStr) {
            loggedDsaBeforeStart += act.count;
          } else {
            dsaMap.set(act.date, (dsaMap.get(act.date) ?? 0) + act.count);
          }
        } else if (act.date >= startStr) {
          otherMap.set(act.date, (otherMap.get(act.date) ?? 0) + act.count);
        }
      }

      // Reconcile baseline DSA modules completed in user_progress prior to coding_activities logging
      const baselineUnloggedDsa = Math.max(0, completedDsaCount - totalLoggedDsaAllTime);
      let baselinePlacedInWindow = false;
      const anchorDate =
        joinedAt && /^\d{4}-\d{2}-\d{2}$/.test(joinedAt) && joinedAt >= startStr
          ? joinedAt
          : startStr;

      let runningCumulative =
        loggedDsaBeforeStart + (anchorDate < startStr ? baselineUnloggedDsa : 0);
      let activeDays = 0;
      let dsaSum = 0;
      let allSum = 0;

      const points: ChartPoint[] = [];
      const cursor = new Date(startDay);

      while (cursor <= endDay) {
        const key = toLocalYYYYMMDD(cursor);
        let dsaCount = dsaMap.get(key) ?? 0;
        if (baselineUnloggedDsa > 0 && !baselinePlacedInWindow && key >= anchorDate) {
          dsaCount += baselineUnloggedDsa;
          baselinePlacedInWindow = true;
        }
        const otherCount = otherMap.get(key) ?? 0;

        runningCumulative += dsaCount;
        dsaSum += dsaCount;
        allSum += dsaCount + otherCount;
        if (dsaCount + otherCount > 0) activeDays += 1;

        points.push({
          date: key,
          label: formatShortLabel(key),
          dsaDaily: dsaCount,
          otherDaily: otherCount,
          cumulativeDsa: runningCumulative,
        });

        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        chartData: points,
        activeDaysInRange: activeDays,
        periodDsaCompletions: dsaSum,
        periodAllCompletions: allSum,
      };
    }, [codingActivities, completedDsaCount, joinedAt, rangeDays]);

  const hasAnyActivity = completedDsaCount > 0 || periodAllCompletions > 0;

  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const accentColor = isDark ? '#00EA64' : '#009942';
  const secondaryColor = isDark ? '#38bdf8' : '#0284c7';

  return (
    <section
      aria-labelledby="member-activity-heading"
      className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Member Activity · Learning Journey</span>
          </p>
          <h2
            id="member-activity-heading"
            className="font-mono text-lg font-bold text-slate-900 dark:text-white"
          >
            Completed DSA Roadmap Modules Over Time
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Mode Toggle */}
          <div
            role="tablist"
            aria-label="Chart visualization mode"
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === 'cumulative'}
              onClick={() => setChartMode('cumulative')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'cumulative'
                  ? 'bg-white dark:bg-[#121821] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cumulative Trend
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === 'daily'}
              onClick={() => setChartMode('daily')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'daily'
                  ? 'bg-white dark:bg-[#121821] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Daily Activity
            </button>
          </div>

          {/* Timeframe Selector */}
          <div
            role="tablist"
            aria-label="Chart date range"
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800"
          >
            {([14, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                role="tab"
                aria-selected={rangeDays === days}
                onClick={() => setRangeDays(days)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                  rangeDays === days
                    ? 'bg-white dark:bg-[#121821] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2">
        <div>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            DSA Modules Completed
          </p>
          <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {completedDsaCount} / {dsaResources.length}
          </p>
        </div>
        <div>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Roadmap Completions ({rangeDays}d)
          </p>
          <p className="font-mono text-xl font-bold tabular-nums text-[#009942] dark:text-[#00EA64]">
            {periodDsaCompletions}
          </p>
        </div>
        <div>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Active Coding Days ({rangeDays}d)
          </p>
          <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {activeDaysInRange}
          </p>
        </div>
      </div>

      {/* Recharts Visualization or Actionable Empty State */}
      {!hasAnyActivity ? (
        <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#0B0F14] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Your learning trend chart will populate as you complete modules
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mark any DSA module complete above or on the Learning Roadmap to plot your progress
              over time.
            </p>
          </div>
          <Link
            to="/resources"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <span>Start DSA Roadmap</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="w-full h-[260px]" aria-label="DSA roadmap module completion chart">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'cumulative' ? (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dsaCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.32} />
                    <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0B0F14' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value, name) => {
                    if (name === 'cumulativeDsa') {
                      return [`${value} modules`, 'Cumulative DSA'];
                    }
                    return [`${value}`, String(name)];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeDsa"
                  name="cumulativeDsa"
                  stroke={accentColor}
                  strokeWidth={2.25}
                  fillOpacity={1}
                  fill="url(#dsaCumulativeFill)"
                  activeDot={{ r: 5, fill: accentColor }}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0B0F14' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value, name) => {
                    if (name === 'dsaDaily') return [`${value}`, 'DSA Roadmap'];
                    if (name === 'otherDaily') return [`${value}`, 'Other Platforms'];
                    return [`${value}`, String(name)];
                  }}
                />
                <Bar
                  dataKey="dsaDaily"
                  name="dsaDaily"
                  stackId="activity"
                  fill={accentColor}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="otherDaily"
                  name="otherDaily"
                  stackId="activity"
                  fill={secondaryColor}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
