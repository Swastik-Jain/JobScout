import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCircle, Rocket, LogOut, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/dashboard/profile', label: 'Profile & Resume', icon: UserCircle },
    { to: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
    { to: '/dashboard/applications', label: 'Mission Control', icon: Rocket },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950/90 backdrop-blur-md h-full flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-900/40">
            <Zap size={16} className="text-white" />
          </div>
          <h1 className="text-base font-bold text-white tracking-tight">
            JobAgent
          </h1>
          <span className="text-[10px] text-zinc-600 font-mono ml-auto">v2.0</span>
        </div>
      </div>

      {/* User identity */}
      {user && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3 px-3 py-3 bg-zinc-900/60 rounded-xl border border-zinc-800/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600/70 to-purple-600/70 flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-zinc-700/50">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user.name}</p>
              <p className="text-zinc-500 text-xs truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1.5 mt-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-3 mb-3">Navigation</p>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/dashboard'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm',
                isActive
                  ? 'bg-blue-600/15 text-white border border-blue-700/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
              )
            }
          >
            {({ isActive }) => (
              <>
                <link.icon size={18} className={isActive ? 'text-blue-400' : 'text-zinc-500'} />
                <span className="font-medium">{link.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800/50 space-y-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/10 rounded-xl text-sm transition-colors border border-transparent hover:border-red-900/20"
        >
          <LogOut size={16} />
          <span className="font-medium">Sign Out</span>
        </button>
        <div className="text-xs text-zinc-600 flex items-center justify-center gap-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>All systems operational</span>
        </div>
      </div>
    </div>
  );
};
