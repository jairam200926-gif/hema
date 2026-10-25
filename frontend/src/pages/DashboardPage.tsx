import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Layers,
  HeartPulse,
  Users,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  PlusCircle,
  FileCheck2,
  Terminal,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { apiGet } from '../api/client';

export const DashboardPage: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [custodians, setCustodians] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [fleetResilience, setFleetResilience] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bkRes, shRes, custRes, attRes, evtRes, fleetRes] = await Promise.allSettled([
        apiGet<any[]>('/backups'),
        apiGet<any[]>('/shares'),
        apiGet<any[]>('/custodians'),
        apiGet<any[]>('/recovery/attempts'),
        apiGet<any[]>('/audit?limit=6'),
        apiGet<any>('/resilience/fleet'),
      ]);

      if (bkRes.status === 'fulfilled') setBackups(bkRes.value || []);
      if (shRes.status === 'fulfilled') setShares(shRes.value || []);
      if (custRes.status === 'fulfilled') setCustodians(custRes.value || []);
      if (attRes.status === 'fulfilled') setAttempts(attRes.value || []);
      if (evtRes.status === 'fulfilled') setRecentEvents(evtRes.value || []);
      if (fleetRes.status === 'fulfilled') setFleetResilience(fleetRes.value || null);

      if (bkRes.status === 'rejected' && shRes.status === 'rejected') {
        throw new Error('Unable to connect to VaultGuard API. Verify the backend daemon is running.');
      }
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to fetch telemetry data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalBackups = backups.length;
  const totalShares = shares.length;
  const healthyShares = shares.filter((s) => s.status === 'HEALTHY').length;
  const systemHealthPercentage = totalShares > 0 ? Math.round((healthyShares / totalShares) * 100) : 100;
  const activeCustodians = custodians.filter((c) => c.status === 'ACTIVE').length;
  const successfulRecoveries = attempts.filter((a) => a.result === 'SUCCESS').length;
  const totalAttempts = attempts.length;
  const alertCount = recentEvents.filter((e) => e.result === 'FAILURE' || e.result === 'WARNING').length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-vault-900 rounded-lg w-1/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-vault-900/60 rounded-xl border border-vault-800"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-vault-900/40 rounded-xl border border-vault-800"></div>
          <div className="h-72 bg-vault-900/40 rounded-xl border border-vault-800"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-red-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Backend Connection Error</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs inline-flex items-center space-x-2 transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <span>Security Operations Dashboard</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of cryptographic shares, custodians, and threshold recovery sessions.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadDashboardData}
            title="Refresh telemetry"
            className="p-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-400 hover:text-slate-200 border border-vault-700 text-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/backups/new"
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Backup</span>
          </Link>
          <Link
            to="/recovery"
            className="px-3.5 py-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-200 border border-vault-700 font-semibold text-xs flex items-center space-x-1.5 transition-all"
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span>Initiate Recovery</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {/* Total Backups */}
        <div className="glass-panel p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>BACKUPS</span>
            <KeyRound className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">{totalBackups}</div>
          <p className="text-[10px] text-slate-500">Configured vaults</p>
        </div>

        {/* Total Shares */}
        <div className="glass-panel p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>SHARES</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">{totalShares}</div>
          <p className="text-[10px] text-slate-500">{healthyShares} verified healthy</p>
        </div>

        {/* System Health */}
        <div className="glass-panel p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>HEALTH</span>
            <HeartPulse className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {systemHealthPercentage}%
          </div>
          <p className="text-[10px] text-emerald-500/80">Integrity ratio</p>
        </div>

        {/* Active Custodians */}
        <div className="glass-panel p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>CUSTODIANS</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">{activeCustodians}</div>
          <p className="text-[10px] text-slate-500">Active trustees</p>
        </div>

        {/* Recovery Success */}
        <div className="glass-panel p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>RECOVERIES</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            {successfulRecoveries}
            <span className="text-xs text-slate-400 font-semibold"> / {totalAttempts}</span>
          </div>
          <p className="text-[10px] text-emerald-500">Threshold verified</p>
        </div>

        {/* Security Alerts / Failures */}
        <div className="glass-panel p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ALERTS</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            {alertCount}
          </div>
          <p className="text-[10px] text-amber-500/80">Recent anomalies</p>
        </div>
      </div>

      {/* Fleet Resilience Banner if available */}
      {fleetResilience && fleetResilience.total_backups > 0 && (
        <div className="glass-panel p-4 rounded-xl border border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
              Automated Recovery Readiness Engine
            </span>
            <p className="text-xs text-slate-300">
              Fleet status: <span className="font-semibold text-emerald-400">{fleetResilience.recoverable_backups} of {fleetResilience.total_backups} vaults recoverable</span>. Optimal: {fleetResilience.optimal_backups}, Degraded: {fleetResilience.degraded_backups}, Unrecoverable: {fleetResilience.unrecoverable_backups}.
            </p>
          </div>
          <Link
            to="/simulator"
            className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-xs font-mono self-start md:self-auto transition-colors"
          >
            Launch Disaster Simulator →
          </Link>
        </div>
      )}

      {/* Second Row: Backups Overview & Recent Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backups Registry Summary (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Active Vault Backups
              </h2>
            </div>
            <Link
              to="/backups"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
            >
              <span>View All ({backups.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-vault-950/60 rounded-lg border border-vault-800">
              <KeyRound className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No backup vaults configured yet.</p>
              <Link
                to="/backups/new"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Perform First Backup Ceremony</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-vault-950 text-slate-400 font-mono border-b border-vault-800">
                  <tr>
                    <th className="py-2.5 px-3">Vault Name</th>
                    <th className="py-2.5 px-3">Scheme</th>
                    <th className="py-2.5 px-3">Algorithm</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vault-800 text-slate-300">
                  {backups.slice(0, 5).map((bk) => (
                    <tr key={bk.id} className="hover:bg-vault-850/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{bk.name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{bk.description || 'No description'}</div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          {bk.threshold}-of-{bk.total_shares}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {bk.algorithm || 'Shamir GF(2⁸)'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          bk.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${bk.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                          <span>{bk.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to="/recovery"
                          className="px-2.5 py-1 rounded bg-vault-800 hover:bg-vault-700 text-slate-200 border border-vault-700 text-[11px] font-mono transition-colors"
                        >
                          Recover
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Security Events Feed (1 Col) */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Recent Security Events
              </h2>
            </div>
            <Link
              to="/audit"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
            >
              <span>Audit Log</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No audit events recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-slate-200">{evt.event_type}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                        evt.result === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : evt.result === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {evt.result}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-tight">
                    {evt.metadata ? JSON.stringify(evt.metadata) : 'System event executed.'}
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {evt.created_at ? new Date(evt.created_at).toLocaleString() : 'Just now'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};