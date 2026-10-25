import React from 'react';
import { BookOpen, Cpu, Shield } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 font-mono text-xs border border-blue-500/20">
          <BookOpen className="w-3.5 h-3.5" />
          <span>VaultGuard Cryptographic Specification</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
          Applied Cryptography & Network Security
        </h1>
        <p className="text-sm text-slate-400">
          Threshold-Cryptography Key Escrow & Distributed Recovery System
        </p>
      </div>

      {/* Mathematical Foundations Section */}
      <div className="glass-panel p-6 rounded-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <span>1. Shamir's Secret Sharing Mathematical Formulation</span>
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed">
          In 1979, Adi Shamir published <em>"How to Share a Secret"</em> in the Communications of the ACM, introducing a $(k, n)$ threshold scheme based on polynomial interpolation over finite fields.
        </p>

        {/* Polynomial Math Card */}
        <div className="p-4 rounded-lg bg-vault-950 border border-vault-800 space-y-3 font-mono text-xs">
          <div className="text-blue-400 font-semibold">// 1. Polynomial Construction (Degree k - 1):</div>
          <div className="p-2.5 rounded bg-vault-900 text-slate-200 overflow-x-auto">
            f(x) = a₀ + a₁x + a₂x² + ... + a_(k-1)x^(k-1)  (mod p)
          </div>
          <p className="text-[11px] text-slate-400 font-sans">
            Where <code className="text-emerald-400">a₀ = Secret</code> constitutes the constant term (the secret evaluated at $x = 0$), and coefficients <code className="text-slate-300">a₁ ... a_(k-1)</code> are selected uniformly at random using a cryptographically secure random number generator (CSPRNG).
          </p>

          <div className="text-indigo-400 font-semibold pt-2">// 2. Share Generation:</div>
          <p className="text-[11px] text-slate-400 font-sans">
            For $n$ custodians, distinct non-zero coordinates are evaluated:
          </p>
          <div className="p-2.5 rounded bg-vault-900 text-slate-200 overflow-x-auto">
            {"Share_i = (x_i, f(x_i))   for i ∈ {1, 2, ..., n}"}
          </div>

          <div className="text-emerald-400 font-semibold pt-2">// 3. Lagrange Polynomial Reconstruction at x = 0:</div>
          <div className="p-2.5 rounded bg-vault-900 text-slate-200 overflow-x-auto">
            f(0) = ∑ [ y_j · ∏ (-x_m) / (x_j - x_m) ]   (mod p)
          </div>
          <p className="text-[11px] text-slate-400 font-sans">
            Where division is computed via modular multiplicative inverse over finite Galois Field GF(2^8) or prime field F_p. Floating point arithmetic is strictly forbidden.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300">
          <strong>Information-Theoretic Security:</strong> Any coalition of fewer than $k$ shares reveals exactly zero Shannon information regarding $a_0$. For any candidate secret $S'$, there exists a unique polynomial passing through the $k-1$ shares and $(0, S')$ with identical probability.
        </div>
      </div>

      {/* Cryptographic Boundary & Anti-Theater Matrix */}
      <div className="glass-panel p-6 rounded-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>2. Cryptographic Separation & Anti-Theater Guarantees</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-slate-400 font-mono border-b border-vault-800">
              <tr>
                <th className="py-2.5 px-3">Cryptographic Primitive</th>
                <th className="py-2.5 px-3">Actual Security Guarantee</th>
                <th className="py-2.5 px-3">What It Does NOT Provide (Anti-Theater)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800 text-slate-300">
              <tr>
                <td className="py-3 px-3 font-mono font-bold text-blue-400">Shamir SSS</td>
                <td className="py-3 px-3">Threshold information splitting and distributed recovery.</td>
                <td className="py-3 px-3 text-slate-400">Not encryption; does not protect against a coalition of $k$ custodians.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-mono font-bold text-emerald-400">AES-256-GCM</td>
                <td className="py-3 px-3">Confidentiality & ciphertext authenticity for shares at rest.</td>
                <td className="py-3 px-3 text-slate-400">Does not protect against backend OS memory inspection during decryption.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-mono font-bold text-amber-400">SHA-256</td>
                <td className="py-3 px-3">Canonical share integrity checking & secret verification.</td>
                <td className="py-3 px-3 text-slate-400">Does not provide confidentiality; not used directly for password hashing.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-mono font-bold text-purple-400">Argon2id</td>
                <td className="py-3 px-3">Memory-hard password hashing (RFC 9106) resistant to GPUs.</td>
                <td className="py-3 px-3 text-slate-400">Does not prevent credential stuffing if users choose trivial passwords.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};
