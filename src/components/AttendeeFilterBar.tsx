import React from 'react';
import { ArrowUpDown, Filter, RotateCcw, Search, X } from 'lucide-react';

export type AttendeeStatusFilter = 'all' | 'checked_in' | 'pending';
export type AttendeeSortOption = 'newest' | 'name_asc' | 'reg_asc' | 'status';

export interface FilterFacetOption {
  value: string;
  count: number;
}

export interface AttendeeFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: AttendeeStatusFilter;
  onStatusFilterChange: (value: AttendeeStatusFilter) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  yearFilter: string;
  onYearFilterChange: (value: string) => void;
  sortBy: AttendeeSortOption;
  onSortByChange: (value: AttendeeSortOption) => void;
  departments: FilterFacetOption[];
  years: FilterFacetOption[];
  totalCount: number;
  checkedInCount: number;
  pendingCount: number;
  filteredCount: number;
  onResetFilters: () => void;
}

export const AttendeeFilterBar: React.FC<AttendeeFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  yearFilter,
  onYearFilterChange,
  sortBy,
  onSortByChange,
  departments,
  years,
  totalCount,
  checkedInCount,
  pendingCount,
  filteredCount,
  onResetFilters,
}) => {
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'all' ||
    departmentFilter !== 'all' ||
    yearFilter !== 'all' ||
    sortBy !== 'newest';

  const statusTabs: Array<{ key: AttendeeStatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'checked_in', label: 'Checked In', count: checkedInCount },
    { key: 'pending', label: 'Pending', count: pendingCount },
  ];

  return (
    <div className="space-y-3">
      {/* Row 1: Real-Time Search Input + Segmented Status Filter */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, register no., email, department, or pass code..."
            aria-label="Search event registrants"
            className="w-full h-10 pl-9 pr-9 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#00EA64]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear attendee search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Segmented Attendance Status Filter */}
        <div
          role="group"
          aria-label="Filter attendees by check-in status"
          className="inline-flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] self-start md:self-auto shrink-0"
        >
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onStatusFilterChange(tab.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  isActive
                    ? 'bg-[#00EA64] text-[#0B0F14]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Faceted Department, Year & Sort Controls + Live Match Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 mr-0.5">
            <Filter className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Filter:</span>
          </div>

          <select
            aria-label="Filter registrants by department"
            value={departmentFilter}
            onChange={(e) => onDepartmentFilterChange(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00EA64]"
          >
            <option value="all">All Departments ({totalCount})</option>
            {departments.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.value} ({dept.count})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter registrants by academic year"
            value={yearFilter}
            onChange={(e) => onYearFilterChange(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00EA64]"
          >
            <option value="all">All Years</option>
            {years.map((yr) => (
              <option key={yr.value} value={yr.value}>
                {yr.value} ({yr.count})
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-1.5">
            <ArrowUpDown
              className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline"
              aria-hidden="true"
            />
            <select
              aria-label="Sort event registrants"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as AttendeeSortOption)}
              className="h-9 px-2.5 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00EA64]"
            >
              <option value="newest">Sort: Newest RSVP</option>
              <option value="name_asc">Sort: Name (A–Z)</option>
              <option value="reg_asc">Sort: Register No.</option>
              <option value="status">Sort: Checked In First</option>
            </select>
          </div>
        </div>

        {/* Live Result Summary & Reset */}
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums ml-auto">
          <span className="text-slate-500 dark:text-slate-400">
            Showing{' '}
            <strong className="text-slate-900 dark:text-white">
              {filteredCount.toLocaleString()}
            </strong>{' '}
            of {totalCount.toLocaleString()}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] hover:text-[#009942] dark:hover:text-[#00EA64] inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendeeFilterBar;
