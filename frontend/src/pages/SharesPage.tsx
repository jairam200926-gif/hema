import React, { useState, useEffect } from 'react';
import {
  Layers,
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

export const SharesPage: React.FC = () => {
  const [shares, setShares] = useState<any[]>([]);
  const [custodiansMap, setCustodiansMap] = useState<Record<string, string>>({});
  const [backupsMap, setBackupsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    status: 'PASSED' | 'FAILED';
    message: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sharesData, custData, bkData] = await Promise.all([
        apiGet<any[]>('/shares'),
        apiGet<any[]>('/custodians').catch(() => []),
        apiGet<any[]>('/backups').catch(() => []),
      ]);

      setShares(sharesData || []);

      const cMap: Record<string, string> = {};
      (custData || []).forEach((c) => {
        cMap[c.id] = c.name;
      });
      setCustodiansMap(cMap);

      const bMap: Record<string, string> = {};
      (bkData || []).forEach((b) => {
        bMap[b.id] = b.name;
      });
      setBackupsMap(bMap);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load custodian shares.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerify = async (shareId: string) => {
    setVerifyingId(shareId);
    setVerificationFeedback(null);
    try {
      const res = await apiPost<any>(`/shares/${shareId}/verify`, {});
      if (res && res.status === 'PASSED') {
        setVerificationFeedback({
          status: 'PASSED',
          message: `Share integrity verified: AES-256-GCM AEAD tag authenticated & SHA-256 digest verified against stored anchor.`,
        });
      } else {
        setVerificationFeedback({
          status: 'FAILED',
          message: `Integrity check failed: ${res?.detail || 'Cryptographic mismatch detected.'}`,
        });
      }
      // Reload shares to get updated status/last_verified_at
      await loadData();
    } catch (err: any) {
      setVerificationFeedback({
        status: 'FAILED',
        message: err?.detail || err?.message || 'Verification execution failed.',
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            <span>Custodian Share Repository</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Shares are protected at rest via AES-256-GCM with canonical AAD binding.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-400 hover:text-slate-200 border border-vault-700 text-xs flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Verification Alert Banner */}
      {verificationFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in ${
            verificationFeedback.status === 'PASSED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {verificationFeedback.status === 'PASSED' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{verificationFeedback.message}</span>
        </div>
      )}

      {/* Security Notice */}
      <div className="p-3.5 rounded-xl bg-vault-900/90 border border-vault-800 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong className="text-slate-200">Zero Raw Secret Exposure:</strong> Plaintext polynomial shares are never stored in the database. Each row contains an encrypted ciphertext, 96-bit nonce, and 128-bit authentication tag.
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 whitespace-nowrap self-start sm:self-auto">
          AES-256-GCM AEAD
        </span>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-vault-900 rounded w-1/4"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
          <div className="h-10 bg-vault-900/60 rounded"></div>
        </div>
      ) : error ? (
        <div className="glass-panel p-6 rounded-xl border border-red-500/30 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg bg-vault-800 text-xs font-mono text-slate-200 border border-vault-700"
          >
            Retry
          </button>
        </div>
      ) : shares.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Cryptographic Shares Generated</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Shares are automatically generated when you create a new backup ceremony.
          </p>
        </div>
      ) : (
        /* Shares Table */
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-slate-400 font-mono border-b border-vault-800">
              <tr>
                <th className="py-3 px-4">Share ID & Index</th>
                <th className="py-3 px-4">Vault Name</th>
                <th className="py-3 px-4">Assigned Custodian</th>
                <th className="py-3 px-4">Ciphertext (Encrypted)</th>
                <th className="py-3 px-4">Integrity Hash (SHA-256)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Integrity Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800 text-slate-300">
              {shares.map((sh) => (
                <tr key={sh.id} className="hover:bg-vault-850/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono">
                    <div className="font-bold text-slate-200">{String(sh.id).slice(0, 8)}...</div>
                    <div className="text-[10px] text-blue-400">Share Index: #{sh.share_index}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-200">
                    {backupsMap[sh.backup_id] || String(sh.backup_id).slice(0, 8)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-200">
                      {custodiansMap[sh.custodian_id] || String(sh.custodian_id).slice(0, 8)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                    <span className="truncate max-w-[120px] inline-block font-mono" title={sh.encrypted_share}>
                      {sh.encrypted_share ? `${sh.encrypted_share.slice(0, 16)}...` : 'AES-GCM encrypted'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                    <span className="truncate max-w-[120px] inline-block font-mono" title={sh.share_integrity_hash}>
                      {sh.share_integrity_hash ? `${sh.share_integrity_hash.slice(0, 16)}...` : 'SHA-256'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {sh.status === 'HEALTHY' ? (
                      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        <span>HEALTHY</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono">
                        <ShieldAlert className="w-3 h-3" />
                        <span>{sh.status || 'UNVERIFIED'}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleVerify(sh.id)}
                      disabled={verifyingId === sh.id}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white border border-blue-600 text-[11px] font-mono inline-flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${verifyingId === sh.id ? 'animate-spin' : ''}`} />
                      <span>Verify</span>
                    </button>
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
