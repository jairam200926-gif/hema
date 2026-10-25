import React, { useState, useEffect } from 'react';
import { Settings, Shield, Mail, Save, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { apiGet, apiPut } from '../api/client';

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({
    security_alerts: true,
    recovery_alerts: true,
    backup_notifications: true,
    integrity_alerts: true,
  });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local UI preferences (stored in localStorage)
  const [themeMode, setThemeMode] = useState<'midnight' | 'graphite'>(
    (localStorage.getItem('vg_theme') as any) || 'midnight'
  );
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(
    parseInt(localStorage.getItem('vg_refresh_interval') || '30', 10)
  );

  useEffect(() => {
    setLoading(true);
    apiGet<any>('/notifications/preferences')
      .then((data) => {
        if (data) {
          setPrefs({
            security_alerts: data.security_alerts ?? true,
            recovery_alerts: data.recovery_alerts ?? true,
            backup_notifications: data.backup_notifications ?? true,
            integrity_alerts: data.integrity_alerts ?? true,
          });
        }
      })
      .catch((err) => {
        setError(err?.detail || err?.message || 'Failed to fetch preferences');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(null);
    setError(null);
    try {
      // 1. Save persistent user notification preferences to backend
      await apiPut('/notifications/preferences', prefs);

      // 2. Save local UI preferences to localStorage
      localStorage.setItem('vg_theme', themeMode);
      localStorage.setItem('vg_refresh_interval', autoRefreshInterval.toString());

      setSavedSuccess('Settings and notification policies saved successfully.');
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to save settings to server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
          <Settings className="w-6 h-6 text-slate-400" />
          <span>System Settings & Operational Parameters</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographic policy configuration, telemetry refresh intervals, and deployment parameters.
        </p>
        {loading && (
          <p className="text-xs text-blue-400 font-mono mt-2 animate-pulse">
            Loading current parameters from server...
          </p>
        )}
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* User Notification Policies (Persisted to Server) */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-blue-400 flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>User Notification Policies (Database Persisted)</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Per-Tenant Storage
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-vault-950 border border-vault-800 text-xs">
              <div>
                <span className="font-semibold text-slate-200">Security Incident Alerts</span>
                <p className="text-[11px] text-slate-400">Trigger notifications on failed logins and unauthorized recovery attempts</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.security_alerts}
                onChange={(e) => setPrefs({ ...prefs, security_alerts: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-vault-950 border border-vault-800 text-xs">
              <div>
                <span className="font-semibold text-slate-200">Share Integrity Mismatch Alerts</span>
                <p className="text-[11px] text-slate-400">Dispatch alert when AEAD tag or SHA-256 fingerprint fails verification</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.integrity_alerts}
                onChange={(e) => setPrefs({ ...prefs, integrity_alerts: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-vault-950 border border-vault-800 text-xs">
              <div>
                <span className="font-semibold text-slate-200">Threshold Recovery Ceremonies</span>
                <p className="text-[11px] text-slate-400">Alert on session initialization, successful reconstruction, and TTL expiry</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.recovery_alerts}
                onChange={(e) => setPrefs({ ...prefs, recovery_alerts: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>
          </div>
        </div>

        {/* Local Console Preferences */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-purple-400 flex items-center space-x-2">
              <Cpu className="w-4 h-4" />
              <span>Local Operator Console Preferences</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Local Browser State
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 mb-1">Color Palette</label>
              <select
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none"
              >
                <option value="midnight">Midnight Command Center (Default)</option>
                <option value="graphite">Deep Graphite Minimal</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Telemetry Polling Interval</label>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none"
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds (Default)</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deployment Environment & Cryptographic Engine (Read-Only) */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Cryptographic Architecture & Server Runtime</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Read-Only Deployment Config
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
              <span className="text-slate-500">Threshold Scheme:</span>
              <div className="text-slate-200 font-bold">Shamir SSS over GF(2⁸) Galois Field</div>
            </div>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
              <span className="text-slate-500">Share Encryption:</span>
              <div className="text-slate-200 font-bold">AES-256-GCM AEAD (Canonical AAD)</div>
            </div>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
              <span className="text-slate-500">Audit Ledger:</span>
              <div className="text-slate-200 font-bold">SHA-256 Continuous Hash-Chain</div>
            </div>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
              <span className="text-slate-500">Authentication:</span>
              <div className="text-slate-200 font-bold">Argon2id (RFC 9106) + JWT HS256</div>
            </div>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
              <span className="text-slate-500">Recovery TTL:</span>
              <div className="text-slate-200 font-bold">15 Minutes (One-Time-Use Nonce)</div>
            </div>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
              <span className="text-slate-500">Key Material Isolation:</span>
              <div className="text-slate-200 font-bold">In-Memory Zeroization / Enclave Safe</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-2 shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
