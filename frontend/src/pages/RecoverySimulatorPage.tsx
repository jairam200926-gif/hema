import React, { useState, useEffect } from 'react';
import {
  Flame,
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCcw,
  Layers,
  Activity,
  FileCheck2,
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

export const RecoverySimulatorPage: React.FC = () => {
  // Tab: Synthetic Sandbox vs Live Controlled Drill
  const [activeTab, setActiveTab] = useState<'SANDBOX' | 'DRILL'>('SANDBOX');

  // Synthetic Sandbox State
  const [thresholdK, setThresholdK] = useState(3);
  const [totalSharesN, setTotalSharesN] = useState(5);
  const [offlineShares, setOfflineShares] = useState<number[]>([]);
  const [corruptedShares, setCorruptedShares] = useState<number[]>([]);
  const [simulatedExpired, setSimulatedExpired] = useState(false);

  const [simEvaluating, setSimEvaluating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Live Controlled Drill State
  const [backups, setBackups] = useState<any[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [drillFailedShares, setDrillFailedShares] = useState<number[]>([]);
  const [drillRunning, setDrillRunning] = useState(false);
  const [drillResult, setDrillResult] = useState<any | null>(null);
  const [drillError, setDrillError] = useState<string | null>(null);

  const handleRunSyntheticEval = async (
    k = thresholdK,
    n = totalSharesN,
    offline = offlineShares,
    corrupted = corruptedShares,
    expired = simulatedExpired
  ) => {
    setSimEvaluating(true);
    setSimError(null);
    try {
      const res = await apiPost<any>('/simulator/evaluate', {
        threshold_k: k,
        total_shares_n: n,
        offline_shares: offline,
        corrupted_shares: corrupted,
        simulated_expired: expired,
      });
      setSimResult(res);
    } catch (err: any) {
      setSimError(err?.detail || err?.message || 'Simulator evaluation failed.');
    } finally {
      setSimEvaluating(false);
    }
  };

  useEffect(() => {
    // Load backups for the controlled drill tab
    apiGet<any[]>('/backups')
      .then((data) => {
        const active = (data || []).filter((b) => b.status === 'ACTIVE');
        setBackups(active);
        if (active.length > 0) setSelectedBackupId(active[0].id);
      })
      .catch(() => {});

    // Run initial synthetic evaluation
    handleRunSyntheticEval(thresholdK, totalSharesN, offlineShares, corruptedShares, simulatedExpired);
  }, []);

  const handleToggleOffline = (index: number) => {
    let next: number[];
    if (offlineShares.includes(index)) {
      next = offlineShares.filter((i) => i !== index);
    } else {
      next = [...offlineShares, index];
      // remove from corrupted if it was there
      setCorruptedShares(corruptedShares.filter((i) => i !== index));
    }
    setOfflineShares(next);
    handleRunSyntheticEval(thresholdK, totalSharesN, next, corruptedShares.filter((i) => i !== index), simulatedExpired);
  };

  const handleToggleCorrupted = (index: number) => {
    let next: number[];
    if (corruptedShares.includes(index)) {
      next = corruptedShares.filter((i) => i !== index);
    } else {
      next = [...corruptedShares, index];
      // remove from offline if it was there
      setOfflineShares(offlineShares.filter((i) => i !== index));
    }
    setCorruptedShares(next);
    handleRunSyntheticEval(thresholdK, totalSharesN, offlineShares.filter((i) => i !== index), next, simulatedExpired);
  };

  const handleResetSandbox = () => {
    setOfflineShares([]);
    setCorruptedShares([]);
    setSimulatedExpired(false);
    handleRunSyntheticEval(thresholdK, totalSharesN, [], [], false);
  };

  // Run controlled live drill
  const handleRunDrill = async () => {
    if (!selectedBackupId) return;
    setDrillRunning(true);
    setDrillError(null);
    setDrillResult(null);
    try {
      const res = await apiPost<any>('/simulator/run-drill', {
        backup_id: selectedBackupId,
        shares_to_simulate_fail: drillFailedShares,
      });
      setDrillResult(res);
    } catch (err: any) {
      setDrillError(err?.detail || err?.message || 'Controlled drill failed to execute.');
    } finally {
      setDrillRunning(false);
    }
  };

  const selectedBackup = backups.find((b) => b.id === selectedBackupId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Flame className="w-6 h-6 text-amber-500" />
            <span>Disaster Recovery Simulator & Resilience Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluate hypothetical catastrophic failure modes or execute non-destructive controlled drills on real vaults.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 p-1 rounded-lg bg-vault-950 border border-vault-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('SANDBOX')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'SANDBOX' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Synthetic Sandbox
          </button>
          <button
            onClick={() => setActiveTab('DRILL')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'DRILL' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Controlled Live Drill
          </button>
        </div>
      </div>

      {activeTab === 'SANDBOX' && (
        <div className="space-y-6">
          {/* Simulation Notice Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center space-x-2.5">
            <Activity className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Purely Synthetic Mode:</strong> Simulations operate in memory with synthetic secrets and zero production mutations. The backend verifies polynomial Lagrange reconstruction dynamically.
            </span>
          </div>

          {/* Scheme Configuration Controls */}
          {simError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
              {simError}
            </div>
          )}

          <div className="glass-panel p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Simulated Scheme Parameters</span>
              </h2>
              <div className="flex items-center space-x-2">
                {simEvaluating && <span className="text-xs text-blue-400 font-mono animate-pulse">Evaluating...</span>}
                <button
                  onClick={handleResetSandbox}
                  className="px-2.5 py-1 rounded bg-vault-800 hover:bg-vault-700 text-slate-300 text-xs font-mono flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Outages</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Total Shares (n):</span>
                  <span className="text-blue-400 font-bold">{totalSharesN}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="12"
                  value={totalSharesN}
                  onChange={(e) => {
                    const n = parseInt(e.target.value);
                    setTotalSharesN(n);
                    const k = thresholdK > n ? n : thresholdK;
                    setThresholdK(k);
                    setOfflineShares([]);
                    setCorruptedShares([]);
                    handleRunSyntheticEval(k, n, [], [], simulatedExpired);
                  }}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Threshold (k):</span>
                  <span className="text-amber-400 font-bold">{thresholdK}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max={totalSharesN}
                  value={thresholdK}
                  onChange={(e) => {
                    const k = parseInt(e.target.value);
                    setThresholdK(k);
                    handleRunSyntheticEval(k, totalSharesN, offlineShares, corruptedShares, simulatedExpired);
                  }}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-300">Simulate Expired TTL</span>
                  <p className="text-[10px] text-slate-500">Test time-to-live expiration rejection</p>
                </div>
                <input
                  type="checkbox"
                  checked={simulatedExpired}
                  onChange={(e) => {
                    setSimulatedExpired(e.target.checked);
                    handleRunSyntheticEval(thresholdK, totalSharesN, offlineShares, corruptedShares, e.target.checked);
                  }}
                  className="w-4 h-4 accent-red-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Share Grid / Failure Simulator */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Interactive Custodian Nodes & Adversarial Injections
            </h3>
            <p className="text-xs text-slate-400">
              Click buttons to simulate hardware outages (unreachable custodian) or bit-flip corruption (tampered ciphertext tag).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(totalSharesN)].map((_, idx) => {
                const shareIndex = idx + 1;
                const isOffline = offlineShares.includes(shareIndex);
                const isCorrupted = corruptedShares.includes(shareIndex);
                const isHealthy = !isOffline && !isCorrupted;

                return (
                  <div
                    key={shareIndex}
                    className={`p-3 rounded-xl border space-y-2 transition-all ${
                      isHealthy
                        ? 'bg-vault-950 border-emerald-500/40 text-slate-200'
                        : isOffline
                        ? 'bg-slate-900/80 border-slate-700 text-slate-500'
                        : 'bg-red-950/40 border-red-500/50 text-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold">Node #{shareIndex}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isHealthy ? 'bg-emerald-400' : isOffline ? 'bg-slate-500' : 'bg-red-400'
                        }`}
                      ></span>
                    </div>

                    <div className="text-[10px] font-mono">
                      {isHealthy && <span className="text-emerald-400">HEALTHY</span>}
                      {isOffline && <span className="text-slate-400">OUTAGE</span>}
                      {isCorrupted && <span className="text-red-400">TAMPERED</span>}
                    </div>

                    <div className="pt-2 border-t border-vault-800 flex items-center justify-between text-[10px] font-mono">
                      <button
                        onClick={() => handleToggleOffline(shareIndex)}
                        className={`px-1.5 py-0.5 rounded border ${
                          isOffline
                            ? 'bg-slate-700 text-white border-slate-600'
                            : 'bg-vault-900 text-slate-400 border-vault-700 hover:text-slate-200'
                        }`}
                      >
                        {isOffline ? 'Online' : 'Offline'}
                      </button>
                      <button
                        onClick={() => handleToggleCorrupted(shareIndex)}
                        className={`px-1.5 py-0.5 rounded border ${
                          isCorrupted
                            ? 'bg-red-800 text-white border-red-600'
                            : 'bg-vault-900 text-slate-400 border-vault-700 hover:text-slate-200'
                        }`}
                      >
                        {isCorrupted ? 'Clean' : 'Corrupt'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mathematical Simulation Outcome */}
          {simResult && (
            <div
              className={`glass-panel p-6 rounded-xl border space-y-4 animate-in fade-in ${
                simResult.can_recover && simResult.cryptographic_verification_passed
                  ? simResult.loss_tolerance === 0
                    ? 'border-amber-500/50'
                    : 'border-emerald-500/50'
                  : 'border-red-500/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {simResult.can_recover && simResult.cryptographic_verification_passed ? (
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                      {simResult.can_recover
                        ? simResult.loss_tolerance === 0
                          ? 'DEGRADED STATE (Zero Margin)'
                          : 'OPTIMAL RECOVERABILITY'
                        : 'UNRECOVERABLE DISASTER STATE'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {simResult.healthy_shares_count} surviving shares • {simResult.threshold_k} required
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="text-slate-400">Share Loss Tolerance: </span>
                  <span
                    className={`font-bold text-sm ${
                      simResult.loss_tolerance > 0
                        ? 'text-emerald-400'
                        : simResult.loss_tolerance === 0
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {simResult.loss_tolerance >= 0 ? `+${simResult.loss_tolerance} shares` : 'FAILED (Deficit)'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-vault-950 border border-vault-800 text-xs font-mono text-slate-300">
                {simResult.explanation}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
                  <span className="text-slate-500">Lagrange Test:</span>
                  <div className={simResult.cryptographic_verification_passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {simResult.cryptographic_verification_passed ? 'PASSED (Synthetic Secret Matched)' : 'ABORTED / FAILED'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
                  <span className="text-slate-500">Unreachable Outages:</span>
                  <div className="text-slate-200">{simResult.simulated_offline.length} Custodian(s)</div>
                </div>
                <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 space-y-1">
                  <span className="text-slate-500">AEAD Tag Corruption:</span>
                  <div className="text-slate-200">{simResult.simulated_corrupted.length} Share(s)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controlled Live Drill Tab */}
      {activeTab === 'DRILL' && (
        <div className="glass-panel p-6 rounded-xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <FileCheck2 className="w-5 h-5 text-blue-400" />
              <span>Controlled Live Vault Drill</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Execute a non-destructive verification ceremony against an existing vault. Real AES-256-GCM decryptions and Lagrange interpolation are performed on actual shares without logging or releasing the recovered plaintext.
            </p>
          </div>

          {backups.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono bg-vault-950 rounded-lg">
              No active vaults found to drill. Create a backup first.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Select Target Vault for Controlled Drill
                </label>
                <select
                  value={selectedBackupId}
                  onChange={(e) => {
                    setSelectedBackupId(e.target.value);
                    setDrillFailedShares([]);
                    setDrillResult(null);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none"
                >
                  {backups.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.threshold}-of-{b.total_shares} Scheme)
                    </option>
                  ))}
                </select>
              </div>

              {selectedBackup && (
                <div className="p-3.5 rounded-lg bg-vault-950 border border-vault-800 text-xs font-mono flex items-center justify-between">
                  <span className="text-slate-400">Vault Configuration:</span>
                  <span className="text-blue-400 font-bold">
                    {selectedBackup.threshold}-of-{selectedBackup.total_shares} SSS
                  </span>
                </div>
              )}

              {drillError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {drillError}
                </div>
              )}

              <button
                onClick={handleRunDrill}
                disabled={drillRunning || !selectedBackupId}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-sm"
              >
                {drillRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Executing Authenticated Drill...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Execute Non-Destructive Drill</span>
                  </>
                )}
              </button>

              {drillResult && (
                <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-3 font-mono text-xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">
                      Drill Outcome: {drillResult.drill_outcome}
                    </span>
                    <span className="text-slate-500">{drillResult.duration_ms} ms</span>
                  </div>

                  <div className="space-y-1 text-slate-400">
                    <div>Valid Shares Decrypted: {drillResult.valid_shares_count} of {drillResult.total_shares_n}</div>
                    <div>Threshold Satisfied: {drillResult.threshold_satisfied ? 'YES' : 'NO'}</div>
                    <div>Cryptographic Hash Verified: {drillResult.cryptographic_reconstruction_verified ? 'YES' : 'NO'}</div>
                  </div>

                  <div className="p-3 rounded bg-vault-900 border border-vault-800 text-[11px] text-slate-400">
                    {drillResult.tested_shares.map((ts: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-0.5">
                        <span>Share #{ts.share_index}:</span>
                        <span className={ts.status === 'VERIFIED_HEALTHY' ? 'text-emerald-400' : 'text-red-400'}>
                          {ts.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
