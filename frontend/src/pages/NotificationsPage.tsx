import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  AlertTriangle,
  Clock,
  Sliders,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { apiGet, apiPut } from '../api/client';

export const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'DEV_MAILBOX' | 'PREFERENCES'>('ALERTS');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState({
    security_alerts: true,
    recovery_alerts: true,
    backup_notifications: true,
    integrity_alerts: true,
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefSaveSuccess, setPrefSaveSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [notifsData, prefsData] = await Promise.all([
        apiGet<any[]>('/notifications?limit=100'),
        apiGet<any>('/notifications/preferences'),
      ]);
      setNotifications(notifsData || []);
      if (prefsData) {
        setPrefs({
          security_alerts: prefsData.security_alerts ?? true,
          recovery_alerts: prefsData.recovery_alerts ?? true,
          backup_notifications: prefsData.backup_notifications ?? true,
          integrity_alerts: prefsData.integrity_alerts ?? true,
        });
      }
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load notifications or preferences.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    setPrefSaveSuccess(null);
    try {
      await apiPut('/notifications/preferences', prefs);
      setPrefSaveSuccess('Notification preferences persisted successfully.');
      setTimeout(() => setPrefSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(`Failed to save preferences: ${err?.detail || err?.message || 'Network error'}`);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Bell className="w-6 h-6 text-amber-400" />
            <span>Security Notification Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time transactional security alerts dispatched via SMTP / Development Mailbox.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 p-1 rounded-lg bg-vault-950 border border-vault-800 self-start sm:self-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('ALERTS')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'ALERTS' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Alert Feed ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('DEV_MAILBOX')}
            className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeTab === 'DEV_MAILBOX' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Dev Mailbox</span>
          </button>
          <button
            onClick={() => setActiveTab('PREFERENCES')}
            className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeTab === 'PREFERENCES' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 space-y-3 animate-pulse">
          <div className="h-6 bg-vault-900 rounded w-1/4"></div>
          <div className="h-14 bg-vault-900/60 rounded"></div>
          <div className="h-14 bg-vault-900/60 rounded"></div>
        </div>
      ) : error ? (
        <div className="glass-panel p-8 text-center space-y-3 max-w-xl mx-auto border border-red-500/30">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Tab 1: Alert Feed */}
          {activeTab === 'ALERTS' && (
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="glass-panel p-12 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-mono">No security alerts dispatched yet.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="glass-panel p-4 rounded-xl border border-vault-700/80 space-y-2 hover:border-vault-600 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-mono">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            n.notification_type?.includes('SECURITY') || n.notification_type?.includes('INTEGRITY')
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {n.notification_type}
                        </span>
                        <span className="font-semibold text-slate-200">{n.subject}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{n.created_at ? new Date(n.created_at).toLocaleString() : 'N/A'}</span>
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">
                          {n.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{n.body}</p>

                    <div className="pt-2 border-t border-vault-800 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                      <span>Recipient: {n.recipient}</span>
                      <span>Delivery Engine: In-Memory / Dev Mailbox</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Development Mailbox Inspector */}
          {activeTab === 'DEV_MAILBOX' && (
            <div className="glass-panel p-5 rounded-xl space-y-5">
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Development Mailbox Mode:</strong> Outbound transactional emails are persisted to the database and intercepted here in real-time, allowing security verification without leaking tokens or requiring external SMTP connectivity.
                </span>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs font-mono">
                  Mailbox inbox is currently empty.
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-3 font-mono text-xs">
                      <div className="border-b border-vault-800 pb-2 space-y-1">
                        <div className="text-slate-400">
                          <span className="text-slate-500">From: </span>
                          <span className="text-blue-400">VaultGuard Security &lt;security@vaultguard.internal&gt;</span>
                        </div>
                        <div className="text-slate-400">
                          <span className="text-slate-500">To: </span>
                          <span className="text-slate-200">{item.recipient}</span>
                        </div>
                        <div className="text-slate-400">
                          <span className="text-slate-500">Subject: </span>
                          <span className="text-slate-100 font-bold">{item.subject}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded bg-vault-900 text-slate-300 font-sans text-xs leading-relaxed whitespace-pre-line border border-vault-800">
                        {item.body}
                        {'\n\n'}
                        <span className="text-slate-500 text-[11px] font-mono">
                          --{'\n'}
                          VaultGuard Autonomous Security Daemon{'\n'}
                          Status: {item.status} • Timestamp: {item.created_at}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Notification Preferences */}
          {activeTab === 'PREFERENCES' && (
            <form onSubmit={handleSavePreferences} className="glass-panel p-6 rounded-xl space-y-6 max-w-2xl">
              <div>
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Security Alert Preferences
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real backend-persisted preference toggles stored in your tenant database profile.
                </p>
              </div>

              {prefSaveSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{prefSaveSuccess}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-vault-950 border border-vault-800">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Critical Security Alerts</h3>
                    <p className="text-[11px] text-slate-400">Unauthorized recovery attempts, replay attacks, and IDOR denials</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.security_alerts}
                    onChange={(e) => setPrefs({ ...prefs, security_alerts: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-vault-950 border border-vault-800">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Share Integrity Alerts</h3>
                    <p className="text-[11px] text-slate-400">SHA-256 fingerprint mismatches and AES-GCM tag verification failures</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.integrity_alerts}
                    onChange={(e) => setPrefs({ ...prefs, integrity_alerts: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-vault-950 border border-vault-800">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Threshold Recovery Alerts</h3>
                    <p className="text-[11px] text-slate-400">Session initiation, verified reconstruction, and sub-threshold rejections</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.recovery_alerts}
                    onChange={(e) => setPrefs({ ...prefs, recovery_alerts: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-vault-950 border border-vault-800">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">New Backup Creation Notices</h3>
                    <p className="text-[11px] text-slate-400">Receipts for completed Shamir split and custodian distribution ceremonies</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.backup_notifications}
                    onChange={(e) => setPrefs({ ...prefs, backup_notifications: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingPrefs}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingPrefs ? 'Saving to Database...' : 'Save Preferences'}</span>
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};
