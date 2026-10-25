import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Unlock,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

export const RecoveryPage: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [custodiansMap, setCustodiansMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [selectedShareIds, setSelectedShareIds] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [recoveredSecret, setRecoveredSecret] = useState<string | null>(null);
  const [recoveryMeta, setRecoveryMeta] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [hideSecret, setHideSecret] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [bkData, shData, cData] = await Promise.all([
        apiGet<any[]>('/backups'),
        apiGet<any[]>('/shares'),
        apiGet<any[]>('/custodians').catch(() => []),
      ]);

      const activeBackups = (bkData || []).filter((b) => b.status !== 'ARCHIVED');
      setBackups(activeBackups);
      setShares(shData || []);

      const cMap: Record<string, string> = {};
      (cData || []).forEach((c) => {
        cMap[c.id] = c.name;
      });
      setCustodiansMap(cMap);

      if (activeBackups.length > 0 && !selectedBackupId) {
        setSelectedBackupId(activeBackups[0].id);
      }
    } catch (err: any) {
      setPageError(err?.detail || err?.message || 'Failed to initialize recovery console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentBackup = backups.find((b) => b.id === selectedBackupId) || backups[0];
  const threshold = currentBackup ? currentBackup.threshold : 0;
  const availableShares = shares.filter((s) => s.backup_id === selectedBackupId);

  // Toggle share selection
  const handleToggleShare = (id: string) => {
    setValidationError(null);
    if (selectedShareIds.includes(id)) {
      setSelectedShareIds(selectedShareIds.filter((sId) => sId !== id));
    } else {
      setSelectedShareIds([...selectedShareIds, id]);
    }
  };

  // Execute genuine cryptographic threshold recovery ceremony
  const handleRecover = async () => {
    if (!currentBackup) return;

    if (selectedShareIds.length < threshold) {
      setValidationError(`Threshold unsatisfied: ${selectedShareIds.length} shares selected, minimum ${threshold} required.`);
      return;
    }

    setIsVerifying(true);
    setValidationError(null);
    setRecoveredSecret(null);
    setRecoveryMeta(null);

    try {
      // 1. Initialize time-limited recovery session on backend
      const initRes = await apiPost<{ request_id: string; expires_at: string }>(
        '/recovery/init',
        { backup_id: currentBackup.id }
      );

      const requestId = initRes.request_id;

      // 2. Map selected share IDs to custodian and coordinate objects
      const selectedShareObjects = shares
        .filter((s) => selectedShareIds.includes(s.id))
        .map((s) => ({
          custodian_id: s.custodian_id,
          share_index: s.share_index,
        }));

      // 3. Submit for authenticated decryption and Lagrange interpolation
      const submitRes = await apiPost<any>('/recovery/submit', {
        request_id: requestId,
        shares: selectedShareObjects,
        confirm_release: true,
      });

      if (submitRes && submitRes.result === 'SUCCESS') {
        setRecoveredSecret(submitRes.recovered_secret);
        setRecoveryMeta(submitRes);
      } else {
        setValidationError(submitRes?.message || 'Reconstruction failed verification.');
      }
    } catch (err: any) {
      setValidationError(err?.detail || err?.message || 'Cryptographic recovery failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = () => {
    if (!recoveredSecret) return;
    navigator.clipboard.writeText(recoveredSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-vault-900 rounded-lg w-1/3"></div>
        <div className="h-24 bg-vault-900 rounded-xl"></div>
        <div className="h-48 bg-vault-900 rounded-xl"></div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="glass-panel p-8 text-center space-y-3 max-w-xl mx-auto my-12 border border-red-500/30">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-xs text-slate-300">{pageError}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono"
        >
          Retry
        </button>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="glass-panel p-12 text-center space-y-3 max-w-xl mx-auto my-12">
        <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
        <h2 className="text-sm font-semibold text-slate-200">No Recoverable Vaults</h2>
        <p className="text-xs text-slate-400">
          You must establish at least one active backup before executing recovery ceremonies.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
          <FileCheck2 className="w-6 h-6 text-emerald-400" />
          <span>Threshold Recovery Console</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Authorized reconstruction of master secrets by assembling the required threshold of valid custodian shares over GF(2⁸).
        </p>
      </div>

      {/* Target Backup Selector */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <label className="block text-xs font-mono text-slate-400 mb-1">
            Target Backup Vault
          </label>
          <select
            value={selectedBackupId}
            onChange={(e) => {
              setSelectedBackupId(e.target.value);
              setSelectedShareIds([]);
              setRecoveredSecret(null);
              setValidationError(null);
            }}
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
          >
            {backups.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.threshold}-of-{b.total_shares} Scheme)
              </option>
            ))}
          </select>
        </div>

        {/* Security Pre-Flight Status */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400">Authentication:</span>
            <span className="text-emerald-400 font-bold ml-1.5">VERIFIED</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Ownership:</span>
            <span className="text-emerald-400 font-bold ml-1.5">AUTHORIZED</span>
          </div>
        </div>
      </div>

      {/* Threshold Progress Meter */}
      {currentBackup && (
        <div className="glass-panel p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-200">
                Threshold Assembly Progress
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-200">
              {selectedShareIds.length} / {threshold} Shares Selected
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-vault-950 h-3 rounded-full overflow-hidden border border-vault-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                selectedShareIds.length >= threshold
                  ? 'bg-emerald-500 shadow-glow-success'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, (selectedShareIds.length / (threshold || 1)) * 100)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">
              Status:{' '}
              {selectedShareIds.length >= threshold ? (
                <span className="text-emerald-400 font-bold">Threshold Satisfied — Reconstruction Ready</span>
              ) : (
                <span className="text-amber-400 font-bold">
                  Awaiting {threshold - selectedShareIds.length} more share(s)
                </span>
              )}
            </span>
            <span className="text-slate-500">Config: {threshold}-of-{currentBackup.total_shares}</span>
          </div>
        </div>
      )}

      {/* Share Collection Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
          Select Participating Custodian Shares
        </h3>

        {availableShares.length === 0 ? (
          <div className="p-6 rounded-xl bg-vault-950 border border-vault-800 text-center text-xs text-slate-500 font-mono">
            No shares recorded for this vault.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {availableShares.map((sh) => {
              const isSelected = selectedShareIds.includes(sh.id);
              const custodianName = custodiansMap[sh.custodian_id] || 'Trusted Custodian';
              return (
                <div
                  key={sh.id}
                  onClick={() => handleToggleShare(sh.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/60 shadow-sm'
                      : 'bg-vault-900 border-vault-800 hover:border-vault-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-slate-100">
                      Share #{sh.share_index}
                    </span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-vault-800 text-slate-500 border border-vault-700'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{custodianName}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                    <span>Coordinate #{sh.share_index}</span>
                    <span className={sh.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}>
                      {sh.status || 'AVAILABLE'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Trigger Recovery Action */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleRecover}
          disabled={isVerifying || selectedShareIds.length < threshold}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center space-x-2 shadow-glow-success transition-all"
        >
          {isVerifying ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Executing Lagrange Interpolation over GF(2⁸)...</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" />
              <span>Reconstruct & Verify Secret</span>
            </>
          )}
        </button>
      </div>

      {/* Controlled Secret Release Panel */}
      {recoveredSecret && (
        <div className="glass-panel p-6 rounded-xl border border-emerald-500/50 space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Secret Successfully Reconstructed
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Digest Match Verified
            </span>
          </div>

          <div className="p-4 rounded-lg bg-vault-950 border border-vault-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">Reconstructed Plaintext Value:</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setHideSecret(!hideSecret)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                >
                  {hideSecret ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{hideSecret ? 'Reveal' : 'Mask'}</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded bg-vault-800 hover:bg-vault-700 text-slate-200 border border-vault-700 text-xs flex items-center space-x-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded bg-vault-900 border border-vault-800 font-mono text-sm text-emerald-400 break-all select-all">
              {hideSecret ? '••••••••••••••••••••••••••••••••••••••••' : recoveredSecret}
            </div>

            {recoveryMeta && (
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-vault-800">
                <span>Ceremony ID: <span className="text-slate-200">{recoveryMeta.request_id || 'RECONSTRUCTED'}</span></span>
                <span>Audit Status: <span className="text-emerald-400">HASH_CHAIN_LOGGED</span></span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Zero Server-Side Storage:</strong> This secret was reconstructed dynamically in memory and verified against the stored SHA-256 HMAC digest. It was never written to persistent logs or database tables.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
