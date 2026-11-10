import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  Terminal as TerminalIcon,
  User,
  LogOut,
  ChevronDown,
  Briefcase,
  Layers,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTerminal } from '../../contexts/TerminalContext';
import api from '../../lib/api';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { agentStatus, isDrawerOpen, toggleDrawer } = useTerminal();
  const navigate = useNavigate();
  const location = useLocation();

  const [jobsCount, setJobsCount] = useState<number | null>(null);
  const [appsCount, setAppsCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    try {
      const [jobsRes, appsRes] = await Promise.allSettled([
        api.get('/jobs'),
        api.get('/applications'),
      ]);

      if (jobsRes.status === 'fulfilled' && Array.isArray(jobsRes.value.data)) {
        setJobsCount(jobsRes.value.data.length);
      }
      if (appsRes.status === 'fulfilled' && Array.isArray(appsRes.value.data)) {
        setAppsCount(appsRes.value.data.length);
      }
    } catch {
      /* ignore counts fetch error */
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, location.pathname]);

  // Listen to custom count update events
  useEffect(() => {
    const handleUpdate = () => fetchCounts();
    window.addEventListener('jb_refresh_counts', handleUpdate);
    return () => window.removeEventListener('jb_refresh_counts', handleUpdate);
  }, [fetchCounts]);

  // Close dropdown menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const formatName = (str?: string) => {
    if (!str) return 'Candidate';
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* ── Left: Logo & Wordmark ── */}
        <div className="flex items-center gap-3">
          <Link to="/jobs" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-900/30 group-hover:scale-105 transition-transform">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">JobScout</span>
          </Link>
        </div>

        {/* ── Center: Two Main Navigation Tabs (Jobs & Applications) ── */}
        <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <NavLink
            to="/jobs"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
              }`
            }
          >
            <Briefcase size={14} className="shrink-0" />
            <span>Jobs</span>
            {jobsCount !== null && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300">
                {jobsCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/applications"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
              }`
            }
          >
            <Layers size={14} className="shrink-0" />
            <span>Applications</span>
            {appsCount !== null && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300">
                {appsCount}
              </span>
            )}
          </NavLink>
        </nav>

        {/* ── Right: Agent Status Chip & User Menu ── */}
        <div className="flex items-center gap-3">
          {/* Agent Status Chip (Opens collapsible drawer) */}
          <button
            type="button"
            onClick={toggleDrawer}
            title="Click to view agent activity log"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
              isDrawerOpen
                ? 'bg-zinc-800 border-zinc-600 text-white shadow-sm'
                : agentStatus !== 'idle'
                ? 'bg-blue-950/50 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-900/30'
                : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {agentStatus !== 'idle' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  agentStatus !== 'idle' ? 'bg-blue-400' : 'bg-emerald-500'
                }`}
              />
            </span>
            <span className="capitalize font-mono text-[11px]">
              {agentStatus === 'idle' ? 'Idle' : agentStatus}
            </span>
            <TerminalIcon size={12} className="text-zinc-500" />
          </button>

          {/* User Avatar Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 rounded-xl hover:bg-zinc-900/80 transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-zinc-700">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <ChevronDown
                size={14}
                className={`text-zinc-500 transition-transform duration-200 ${
                  menuOpen ? 'rotate-180 text-zinc-300' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2.5 border-b border-zinc-800/80 mb-1">
                  <p className="font-semibold text-white truncate">{formatName(user?.name)}</p>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">{user?.email}</p>
                </div>

                <div className="space-y-0.5">
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition"
                  >
                    <User size={14} className="text-zinc-400" />
                    <span>Profile Details</span>
                  </Link>

                  <Link
                    to="/onboarding"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition"
                  >
                    <FileText size={14} className="text-zinc-400" />
                    <span>Upload New Resume</span>
                  </Link>
                </div>

                <div className="border-t border-zinc-800/80 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition cursor-pointer text-left"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
