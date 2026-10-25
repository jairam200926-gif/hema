import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Lock, Layers, CheckCircle2, Eye, EyeOff, ArrowRight, AlertTriangle, Users } from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

export const CreateBackupPage: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [totalShares, setTotalShares] = useState(5);
  const [threshold, setThreshold] = useState(3);
  const [availableCustodians, setAvailableCustodians] = useState<any[]>([]);
  const [selectedCustodianIds, setSelectedCustodianIds] = useState<string[]>([]);
  const [loadingCustodians, setLoadingCustodians] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBackupSuccess, setCreatedBackupSuccess] = useState<any>(null);

  useEffect(() => {
    apiGet<any[]>('/custodians')
      .then((data) => {
        const active = (data || []).filter((c) => c.status === 'ACTIVE');
        setAvailableCustodians(active);
        setSelectedCustodianIds((current) =>
          current.length > 0 ? current : active.slice(0, 5).map((c) => c.id)
        );
      })
      .catch((err) => {
        setError(`Failed to fetch custodians: ${err?.detail || err?.message || 'Check backend connection'}`);
      })
      .finally(() => setLoadingCustodians(false));
  }, []);

  const handleTotalSharesChange = (n: number) => {
    setTotalShares(n);
    if (threshold > n) setThreshold(n);
    // Auto-update selected custodians list
    const activeIds = availableCustodians.map((c) => c.id);
    setSelectedCustodianIds(activeIds.slice(0, n));
  };

  const handleToggleCustodian = (custodianId: string) => {
    if (selectedCustodianIds.includes(custodianId)) {
      setSelectedCustodianIds(selectedCustodianIds.filter((id) => id !== custodianId));
    } else {
      if (selectedCustodianIds.length < totalShares) {
        setSelectedCustodianIds([...selectedCustodianIds, custodianId]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !secret) return;

    if (threshold > totalShares) {
      setError('Threshold k cannot exceed total shares n.');
      return;
    }

    if (selectedCustodianIds.length !== totalShares) {
      setError(`Please select exactly ${totalShares} unique custodians (currently selected: ${selectedCustodianIds.length}).`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name,
        description,
        secret,
        threshold,
        total_shares: totalShares,
        custodian_ids: selectedCustodianIds,
      };

      const result = await apiPost<any>('/backups', payload);

      setCreatedBackupSuccess({
        id: result.id,
        name: result.name,
        threshold: result.threshold,
        totalShares: result.total_shares,
        digest: result.secret_verification_digest,
        algorithm: result.algorithm,
        custodiansAssigned: availableCustodians.filter((c) => selectedCustodianIds.includes(c.id)),
      });

      // Erase secret from state immediately
      setSecret('');
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Backup ceremony execution failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
          <Key className="w-6 h-6 text-blue-400" />
          <span>New Backup Ceremony</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Distribute sensitive credentials across independent custodians using Shamir's (k, n) secret sharing over GF(2⁸) with AES-256-GCM authenticated encryption.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success State */}
      {createdBackupSuccess ? (
        <div className="glass-panel p-6 rounded-xl border border-emerald-500/40 space-y-5 animate-in fade-in zoom-in-95">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Backup Established Successfully</h2>
              <p className="text-xs text-emerald-400 font-mono">
                {createdBackupSuccess.totalShares} Shares Generated • Threshold {createdBackupSuccess.threshold} Required
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-vault-950 border border-vault-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Vault ID:</span>
              <span className="text-slate-200">{createdBackupSuccess.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vault Name:</span>
              <span className="text-slate-100 font-semibold">{createdBackupSuccess.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Threshold Configuration:</span>
              <span className="text-blue-400">{createdBackupSuccess.threshold}-of-{createdBackupSuccess.totalShares} Shamir SSS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Protection at Rest:</span>
              <span className="text-slate-300">AES-256-GCM + Canonical AAD Binding</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Secret Verification Digest:</span>
              <span className="text-slate-300 truncate max-w-xs">{createdBackupSuccess.digest}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-vault-800 text-emerald-400">
              <span>Original Secret Material:</span>
              <span className="font-bold">Erased From Memory (Never Stored)</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Assigned Custodians
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {createdBackupSuccess.custodiansAssigned.map((c: any, idx: number) => (
                <div key={c.id} className="p-2.5 rounded bg-vault-950 border border-vault-800 flex items-center justify-between">
                  <span className="text-slate-200">{c.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    Share #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => {
                setCreatedBackupSuccess(null);
                setName('');
                setDescription('');
              }}
              className="px-4 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 text-xs font-semibold"
            >
              Create Another Backup
            </button>
            <button
              onClick={() => navigate('/backups')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5"
            >
              <span>View in Registry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Backup Form */
        <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-xl space-y-6">
          {/* Vault Metadata */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Vault Backup Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Master CA Root Key 2026"
                className="w-full px-3.5 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Description / Purpose
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Multi-custodian root key backup for disaster recovery"
                className="w-full px-3.5 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Secret Material Input */}
          <div className="space-y-2 pt-2 border-t border-vault-800">
            <label className="block text-xs font-mono text-slate-300">
              Secret Material *
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                required
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter secret material to protect..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              The secret will be processed in-memory, split into Shamir polynomial shares, and immediately discarded.
            </p>
          </div>

          {/* Dynamic Threshold Configuration */}
          <div className="space-y-4 pt-2 border-t border-vault-800">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Threshold Cryptography Scheme</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total Shares (n) */}
              <div className="p-3.5 rounded-lg bg-vault-950 border border-vault-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Total Shares (n):</span>
                  <span className="text-blue-400 font-bold">{totalShares}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max={Math.max(5, availableCustodians.length || 5)}
                  value={totalShares}
                  onChange={(e) => handleTotalSharesChange(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>2 shares</span>
                  <span>{availableCustodians.length} available</span>
                </div>
              </div>

              {/* Threshold (k) */}
              <div className="p-3.5 rounded-lg bg-vault-950 border border-vault-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Threshold Required (k):</span>
                  <span className="text-amber-400 font-bold">{threshold}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max={totalShares}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>2 shares</span>
                  <span>{totalShares} max</span>
                </div>
              </div>
            </div>

            {/* Custodian Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-slate-400 flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Assigned Custodians ({selectedCustodianIds.length} of {totalShares} selected)</span>
                </span>
                {selectedCustodianIds.length !== totalShares && (
                  <span className="text-[11px] font-mono text-amber-400">
                    Need {totalShares - selectedCustodianIds.length} more
                  </span>
                )}
              </div>

              {loadingCustodians ? (
                <div className="text-xs text-slate-500 font-mono py-2">Loading active custodians...</div>
              ) : availableCustodians.length === 0 ? (
                <div className="text-xs text-red-400 font-mono py-2">
                  No active custodians found. Custodians must be provisioned before running a backup.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableCustodians.map((c) => {
                    const isSelected = selectedCustodianIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleCustodian(c.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500/50 text-slate-200'
                            : 'bg-vault-950 border-vault-800 text-slate-400 hover:border-vault-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{c.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{c.type}</div>
                        </div>
                        <span className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center ${
                          isSelected ? 'bg-blue-500 text-white' : 'bg-vault-800 border border-vault-700'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-vault-950/70 border border-vault-800 text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>Selected Scheme:</span>
              <span className="text-emerald-400 font-bold">
                {threshold}-of-{totalShares} Shamir Scheme
              </span>
            </div>
          </div>

          {/* Submit Ceremony Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !name || !secret || selectedCustodianIds.length !== totalShares}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-2 shadow-glow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Executing Shamir Split Ceremony...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Execute Backup Ceremony</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
