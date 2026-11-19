import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ROLE_META } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';

interface DeniedLocationState {
  from?: string;
  reason?: string;
  requiredRoleLabel?: string;
}

export const AccessDeniedPage: React.FC = () => {
  const { currentRole } = useApp();
  const location = useLocation();
  const state = (location.state as DeniedLocationState | null) ?? {};

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
      </div>
    </div>
  );
};
