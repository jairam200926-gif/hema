import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Download,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { apiGet } from '../api/client';

export const AuditPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [selectedResult, setSelectedResult] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hash-Chain Verification State
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [chainStatus, setChainStatus] = useState<any | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<any[]>('/audit?limit=200');
      setEvents(data || []);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to fetch audit events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleVerifyChain = async () => {
    setIsVerifyingChain(true);
    try {
      const report = await apiGet<any>('/audit/verify-chain');
      setChainStatus(report);
    } catch (err: any) {
      setChainStatus({
        valid: false,
        message: err?.detail || err?.message || 'Chain verification probe failed.',
      });
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const filteredEvents = events.filter((evt) => {
    const textSearch =
      (evt.event_type && evt.event_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (evt.request_id && evt.request_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (evt.metadata && JSON.stringify(evt.metadata).toLowerCase().includes(searchTerm.toLowerCase()));

    const typeMatch = selectedEventType === 'ALL' || evt.event_type === selectedEventType;
    const resultMatch = selectedResult === 'ALL' || evt.result === selectedResult;

    return textSearch && typeMatch && resultMatch;
  });

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vaultguard-audit-ledger-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <ScrollText className="w-6 h-6 text-blue-400" />
            <span>Tamper-Evident Audit Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Verifiable chronological sequence of cryptographic ceremonies, access evaluations, and security alerts.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleVerifyChain}
            disabled={isVerifyingChain}
            className="px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs flex items-center space-x-1.5 transition-all"
          >
            <ShieldCheck className={`w-4 h-4 ${isVerifyingChain ? 'animate-spin' : ''}`} />
            <span>{isVerifyingChain ? 'Traversing Chain...' : 'Verify Hash-Chain'}</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-200 border border-vault-700 font-semibold text-xs flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Live Hash-Chain Status Card */}
      {chainStatus && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono space-y-2 animate-in fade-in ${
            chainStatus.valid
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/10 border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {chainStatus.valid ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-400" />
              )}
              <span className="font-bold">
                {chainStatus.valid
                  ? 'Cryptographic Hash-Chain Integrity Verified'
                  : 'Hash-Chain Inconsistency Detected'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Verified: {chainStatus.verified_events} of {chainStatus.total_events} events
            </span>
          </div>
          <p className="text-slate-300 text-xs font-sans">{chainStatus.message}</p>
          {chainStatus.head_hash && (
            <div className="text-[10px] text-slate-400 truncate">
              Head SHA-256 Digest: <span className="text-blue-400">{chainStatus.head_hash}</span>
            </div>
          )}
        </div>
      )}

      {/* Cryptographic Limitation Notice */}
      <div className="p-3.5 rounded-xl bg-vault-900/90 border border-vault-800 text-xs text-slate-400 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-200">Security Model & Limitations:</strong> The audit ledger utilizes continuous SHA-256 hash chaining (previous_hash &rarr; event_hash) to provide mathematical tamper evidence against selective row insertion, deletion, or modification. However, an attacker with root database rewrite privileges could theoretically recompute the entire chain. For maximum non-repudiation, export signed checkpoints to external cold storage.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="glass-panel p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search event type, request ID, or metadata..."
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-200 text-xs font-mono focus:outline-none"
          >
            <option value="ALL">All Event Types</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="USER_LOGIN_FAILED">USER_LOGIN_FAILED</option>
            <option value="BACKUP_CREATED">BACKUP_CREATED</option>
            <option value="BACKUP_ARCHIVED">BACKUP_ARCHIVED</option>
            <option value="SHARE_INTEGRITY_VERIFIED">SHARE_INTEGRITY_VERIFIED</option>
            <option value="RECOVERY_INITIATED">RECOVERY_INITIATED</option>
            <option value="RECOVERY_SUCCESS">RECOVERY_SUCCESS</option>
            <option value="RECOVERY_FAILED">RECOVERY_FAILED</option>
            <option value="UNAUTHORIZED_ATTEMPT">UNAUTHORIZED_ATTEMPT</option>
            <option value="REPLAY_ATTEMPT">REPLAY_ATTEMPT</option>
          </select>

          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-200 text-xs font-mono focus:outline-none"
          >
            <option value="ALL">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-vault-900 rounded w-1/4"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
        </div>
      ) : error ? (
        <div className="glass-panel p-8 text-center space-y-3 max-w-xl mx-auto my-12 border border-red-500/30">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={loadEvents}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono"
          >
            Retry
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center space-y-3">
          <ScrollText className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-sm font-semibold text-slate-200">No Security Events Found</h2>
          <p className="text-xs text-slate-400">
            {searchTerm || selectedEventType !== 'ALL' || selectedResult !== 'ALL'
              ? 'Try widening your filter parameters.'
              : 'Audit entries will populate automatically upon user authentication, backups, and recovery actions.'}
          </p>
        </div>
      ) : (
        /* Audit Table */
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-slate-400 font-mono border-b border-vault-800">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Event Identifier</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Chain Hash (SHA-256)</th>
                <th className="py-3 px-4">Metadata Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800 text-slate-300">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-vault-850/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {evt.created_at ? new Date(evt.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                    <div>{evt.event_type}</div>
                    {evt.request_id && (
                      <div className="text-[10px] text-slate-500 font-normal">req: {evt.request_id.slice(0, 10)}...</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-mono text-[10px] ${
                        evt.result === 'SUCCESS'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : evt.result === 'WARNING'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}
                    >
                      <span>{evt.result}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                    <span className="truncate max-w-[130px] inline-block font-mono text-blue-400" title={evt.event_hash}>
                      {evt.event_hash ? `${evt.event_hash.slice(0, 14)}...` : 'genesis'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-xs font-mono">
                    <span className="truncate max-w-xs inline-block" title={JSON.stringify(evt.metadata)}>
                      {evt.metadata ? JSON.stringify(evt.metadata) : '—'}
                    </span>
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
