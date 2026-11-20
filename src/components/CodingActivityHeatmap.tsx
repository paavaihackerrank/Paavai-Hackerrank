import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2, X } from 'lucide-react';
import {
  CODING_PLATFORMS,
  CodingActivity,
  CodingPlatform,
  EventCheckIn,
  UserAccount,
} from '../config/rbacAndData';

interface CodingActivityHeatmapProps {
  user: UserAccount;
  codingActivities: CodingActivity[];
  eventCheckIns: EventCheckIn[];
  onLogActivity: (payload: {
    platform: CodingPlatform;
    date: string;
    count: number;
    title: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteActivity: (activityId: string) => Promise<void>;
}

interface UnifiedActivityEntry {
  id: string;
  platform: CodingPlatform;
  date: string;
  count: number;
  title: string;
  source: 'logged' | 'checkin';
}

interface HeatmapCell {
  date: string;
  count: number;
  inRange: boolean;
  monthIndex: number;
  dayOfMonth: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getIntensityClass(count: number): string {
  if (count <= 0) {
    return 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800';
  }
  if (count <= 2) {
    return 'bg-[#9be9a8] dark:bg-[#0e4429] border border-[#84d894] dark:border-[#135c37]';
  }
  if (count <= 4) {
    return 'bg-[#40c463] dark:bg-[#006d32] border border-[#34b355] dark:border-[#00873f]';
  }
  if (count <= 7) {
    return 'bg-[#30a14e] dark:bg-[#26a641] border border-[#278c41] dark:border-[#2fc450]';
  }
  return 'bg-[#216e39] dark:bg-[#00EA64] border border-[#19572d] dark:border-[#00d35a]';
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const CodingActivityHeatmap: React.FC<CodingActivityHeatmapProps> = ({
  user,
  codingActivities,
  eventCheckIns,
  onLogActivity,
  onDeleteActivity,
}) => {
  const todayStr = useMemo(() => toLocalYYYYMMDD(new Date()), []);
  const [platformFilter, setPlatformFilter] = useState<'All' | CodingPlatform>('All');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number } | null>(null);

  // Inline log completion form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [formPlatform, setFormPlatform] = useState<CodingPlatform>('HackerRank');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formCount, setFormCount] = useState<string>('2');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Combine Firestore coding_activities with the user's QR event check-ins
  const unifiedEntries = useMemo<UnifiedActivityEntry[]>(() => {
    const logged: UnifiedActivityEntry[] = codingActivities.map((act) => ({
      id: act.id,
      platform: act.platform,
      date: act.date,
      count: act.count,
      title: act.title,
      source: 'logged',
    }));

    const checkIns: UnifiedActivityEntry[] = eventCheckIns
      .filter((c) => c.userId === user.id && c.checkedInAt)
      .map((c) => ({
        id: `chk_${c.id}`,
        platform: 'Campus Event',
        date: c.checkedInAt.slice(0, 10),
        count: 1,
        title: `Checked in: ${c.eventTitle}`,
        source: 'checkin',
      }));

    return [...logged, ...checkIns].sort((a, b) => b.date.localeCompare(a.date));
  }, [codingActivities, eventCheckIns, user.id]);

  const filteredEntries = useMemo(() => {
    if (platformFilter === 'All') return unifiedEntries;
    return unifiedEntries.filter((entry) => entry.platform === platformFilter);
  }, [unifiedEntries, platformFilter]);

  // Daily count map
  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of filteredEntries) {
      map.set(entry.date, (map.get(entry.date) ?? 0) + entry.count);
    }
    return map;
  }, [filteredEntries]);

