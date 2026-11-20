import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Code2 } from 'lucide-react';
import { LearningResource } from '../config/rbacAndData';

interface DsaProgressBarProps {
  resources: LearningResource[];
  completedResourceIds: string[];
  onToggleCompleted?: (resourceId: string) => void;
}

/**
 * Progress bar visualizing the signed-in member's completion across
 * DSA (Data Structures & Algorithms) roadmap modules.
 */
export const DsaProgressBar: React.FC<DsaProgressBarProps> = ({
  resources,
  completedResourceIds,
  onToggleCompleted,
}) => {
  const dsaModules = resources.filter((r) => r.track === 'DSA');
  const completedCount = dsaModules.filter((r) =>
    completedResourceIds.includes(r.id)
  ).length;
  const totalCount = dsaModules.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section
      aria-labelledby="dsa-progress-heading"
      className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64] flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>DSA Roadmap Progress</span>
          </p>
          <h2
            id="dsa-progress-heading"
            className="font-mono text-lg font-bold text-slate-900 dark:text-white"
          >
            Data Structures &amp; Algorithms Mastery
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
            {completedCount} / {totalCount} modules ({percentage}%)
          </p>
          <Link
            to="/resources"
            className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline whitespace-nowrap"
          >
            Open Roadmap →
          </Link>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-1.5">
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="DSA roadmap module completion"
          className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-[#00EA64] transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>
            {totalCount === 0
              ? 'No DSA roadmap modules published yet.'
              : completedCount === totalCount
                ? 'All DSA modules completed!'
                : `${totalCount - completedCount} DSA module${totalCount - completedCount === 1 ? '' : 's'} remaining`}
          </span>
          <span className="tabular-nums">{percentage}%</span>
        </div>
      </div>

      {dsaModules.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {dsaModules.map((mod) => {
            const done = completedResourceIds.includes(mod.id);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onToggleCompleted?.(mod.id)}
                disabled={!onToggleCompleted}
                title={done ? `Mark "${mod.title}" incomplete` : `Mark "${mod.title}" completed`}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center gap-1.5 border transition-colors ${
                  done
                    ? 'border-[#00EA64]/50 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64]'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] text-slate-600 dark:text-slate-300 hover:border-[#00EA64]/50'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate max-w-[220px]">{mod.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
