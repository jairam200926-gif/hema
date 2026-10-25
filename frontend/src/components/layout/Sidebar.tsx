import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldAlert,
  KeyRound,
  FileCheck2,
  Users,
  ScrollText,
  Bell,
  Settings,
  BookOpen,
  PlusCircle,
  Cpu,
  Layers,
  Flame,
} from 'lucide-react';

interface SidebarProps {
  unreadNotifsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ unreadNotifsCount = 0 }) => {
  const navItems = [
    { label: 'Security Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Backup Registry', path: '/backups', icon: KeyRound },
    { label: 'New Backup Ceremony', path: '/backups/new', icon: PlusCircle, highlight: true },
    { label: 'Custodian Shares', path: '/shares', icon: Layers },
    { label: 'Threshold Recovery', path: '/recovery', icon: FileCheck2 },
    { label: 'Disaster Simulator', path: '/simulator', icon: Flame, badge: 'Resilience' },
    { label: 'Security Test Center', path: '/security-tests', icon: ShieldAlert, badge: 'Real Attacks' },
    { label: 'Audit Trail', path: '/audit', icon: ScrollText },
    { label: 'Custodians', path: '/custodians', icon: Users },
    { label: 'Notifications', path: '/notifications', icon: Bell, count: unreadNotifsCount },
    { label: 'System Settings', path: '/settings', icon: Settings },
    { label: 'About', path: '/about', icon: BookOpen },
  ];

  return (
    <aside className="w-64 bg-[#080E0B] border-r border-vault-800/80 min-h-[calc(100vh-57px)] flex flex-col justify-between p-3 shrink-0 select-none">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
          Core Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold shadow-sm'
                    : item.highlight
                    ? 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-600/30'
                    : 'text-slate-400 hover:bg-vault-850 hover:text-slate-200 border border-transparent'
                }`
              }
            >
              <div className="flex items-center space-x-2.5">
                <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
              {item.count !== undefined && item.count > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                  {item.count}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Threshold Scheme Visual Widget in Sidebar */}
      <div className="mt-6 p-3 rounded-lg bg-vault-950 border border-vault-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-mono font-medium flex items-center space-x-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Cryptographic Scheme</span>
          </span>
          <span className="text-emerald-400 font-mono text-[10px] font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-700/40">GF(2⁸) Shamir</span>
        </div>
        <div className="w-full bg-vault-900 h-1.5 rounded-full overflow-hidden flex border border-vault-800">
          <div className="bg-blue-500 h-full w-[60%]"></div>
          <div className="bg-vault-800 h-full w-[40%]"></div>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          Lagrange threshold: <span className="text-slate-200 font-semibold font-mono">k</span> shares required of <span className="text-slate-200 font-semibold font-mono">n</span> distributed custodians.
        </p>
      </div>
    </aside>
  );
};