  // Build 53-week (371-day aligned Sun-Sat) calendar grid ending on today's week
  const { weeks, monthLabels, totalCompletions, activeDays, currentStreak, longestStreak } =
    useMemo(() => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startApprox = new Date(today);
      startApprox.setDate(today.getDate() - 364);

      // Align grid start to Sunday on or before startApprox
      const gridStart = new Date(startApprox);
      gridStart.setDate(startApprox.getDate() - startApprox.getDay());

      const builtWeeks: HeatmapCell[][] = [];
      const labels: { weekIdx: number; label: string }[] = [];
      let lastLabeledMonth = -1;

      const cursor = new Date(gridStart);
      let weekIdx = 0;

      while (cursor <= today || builtWeeks.length < 53) {
        const weekCols: HeatmapCell[] = [];
        let weekHasNewMonth = -1;

        for (let dow = 0; dow < 7; dow += 1) {
          const cellDateStr = toLocalYYYYMMDD(cursor);
          const inRange = cursor >= startApprox && cursor <= today;
          const count = inRange ? (countsByDate.get(cellDateStr) ?? 0) : 0;

          if (inRange && (cursor.getDate() === 1 || (weekIdx === 0 && dow === cursor.getDay()))) {
            if (cursor.getMonth() !== lastLabeledMonth) {
              weekHasNewMonth = cursor.getMonth();
            }
          }

          weekCols.push({
            date: cellDateStr,
            count,
            inRange,
            monthIndex: cursor.getMonth(),
            dayOfMonth: cursor.getDate(),
          });

          cursor.setDate(cursor.getDate() + 1);
        }

        if (weekHasNewMonth !== -1) {
          // Ensure minimum 3 columns spacing between month labels so text never collides
          const prevLabel = labels[labels.length - 1];
          if (!prevLabel || weekIdx - prevLabel.weekIdx >= 3) {
            labels.push({ weekIdx, label: MONTH_NAMES[weekHasNewMonth] });
            lastLabeledMonth = weekHasNewMonth;
          }
        }

        builtWeeks.push(weekCols);
        weekIdx += 1;
        if (cursor > today && builtWeeks.length >= 52) break;
      }

      // Compute summary metrics over the 365-day window
      let total = 0;
      let active = 0;
      let longest = 0;
      let running = 0;
      const dayCursor = new Date(startApprox);
      const dayStatuses: number[] = [];

      while (dayCursor <= today) {
        const key = toLocalYYYYMMDD(dayCursor);
        const c = countsByDate.get(key) ?? 0;
        dayStatuses.push(c);
        total += c;
        if (c > 0) {
          active += 1;
          running += 1;
          if (running > longest) longest = running;
        } else {
          running = 0;
        }
        dayCursor.setDate(dayCursor.getDate() + 1);
      }

      // Current streak: consecutive active days ending today (or yesterday if today hasn't been logged yet)
      let current = 0;
      let idx = dayStatuses.length - 1;
      if (idx >= 0 && dayStatuses[idx] === 0) {
        idx -= 1;
      }
      while (idx >= 0 && dayStatuses[idx] > 0) {
        current += 1;
        idx -= 1;
      }

      return {
        weeks: builtWeeks,
        monthLabels: labels,
        totalCompletions: total,
        activeDays: active,
        currentStreak: current,
        longestStreak: longest,
      };
    }, [countsByDate]);

  const selectedDayEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.date === selectedDate),
    [filteredEntries, selectedDate]
  );

  const selectedDayTotal = useMemo(
    () => selectedDayEntries.reduce((sum, item) => sum + item.count, 0),
    [selectedDayEntries]
  );

  const recentEntries = useMemo(() => filteredEntries.slice(0, 5), [filteredEntries]);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedCount = Math.floor(Number(formCount));
    if (!Number.isFinite(parsedCount) || parsedCount < 1 || parsedCount > 500) {
      setFormError('Enter a completion count between 1 and 500.');
      return;
    }
    if (formTitle.trim().length < 2) {
      setFormError('Describe what you solved or pushed (min 2 characters).');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      setFormError('Select a valid date.');
      return;
    }

    setSubmitting(true);
    const res = await onLogActivity({
      platform: formPlatform,
      date: formDate,
      count: parsedCount,
      title: formTitle.trim(),
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Could not log activity.');
      return;
    }

    setSelectedDate(formDate);
    setFormTitle('');
    setFormCount('2');
    setShowLogForm(false);
  };

  return (
    <section
      aria-label="Coding Activity Contribution Heatmap"
      className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6"
    >
      {/* Header + Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays
              className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
              aria-hidden="true"
            />
            <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              Coding Activity Heatmap
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualizing logged completions across HackerRank, LeetCode, GitHub, CodeChef, DSA
            Roadmap, and Campus Events over the past 12 months.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowLogForm((prev) => !prev);
          }}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          {showLogForm ? (
            <>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Close Form</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Log Completion</span>
            </>
          )}
        </button>
      </div>

      {/* Inline Log Completion Form */}
      {showLogForm && (
        <form
          onSubmit={handleLogSubmit}
          className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Platform
              </label>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value as CodingPlatform)}
                className="w-full h-9 px-2.5 rounded-md text-xs bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {CODING_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                max={todayStr}
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full h-9 px-2.5 rounded-md text-xs font-mono bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Solved / Count
              </label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={formCount}
                onChange={(e) => setFormCount(e.target.value)}
                className="w-full h-9 px-2.5 rounded-md text-xs font-mono tabular-nums bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                Topic / Problem / Commit Summary
              </label>
              <input
                type="text"
                required
                maxLength={140}
                placeholder="e.g., Dynamic Programming · Knapsack & LIS"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full h-9 px-2.5 rounded-md text-xs bg-white dark:bg-[#121821] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{formError}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLogForm(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Completion'}
            </button>
          </div>
        </form>
      )}

      {/* Platform Filter Tabs (Interactive Filter Control Buttons) */}
      <div
        role="tablist"
        aria-label="Filter coding activity by platform"
        className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 overflow-x-auto"
      >
        {(['All', ...CODING_PLATFORMS] as const).map((plat) => {
          const active = platformFilter === plat;
          return (
            <button
              key={plat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPlatformFilter(plat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white dark:bg-[#121821] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {plat === 'All' ? 'All Platforms' : plat}
            </button>
          );
        })}
      </div>

      {/* Quantitative Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-200 dark:border-slate-800">
        <div>
          <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {totalCompletions.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Completions (12 mo)
          </p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {activeDays}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active coding days
          </p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold tabular-nums text-[#009942] dark:text-[#00EA64]">
            {currentStreak}d
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current streak
          </p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {longestStreak}d
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Longest streak
          </p>
        </div>
      </div>

      {/* GitHub-Style 53-Week Contribution Grid */}
      <div className="space-y-3">
        <div className="overflow-x-auto pb-2">
          <div className="inline-block min-w-max">
            {/* Month Labels Row */}
            <div className="flex items-center mb-1.5 pl-8">
              <div
                className="relative h-4"
                style={{ width: `${weeks.length * 15}px` }}
              >
                {monthLabels.map((m) => (
                  <span
                    key={`${m.label}-${m.weekIdx}`}
                    className="absolute top-0 text-[11px] font-mono text-slate-500 dark:text-slate-400"
                    style={{ left: `${m.weekIdx * 15}px` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Weekday Axis + Grid Columns */}
            <div className="flex items-start gap-2">
              <div className="grid grid-rows-7 gap-[3px] text-[10px] font-mono text-slate-400 dark:text-slate-500 pr-1 select-none w-6">
                <span className="h-3 leading-3" aria-hidden="true" />
                <span className="h-3 leading-3">Mon</span>
                <span className="h-3 leading-3" aria-hidden="true" />
                <span className="h-3 leading-3">Wed</span>
                <span className="h-3 leading-3" aria-hidden="true" />
                <span className="h-3 leading-3">Fri</span>
                <span className="h-3 leading-3" aria-hidden="true" />
              </div>

              <div className="flex gap-[3px]" role="grid" aria-label="365-day coding contribution grid">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-rows-7 gap-[3px]" role="row">
                    {week.map((cell) => {
                      if (!cell.inRange) {
                        return (
                          <div
                            key={cell.date}
                            className="w-3 h-3 rounded-[2px] opacity-0 pointer-events-none"
                            aria-hidden="true"
                          />
                        );
                      }
                      const isSelected = selectedDate === cell.date;
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          onClick={() => setSelectedDate(cell.date)}
                          onMouseEnter={() =>
                            setHoveredCell({ date: cell.date, count: cell.count })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          onFocus={() =>
                            setHoveredCell({ date: cell.date, count: cell.count })
                          }
                          onBlur={() => setHoveredCell(null)}
                          title={`${formatReadableDate(cell.date)}: ${cell.count} completion${cell.count === 1 ? '' : 's'}`}
                          aria-label={`${formatReadableDate(cell.date)}: ${cell.count} completion${cell.count === 1 ? '' : 's'}`}
                          aria-pressed={isSelected}
                          className={`w-3 h-3 rounded-[2px] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00EA64] ${getIntensityClass(
                            cell.count
                          )} ${isSelected ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : 'hover:scale-110'}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Legend & Live Hover Readout */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-mono tabular-nums">
            {hoveredCell
              ? `${formatReadableDate(hoveredCell.date)} · ${hoveredCell.count} completion${hoveredCell.count === 1 ? '' : 's'}`
              : `Selected: ${formatReadableDate(selectedDate)} · ${selectedDayTotal} completion${selectedDayTotal === 1 ? '' : 's'}`}
          </p>

          <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
            <span>Less</span>
            <span className={`w-3 h-3 rounded-[2px] inline-block ${getIntensityClass(0)}`} />
            <span className={`w-3 h-3 rounded-[2px] inline-block ${getIntensityClass(1)}`} />
            <span className={`w-3 h-3 rounded-[2px] inline-block ${getIntensityClass(3)}`} />
            <span className={`w-3 h-3 rounded-[2px] inline-block ${getIntensityClass(6)}`} />
            <span className={`w-3 h-3 rounded-[2px] inline-block ${getIntensityClass(9)}`} />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Selected Day Log & Recent Activity */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        {selectedDayEntries.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                Activity on {formatReadableDate(selectedDate)} ({selectedDayTotal} total)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormDate(selectedDate);
                  setShowLogForm(true);
                }}
                className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
              >
                + Add for this day
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]">
              {selectedDayEntries.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {item.platform} · {item.count} completion{item.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  {item.source === 'logged' && (
                    <button
                      type="button"
                      onClick={() => onDeleteActivity(item.id)}
                      aria-label={`Delete activity ${item.title}`}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : unifiedEntries.length === 0 ? (
          <div className="p-5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-[#0B0F14] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                No coding completions logged yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log daily HackerRank, LeetCode, GitHub, or CodeChef completions—or mark modules
                complete on the Learning Roadmap—to fill your contribution grid.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogForm(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Log First Completion
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No activity logged on {formatReadableDate(selectedDate)}. Showing latest completions:
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormDate(selectedDate);
                  setShowLogForm(true);
                }}
                className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap shrink-0"
              >
                + Log for {selectedDate}
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]">
              {recentEntries.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {item.platform} · {item.date} · {item.count} completion
                      {item.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  {item.source === 'logged' && (
                    <button
                      type="button"
                      onClick={() => onDeleteActivity(item.id)}
                      aria-label={`Delete activity ${item.title}`}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
