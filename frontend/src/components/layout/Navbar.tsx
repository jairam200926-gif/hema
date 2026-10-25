import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Bell, Terminal, LogOut, UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavbarProps {
  unreadNotifsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ unreadNotifsCount = 0 }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B1310]/90 backdrop-blur-md border-b border-vault-800 px-4 lg:px-6 py-2.5 flex items-center justify-between text-slate-100">
      {/* Brand Logo & Name */}
      <div className="flex items-center space-x-3">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-glow-sm group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-100 tracking-tight font-sans">VaultGuard</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                v1.0.0
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Right Controls: Notifications, Role, User */}
      <div className="flex items-center space-x-3">
        {/* Quick Test Center Link */}
        <Link
          to="/security-tests"
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-vault-900 hover:bg-vault-800 text-xs font-mono text-slate-200 border border-vault-700 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span>Security Tests</span>
        </Link>

        {/* Notifications Icon */}
        <Link
          to="/notifications"
          className="relative p-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-300 transition-colors border border-vault-700/60"
          title="Security Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
          )}
        </Link>

        {/* Auth Controls */}
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-vault-900 hover:bg-red-950/60 text-xs font-mono text-red-400 hover:text-red-300 border border-vault-700 hover:border-red-800/80 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        ) : (
          <Link
            to="/login"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-mono text-white transition-colors"
          >
            Login
          </Link>
        )}

        {/* Current Operator Profile */}
        {isAuthenticated && user && (
          <div className="flex items-center space-x-2.5 pl-2 border-l border-vault-800">
            <div className="w-8 h-8 rounded-full bg-blue-950/80 flex items-center justify-center text-blue-400 border border-blue-700/50">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-semibold text-slate-200 font-mono text-[11px]">{user.username}</p>
              <p className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                <span className="text-emerald-400">●</span>
                <span>{user.role}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
