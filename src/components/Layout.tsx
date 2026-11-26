import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  LogOut,
  Menu,
  Moon,
  Sun,
  Terminal,
  User as UserIcon,
  X,
} from 'lucide-react';
import { ROLE_META, UserRole, getDashboardPath } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { Footer } from './Footer';
import { GlobalSearchBar } from './GlobalSearchBar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    theme,
    toggleTheme,
    currentUser,
    currentRole,
    needsEmailVerification,
    unverifiedEmail,
    can,
    siteSettings,
    logout,
    toasts,
    dismissToast,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const navLinks = [
    { to: '/events', label: 'Events' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/resources', label: 'Resources' },
    { to: '/team', label: 'Team' },
    { to: '/gallery', label: 'Gallery' },
    ...(can('canSubmitJoinRequest') && siteSettings.applicationsOpen
      ? [{ to: '/join', label: 'Join Us' }]
      : []),
    ...(currentUser && currentRole !== 'outsider'
      ? [{ to: getDashboardPath(currentRole), label: 'Dashboard' }]
      : []),
  ];

  const roleBadgeClass: Record<UserRole, string> = {
    lead: 'text-[#009942] dark:text-[#00EA64] border-[#00EA64]/40 bg-[#00EA64]/10',
    crew: 'text-sky-700 dark:text-sky-300 border-sky-500/30 bg-sky-500/10',
    member:
      'text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80',
    outsider: 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0B0F14] dark:text-slate-100 transition-colors duration-200">
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#0B0F14]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark (Single Line) */}
          <Link
            to="/"
            className="flex items-center gap-2.5 font-mono text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-md bg-[#00EA64] text-[#0B0F14] flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            </span>
            <span>HRCC Paavai</span>
          </Link>

          {/* Zone 2: Primary Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden xl:flex items-center gap-6"
          >
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#00EA64] text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: Global Search, Theme Toggle & Auth Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <GlobalSearchBar onNavigate={() => setMobileMenuOpen(false)} />

            {/* Dark / Light Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="w-9 h-9 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {/* Auth Controls (Desktop) */}
            {currentUser ? (
              <div className="hidden sm:flex items-center gap-2.5 pl-1 border-l border-slate-200 dark:border-slate-800">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-[#121821] transition-colors whitespace-nowrap shrink-0"
                >
                  <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 max-w-[120px] truncate">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${roleBadgeClass[currentRole]}`}
                  >
                    {ROLE_META[currentRole].shortLabel}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Logout"
                  className="h-9 px-3 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-900/60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            ) : needsEmailVerification && unverifiedEmail ? (
              <div className="hidden sm:flex items-center gap-2.5 pl-1 border-l border-slate-200 dark:border-slate-800">
                <Link
                  to="/profile"
                  className="h-9 px-3 rounded-md text-xs font-mono font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>Verify Email</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Logout"
                  className="h-9 px-3 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/login"
                  className="h-9 px-3.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#121821] flex items-center transition-colors whitespace-nowrap shrink-0"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="h-9 px-4 rounded-md text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] flex items-center transition-colors whitespace-nowrap shrink-0"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="xl:hidden w-9 h-9 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F14] px-4 py-4 space-y-4 shadow-lg">
            <nav aria-label="Mobile Navigation" className="grid grid-cols-2 gap-1.5">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#121821]"
              >
                Home
              </Link>
              {navLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#121821]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#121821]"
              >
                FAQ & Contact
              </Link>
            </nav>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              {currentUser ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white"
                  >
                    <span>{currentUser.name}</span>
                    <span
                      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${roleBadgeClass[currentRole]}`}
                    >
                      {ROLE_META[currentRole].shortLabel}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400"
                  >
                    Logout
                  </button>
                </>
              ) : needsEmailVerification && unverifiedEmail ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-md text-xs font-mono font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  >
                    Verify Email
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-md text-sm font-medium border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-md text-sm font-semibold bg-[#00EA64] text-[#0B0F14]"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      <Footer />

      {/* Accessible Toast Notification Stack */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#121821] shadow-xl text-slate-900 dark:text-slate-100"
          >
            {toast.variant === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0 mt-0.5" />
            )}
            {toast.variant === 'error' && (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            )}
            {toast.variant === 'info' && (
              <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
