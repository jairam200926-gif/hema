import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Key,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-6 pb-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Threshold Cryptography & Distributed Trust</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight">
          Secure Recovery Through <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">
            Distributed Trust.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Protect sensitive backup material by distributing recovery authority across multiple independent custodians. No single entity holds the master secret; reconstruction strictly enforces a verifiable cryptographic threshold.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/backups/new"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-glow-sm flex items-center space-x-2 transition-all"
          >
            <Key className="w-4 h-4" />
            <span>Create Backup Ceremony</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 font-semibold text-sm flex items-center space-x-2 transition-all"
          >
            <Terminal className="w-4 h-4 text-blue-600" />
            <span>Explore Security Dashboard</span>
          </Link>
          <Link
            to="/security-tests"
            className="px-6 py-3 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 font-semibold text-sm flex items-center space-x-2 transition-all"
          >
            <Shield className="w-4 h-4 text-red-400" />
            <span>Attack Simulator</span>
          </Link>
        </div>
      </section>

      {/* Visual Threshold Cryptography Schematic */}
      <section className="max-w-4xl mx-auto glass-panel p-6 sm:p-8 rounded-xl relative overflow-hidden">
        <div className="text-center mb-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-blue-600 font-semibold">
            Cryptographic Architecture Pipeline
          </h2>
          <p className="text-sm font-semibold text-gray-800">
            Shamir (k, n) Mathematical Split & Lagrange Reassembly
          </p>
        </div>

        {/* Diagram Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Node 1: Original Secret */}
          <div className="bg-vault-950 p-4 rounded-lg border border-vault-700 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-lg bg-blue-500/20 text-blue-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs font-semibold text-slate-200">1 Master Secret</div>
            <p className="text-[11px] text-slate-400">Never saved to disk or DB in plaintext</p>
          </div>

          {/* Node 2: Shamir Split */}
          <div className="bg-vault-950 p-4 rounded-lg border border-vault-700 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs font-semibold text-slate-200">5 Encrypted Shares</div>
            <p className="text-[11px] text-slate-400">AES-256-GCM + SHA-256 integrity hash</p>
          </div>

          {/* Node 3: Threshold Required */}
          <div className="bg-vault-950 p-4 rounded-lg border border-amber-500/30 text-center space-y-2 shadow-sm">
            <div className="w-10 h-10 mx-auto rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs font-semibold text-amber-300">3 of 5 Required</div>
            <p className="text-[11px] text-slate-400">2 shares reveal zero mathematical information</p>
          </div>

          {/* Node 4: Reconstructed Secret */}
          <div className="bg-vault-950 p-4 rounded-lg border border-emerald-500/30 text-center space-y-2 shadow-glow-success">
            <div className="w-10 h-10 mx-auto rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs font-semibold text-emerald-300">Secure Recovery</div>
            <p className="text-[11px] text-slate-400">Interpolation verified by digest match</p>
          </div>
        </div>

        {/* Technical Guarantee Subtext */}
        <div className="mt-6 pt-4 border-t border-vault-800 text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-6 font-mono">
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span>GF(2^8) Galois Field</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Zero Server Plaintext</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Replay & Sybil Proof</span>
          </span>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        <div className="glass-panel p-5 rounded-xl space-y-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Zero Client Trust</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All cryptographic evaluations, threshold counts, and share authentications happen on the backend server. The frontend never dictates security decisions.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl space-y-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Authenticated Share Encryption</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Shares are protected at rest via AES-256-GCM with individual CSPRNG nonces and pre-computed SHA-256 canonical integrity digests to catch tampering immediately.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl space-y-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Simulated Custodian Separation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Shares are assigned across 5 logical enterprise custodians (SOC, Cloud Enclave, Data Protection, Data Centers), executing production key-ceremony workflows.
          </p>
        </div>
      </section>
    </div>
  );
};
