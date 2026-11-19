import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ROLE_META, UserRole } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

interface DeniedLocationState {
  from?: string;
  reason?: string;
  requiredRoleLabel?: string;
}

export const AccessDeniedPage: React.FC = () => {
  const { currentRole, switchDemoRole } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as DeniedLocationState | null) ?? {};

  const handlePreviewRole = (role: UserRole) => {
    switchDemoRole(role);
    navigate(state.from || '/');
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-20">
      <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-6">
        <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold text-red-500">403 · Access Denied</p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Permission Required
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {state.reason ||
              'You do not have sufficient privileges to view the requested workspace.'}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1.5 text-slate-600 dark:text-slate-300">
          {state.from && <p>Requested Route: {state.from}</p>}
          <p>Current Role: {ROLE_META[currentRole].label}</p>
          {state.requiredRoleLabel && <p>Required Access: {state.requiredRoleLabel}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
          >
            Sign In with Authorized Account
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            Back to Home
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <p className="font-mono text-xs text-slate-500">Or switch demo role to inspect this route:</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePreviewRole('lead')}
              className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-300 dark:border-slate-700 hover:border-[#00EA64]"
            >
              Preview as Campus Lead
            </button>
            <button
              type="button"
              onClick={() => handlePreviewRole('crew')}
              className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-300 dark:border-slate-700 hover:border-[#00EA64]"
            >
              Preview as Campus Crew
            </button>
            <button
              type="button"
              onClick={() => handlePreviewRole('member')}
              className="px-3 py-1.5 rounded-md text-xs font-mono border border-slate-300 dark:border-slate-700 hover:border-[#00EA64]"
            >
              Preview as Student Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
