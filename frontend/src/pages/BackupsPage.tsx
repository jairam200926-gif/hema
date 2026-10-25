import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, PlusCircle, Search, RefreshCw, AlertTriangle, Archive, CheckCircle2 } from 'lucide-react';
import { apiGet, apiDelete } from '../api/client';

export const BackupsPage: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<any[]>('/backups');
      setBackups(data || []);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load backups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleArchive = async (backupId: string, backupName: string) => {
    if (!window.confirm(`Archive vault "${backupName}"? This marks the backup as inactive.`)) return;
    try {
      await apiDelete(`/backups/${backupId}`);
      setActionSuccess(`Vault "${backupName}" successfully archived.`);
      setTimeout(() => setActionSuccess(null), 3000);
      await fetchBackups();
    } catch (err: any) {
      alert(`Failed to archive vault: ${err?.detail || err?.message || 'Unknown error'}`);
    }
  };

  const filteredBackups = backups.filter(
    (b) =>
      (b.name && b.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.description && b.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <KeyRound className="w-6 h-6 text-blue-400" />
            <span>Backup Registry</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered cryptographic backup vaults protected by Shamir secret sharing and AES-256-GCM.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchBackups}
            title="Refresh"
            className="p-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-400 hover:text-slate-200 border border-vault-700 text-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/backups/new"
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Backup Ceremony</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel p-3.5 rounded-xl flex items-center space-x-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter backups by name or description..."
          className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
        />
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-vault-900 rounded w-1/4"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
        </div>
      ) : error ? (
        <div className="glass-panel p-6 rounded-xl border border-red-500/30 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={fetchBackups}
            className="px-3 py-1.5 rounded-lg bg-vault-800 text-xs font-mono text-slate-200 border border-vault-700"
          >
            Retry
          </button>
        </div>
      ) : filteredBackups.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center space-y-3">
          <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">
            {searchTerm ? 'No matching vaults found' : 'No backup vaults registered yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? 'Try adjusting your search criteria.'
              : 'Initialize your first threshold cryptographic backup ceremony to split and distribute shares.'}
          </p>
          {!searchTerm && (
            <Link
              to="/backups/new"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Launch Backup Ceremony</span>
            </Link>
          )}
        </div>
      ) : (
        /* Backups Table */
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-slate-400 font-mono border-b border-vault-800">
              <tr>
                <th className="py-3 px-4">Vault Name & Details</th>
                <th className="py-3 px-4">Threshold Scheme</th>
                <th className="py-3 px-4">Verification Digest</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800 text-slate-300">
              {filteredBackups.map((bk) => (
                <tr key={bk.id} className="hover:bg-vault-850/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200">{bk.name}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-sm">{bk.description || 'No description provided'}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {bk.threshold}-of-{bk.total_shares} Shares
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                    <span className="truncate max-w-[140px] inline-block font-mono" title={bk.secret_verification_digest}>
                      {bk.secret_verification_digest ? `${bk.secret_verification_digest.slice(0, 16)}...` : 'N/A'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      bk.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${bk.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                      <span>{bk.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {bk.created_at ? new Date(bk.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <Link
                      to="/shares"
                      className="px-2.5 py-1 rounded bg-vault-800 hover:bg-vault-700 text-slate-300 border border-vault-700 text-[11px] font-mono transition-colors"
                    >
                      Shares
                    </Link>
                    <Link
                      to="/recovery"
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono transition-colors"
                    >
                      Recover
                    </Link>
                    {bk.status !== 'ARCHIVED' && (
                      <button
                        onClick={() => handleArchive(bk.id, bk.name)}
                        title="Archive Vault"
                        className="px-2 py-1 rounded bg-vault-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-vault-800 hover:border-red-800/40 text-[11px] font-mono transition-colors"
                      >
                        <Archive className="w-3 h-3 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
