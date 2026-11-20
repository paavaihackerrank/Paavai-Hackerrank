import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Filter,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ACADEMIC_YEARS,
  DEPARTMENTS,
  ROLE_META,
  UserRole,
} from '../config/rbacAndData';
import { isValidOptionalImageUrl, useApp } from '../context/AppContext';
import { MemberAvatar } from '../components/MemberAvatar';

export const MemberDirectoryPanel: React.FC = () => {
  const {
    currentUser,
    users,
    can,
    addToast,
    updateUserRole,
    updateMemberPhotoUrl,
    deleteUser,
  } = useApp();
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | Exclude<UserRole, 'outsider'>>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingPhotoUserId, setEditingPhotoUserId] = useState<string | null>(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);

  const departmentOptions = useMemo(() => {
    const seen = new Set(DEPARTMENTS.map((d) => d.toLowerCase()));
    const extra: string[] = [];
    for (const u of users) {
      const dept = (u.department || '').trim();
      if (dept && !seen.has(dept.toLowerCase())) {
        seen.add(dept.toLowerCase());
        extra.push(dept);
      }
    }
    return [...DEPARTMENTS, ...extra];
  }, [users]);

  const yearOptions = useMemo(() => {
    const seen = new Set(ACADEMIC_YEARS.map((y) => y.toLowerCase()));
    const extra: string[] = [];
    for (const u of users) {
      const yr = (u.year || '').trim();
      if (yr && !seen.has(yr.toLowerCase())) {
        seen.add(yr.toLowerCase());
        extra.push(yr);
      }
    }
    return [...ACADEMIC_YEARS, ...extra];
  }, [users]);

  const roleCounts = useMemo(
    () => ({
      lead: users.filter((u) => u.role === 'lead').length,
      crew: users.filter((u) => u.role === 'crew').length,
      member: users.filter((u) => u.role === 'member').length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (
        departmentFilter !== 'all' &&
        (u.department || '').trim().toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        yearFilter !== 'all' &&
        (u.year || '').trim().toLowerCase() !== yearFilter.toLowerCase()
      ) {
        return false;
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.regNo || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.collegeEmail || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, departmentFilter, yearFilter, roleFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    departmentFilter !== 'all' ||
    yearFilter !== 'all' ||
    roleFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setDepartmentFilter('all');
    setYearFilter('all');
    setRoleFilter('all');
  };

  const handleExportMembersCSV = () => {
    if (!can('canManageUsers')) {
      addToast('Export restricted', 'Only the Campus Lead can export member data.', 'error');
      return;
    }
    if (filteredUsers.length === 0) {
      addToast('Nothing to export', 'No members match the current search or filters.', 'info');
      return;
    }
    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Name',
      'Personal Email',
      'College Email ID',
      'Register Number',
      'Department',
      'Year',
      'Role',
      'HackerRank Handle',
      'Phone',
      'Joined At',
    ];
    const rows = filteredUsers.map((u) =>
      [
        escapeCsv(u.name),
        escapeCsv(u.email),
        escapeCsv(u.collegeEmail || ''),
        escapeCsv(u.regNo),
        escapeCsv(u.department),
        escapeCsv(u.year),
        escapeCsv(ROLE_META[u.role].label),
        escapeCsv(u.hackerRankHandle),
        escapeCsv(u.phone),
        escapeCsv(u.joinedAt),
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.download = hasActiveFilters
      ? `hrcc-paavai-members-filtered-${dateStamp}.csv`
      : `hrcc-paavai-members-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast(
      'Members CSV exported',
      `Downloaded ${filteredUsers.length} member record${filteredUsers.length === 1 ? '' : 's'}.`,
      'success'
    );
  };

  const handleRoleChange = async (
    userId: string,
    nextRole: Exclude<UserRole, 'outsider'>
  ) => {
    setUpdatingUserId(userId);
    try {
      await updateUserRole(userId, nextRole);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const roleSelectStyle = (role: Exclude<UserRole, 'outsider'>) => {
    if (role === 'lead') {
      return 'border-[#00EA64]/60 text-[#009942] dark:text-[#00EA64] bg-[#00EA64]/5';
    }
    if (role === 'crew') {
      return 'border-sky-500/50 text-sky-700 dark:text-sky-300 bg-sky-500/5';
    }
    return 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#0B0F14]';
  };

  return (
    <div className="space-y-4">
      {/* Title, Role Totals & CSV Export */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
            Member Management & Role Assignment ({users.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            New verified student sign-ups join as Student Community Members by default. Promote
            members to Campus Crew or demote back anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span>
              Lead:{' '}
              <strong className="text-[#009942] dark:text-[#00EA64] tabular-nums">
                {roleCounts.lead}
              </strong>
            </span>
            <span>
              Crew:{' '}
              <strong className="text-sky-600 dark:text-sky-400 tabular-nums">
                {roleCounts.crew}
              </strong>
            </span>
            <span>
              Members:{' '}
              <strong className="text-slate-900 dark:text-white tabular-nums">
                {roleCounts.member}
              </strong>
            </span>
          </div>

          {can('canManageUsers') && (
            <button
              id="export-members-csv-btn"
              type="button"
              onClick={handleExportMembersCSV}
              disabled={filteredUsers.length === 0}
              aria-label={`Export ${filteredUsers.length} filtered members to CSV`}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export to CSV</span>
              <span className="font-mono text-[11px] opacity-80 tabular-nums">
                ({filteredUsers.length})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="lg:col-span-5">
            <label
              htmlFor="member-search-input"
              className="block font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Search by Name or Register No.
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="member-search-input"
                type="search"
                aria-label="Filter members by name or register number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or register number..."
                className="h-9 pl-9 pr-8 w-full rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Department Filter */}
          <div className="lg:col-span-2">
            <label
              htmlFor="member-dept-filter"
              className="block font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Department
            </label>
            <select
              id="member-dept-filter"
              aria-label="Filter by Department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 px-2.5 w-full rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
            >
              <option value="all">All Departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="lg:col-span-2">
            <label
              htmlFor="member-year-filter"
              className="block font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Year
            </label>
            <select
              id="member-year-filter"
              aria-label="Filter by Year"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="h-9 px-2.5 w-full rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
            >
              <option value="all">All Years</option>
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="lg:col-span-3">
            <label
              htmlFor="member-role-filter"
              className="block font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Role
            </label>
            <select
              id="member-role-filter"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as 'all' | Exclude<UserRole, 'outsider'>)
              }
              className="h-9 px-2.5 w-full rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#00EA64]"
            >
              <option value="all">All Roles</option>
              <option value="member">Student Community Member</option>
              <option value="crew">Campus Crew Member</option>
              <option value="lead">Campus Lead</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
            Showing <strong className="text-slate-900 dark:text-white">{filteredUsers.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{users.length}</strong> verified members
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[#009942] dark:text-[#00EA64] hover:underline"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Member Management Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] text-xs font-mono text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Dept, Year & Reg No.</th>
              <th className="py-3 px-4">Assign Role</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 px-4 text-center space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No verified members match your current search or filters.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isSelf = user.id === currentUser?.id;
                const isUpdating = updatingUserId === user.id;
                const isConfirmingDelete = confirmDeleteId === user.id;
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#0E141C]/60 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-3">
                        <MemberAvatar
                          name={user.name}
                          photoUrl={user.photoUrl}
                          variant={user.role}
                          sizeClass="w-10 h-10"
                          roundedClass="rounded-lg"
                          textClass="text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {user.name}{' '}
                            {isSelf && (
                              <span className="font-mono text-[11px] text-[#009942] dark:text-[#00EA64]">
                                (You)
                              </span>
                            )}
                            {user.emailVerified === false && (
                              <span className="ml-1.5 font-mono text-[11px] text-amber-600 dark:text-amber-400">
                                · Pending Verification
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                          {user.collegeEmail &&
                            user.collegeEmail.toLowerCase() !== user.email.toLowerCase() && (
                              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                ID: {user.collegeEmail}
                              </p>
                            )}
                          {user.hackerRankHandle && (
                            <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {user.hackerRankHandle}
                            </p>
                          )}
                          {editingPhotoUserId === user.id && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <input
                                type="url"
                                value={photoDraftUrl}
                                onChange={(e) => setPhotoDraftUrl(e.target.value)}
                                placeholder="https://example.com/photo.jpg"
                                aria-label={`Image URL for ${user.name}`}
                                className="h-8 px-2.5 rounded-md text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700 min-w-[210px] flex-1"
                              />
                              <button
                                type="button"
                                disabled={savingPhoto}
                                onClick={async () => {
                                  if (!isValidOptionalImageUrl(photoDraftUrl)) {
                                    addToast(
                                      'Invalid image URL',
                                      'Use a direct https:// or http:// image link.',
                                      'error'
                                    );
                                    return;
                                  }
                                  setSavingPhoto(true);
                                  const res = await updateMemberPhotoUrl(user.id, photoDraftUrl);
                                  setSavingPhoto(false);
                                  if (res.ok) {
                                    setEditingPhotoUserId(null);
                                    setPhotoDraftUrl('');
                                  }
                                }}
                                className="h-8 px-2.5 rounded-md text-[11px] font-mono font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60"
                              >
                                {savingPhoto ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPhotoUserId(null);
                                  setPhotoDraftUrl('');
                                }}
                                className="h-8 px-2 rounded-md text-[11px] font-mono border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {user.department} · {user.year}
                      </p>
                      <p className="font-mono text-xs text-slate-500">{user.regNo}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Assign role for ${user.name}`}
                          title={
                            isSelf
                              ? 'You cannot modify your own role'
                              : `Promote or demote ${user.name}`
                          }
                          value={user.role}
                          disabled={isSelf || isUpdating}
                          onChange={(e) =>
                            handleRoleChange(
                              user.id,
                              e.target.value as Exclude<UserRole, 'outsider'>
                            )
                          }
                          className={`h-8 px-2.5 rounded-md text-xs font-mono border transition-colors focus:outline-none focus:border-[#00EA64] disabled:opacity-60 ${roleSelectStyle(
                            user.role
                          )}`}
                        >
                          <option value="member">Student Community Member (member)</option>
                          <option value="crew">Campus Crew Member (crew)</option>
                          <option value="lead">Campus Lead (lead)</option>
                        </select>
                        {isUpdating && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#009942] dark:text-[#00EA64]">
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                            <span>Saving...</span>
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[11px] font-mono text-slate-400">
                            Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (editingPhotoUserId === user.id) {
                              setEditingPhotoUserId(null);
                              setPhotoDraftUrl('');
                            } else {
                              setEditingPhotoUserId(user.id);
                              setPhotoDraftUrl(user.photoUrl || '');
                            }
                          }}
                          title="Set or update profile image URL"
                          aria-label={`Set image URL for ${user.name}`}
                          className={`p-1.5 rounded border text-slate-500 hover:text-[#009942] dark:hover:text-[#00EA64] hover:border-[#00EA64]/50 ${
                            editingPhotoUserId === user.id
                              ? 'border-[#00EA64] text-[#009942] dark:text-[#00EA64]'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf &&
                          (isConfirmingDelete ? (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  setConfirmDeleteId(null);
                                  await deleteUser(user.id);
                                }}
                                className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-red-600 text-white hover:bg-red-500"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded text-[11px] font-mono border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(user.id)}
                              aria-label={`Delete user ${user.name}`}
                              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-500/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const JoinRequestsPanel: React.FC = () => {
  const { joinRequests, reviewJoinRequest } = useApp();

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
        &ldquo;Join Us&rdquo; Form Applications ({joinRequests.length})
      </h2>
      {joinRequests.length === 0 ? (
        <p className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500">
          No Join Us inquiries submitted yet.
        </p>
      ) : (
        <div className="space-y-3">
          {joinRequests.map((req) => (
            <div
              key={req.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {req.name} · {req.registerNumber}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {req.department} ({req.year}) · {req.email} · {req.phone}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Skills: <span className="font-mono">{req.skills}</span>
                </p>
                <p className="text-xs font-mono text-slate-500">
                  Submitted {req.submittedAt} · Status:{' '}
                  <span
                    className={
                      req.status === 'approved'
                        ? 'text-[#009942] dark:text-[#00EA64] font-semibold'
                        : req.status === 'pending'
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-red-500 font-semibold'
                    }
                  >
                    {req.status}
                  </span>
                </p>
              </div>
              {req.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => reviewJoinRequest(req.id, 'approved')}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Reviewed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewJoinRequest(req.id, 'rejected')}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-400/50 text-red-600 dark:text-red-400 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const SiteSettingsPanel: React.FC = () => {
  const { siteSettings, updateSiteSettings } = useApp();
  const [settingsForm, setSettingsForm] = useState(siteSettings);

  useEffect(() => {
    setSettingsForm(siteSettings);
  }, [siteSettings]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(settingsForm);
  };

  return (
    <form
      onSubmit={handleSaveSettings}
      className="max-w-2xl p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5"
    >
      <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
        Chapter Site Settings
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
            Chapter Name
          </label>
          <input
            type="text"
            value={settingsForm.chapterName}
            onChange={(e) => setSettingsForm({ ...settingsForm, chapterName: e.target.value })}
            className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
            College Name
          </label>
          <input
            type="text"
            value={settingsForm.collegeName}
            onChange={(e) => setSettingsForm({ ...settingsForm, collegeName: e.target.value })}
            className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
          Hero Tagline
        </label>
        <input
          type="text"
          value={settingsForm.tagline}
          onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
          className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
            Contact Email
          </label>
          <input
            type="email"
            value={settingsForm.contactEmail}
            onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
            className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
            Guest Leaderboard Preview Limit
          </label>
          <input
            type="number"
            min={3}
            max={25}
            value={settingsForm.publicLeaderboardLimit}
            onChange={(e) =>
              setSettingsForm({
                ...settingsForm,
                publicLeaderboardLimit: Number(e.target.value) || 10,
              })
            }
            className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
          Campus Location
        </label>
        <input
          type="text"
          value={settingsForm.campusLocation}
          onChange={(e) => setSettingsForm({ ...settingsForm, campusLocation: e.target.value })}
          className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
        />
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={settingsForm.applicationsOpen}
          onChange={(e) => setSettingsForm({ ...settingsForm, applicationsOpen: e.target.checked })}
          className="rounded accent-[#00EA64]"
        />
        <span>Accept new &ldquo;Request to Join&rdquo; applications</span>
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
        >
          Save Site Settings
        </button>
      </div>
    </form>
  );
};

export const AdminPanelPage: React.FC = () => {
  const { users, joinRequests } = useApp();
  const [tab, setTab] = useState<'members' | 'requests' | 'settings'>('members');
  const pendingJoinReqs = joinRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Campus Lead Administration · Full Control
          </p>
          <h1 className="font-mono text-3xl font-bold text-slate-900 dark:text-white">
            Member Directory & Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Search verified Paavai chapter members, promote or demote Campus Crew roles, review Join
            Us inquiries, and configure chapter-wide settings.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              ['members', `Members (${users.length})`],
              ['requests', `Join Inquiries (${pendingJoinReqs})`],
              ['settings', 'Site Settings'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'bg-[#00EA64] text-[#0B0F14] font-semibold'
                  : 'bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#00EA64]/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'members' && <MemberDirectoryPanel />}
      {tab === 'requests' && <JoinRequestsPanel />}
      {tab === 'settings' && <SiteSettingsPanel />}
    </div>
  );
};
