import React, { useState, useEffect } from 'react';
import { Users, Server, Cloud, Cpu, PlusCircle, RefreshCw, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export const CustodiansPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [custodians, setCustodians] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Custodian Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('CLOUD_KMS');
  const [newEmail, setNewEmail] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cData, sData] = await Promise.all([
        apiGet<any[]>('/custodians'),
        apiGet<any[]>('/shares').catch(() => []),
      ]);
      setCustodians(cData || []);
      setShares(sData || []);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load custodians.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCustodian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    setIsSubmitting(true);
    try {
      await apiPost('/custodians', {
        name: newName,
        type: newType,
        email: newEmail,
        description: newDesc,
      });
      setFeedback(`Custodian "${newName}" registered successfully.`);
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewDesc('');
      setTimeout(() => setFeedback(null), 3000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to create custodian: ${err?.detail || err?.message || 'Unauthorized'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Revoke custodian "${name}"?`)) return;
    try {
      await apiDelete(`/custodians/${id}`);
      setFeedback(`Custodian "${name}" revoked.`);
      setTimeout(() => setFeedback(null), 3000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to revoke custodian: ${err?.detail || err?.message || 'Unauthorized'}`);
    }
  };

  const getAssignedCount = (custodianId: string) => {
    return shares.filter((s) => s.custodian_id === custodianId).length;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CLOUD_KMS':
        return <Cloud className="w-5 h-5 text-blue-400" />;
      case 'HARDWARE_TOKEN':
        return <Cpu className="w-5 h-5 text-emerald-400" />;
      default:
        return <Server className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span>Custodian Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Independent entities responsible for safeguarding individual cryptographic shares during distributed backup ceremonies.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 rounded-lg bg-vault-900 hover:bg-vault-800 text-slate-400 hover:text-slate-200 border border-vault-700 text-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Custodian</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-vault-900 rounded-xl border border-vault-800"></div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-panel p-8 text-center space-y-3 max-w-xl mx-auto my-12 border border-red-500/30">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono"
          >
            Retry
          </button>
        </div>
      ) : custodians.length === 0 ? (
        <div className="glass-panel p-12 text-center space-y-3 max-w-xl mx-auto my-12">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-sm font-semibold text-slate-200">No Custodians Configured</h2>
          <p className="text-xs text-slate-400">
            Register custodian entities to assign cryptographic shares during backup ceremonies.
          </p>
        </div>
      ) : (
        /* Custodian Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {custodians.map((cust) => {
            const count = getAssignedCount(cust.id);
            return (
              <div
                key={cust.id}
                className="glass-panel p-5 rounded-xl border border-vault-700/80 space-y-4 hover:border-vault-600 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-vault-900 border border-vault-800 flex items-center justify-center">
                      {getTypeIcon(cust.type)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        cust.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cust.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        <span>{cust.status}</span>
                      </span>
                      {isAdmin && cust.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevoke(cust.id, cust.name)}
                          title="Revoke Custodian"
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-vault-900 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-200">{cust.name}</h3>
                    <p className="text-[11px] font-mono text-blue-400 mt-0.5">{cust.type}</p>
                    {cust.email && <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{cust.email}</p>}
                    {cust.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{cust.description}</p>}
                  </div>
                </div>

                <div className="pt-3 border-t border-vault-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Assigned Shares:</span>
                  <span className="text-blue-400 font-bold">{count} Protected</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Custodian Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full space-y-4 border border-vault-700">
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span>Register New Custodian</span>
            </h2>

            <form onSubmit={handleCreateCustodian} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Entity Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Zurich Cold Storage Enclave"
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Custodian Type *</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="CLOUD_KMS">Cloud KMS / HSM</option>
                  <option value="HARDWARE_TOKEN">Hardware Security Token</option>
                  <option value="TRUSTED_HUMAN">Trusted Human Custodian</option>
                  <option value="INSTITUTION">Institutional Trustee</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Contact Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="custodian@vaultguard.internal"
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Operational details, storage location, or enclave isolation level..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  {isSubmitting ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
