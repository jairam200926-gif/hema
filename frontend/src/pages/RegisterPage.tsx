import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiPost } from '../api/client';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]).{10,128}$/;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!USERNAME_REGEX.test(cleanUsername)) {
      setError('Username must be 3–64 characters and contain only letters, numbers, underscores, or hyphens.');
      setIsLoading(false);
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setError('Password must be 10–128 characters and contain uppercase, lowercase, a digit, and a special character.');
      setIsLoading(false);
      return;
    }

    try {
      await apiPost('/auth/register', {
        username: cleanUsername,
        email: cleanEmail,
        password,
      });
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (err: any) {
      const msg = typeof err?.detail === 'string'
        ? err.detail
        : typeof err?.message === 'string'
        ? err.message
        : 'Registration failed. Please verify credentials.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-glow-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#050C09] tracking-tight">Create Account</h1>
          <p className="text-xs text-slate-400">
            Provision a secure account protected by Argon2id password hashing.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={64}
              pattern="^[a-zA-Z0-9_-]+$"
              title="3–64 characters (letters, numbers, underscores, hyphens)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. security_lead"
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Email Address (For Security Alerts)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Password (Min 10 characters with uppercase, lowercase, digit & symbol)
            </label>
            <input
              type="password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Must include uppercase, lowercase, a number, and a special character.
            </p>
            <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-emerald-600 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>Argon2id memory-hard protection (RFC 9106)</span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-glow-sm transition-all"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Register Account</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-vault-800 text-center text-xs text-slate-400">
          <span>Already registered? </span>
          <Link to="/login" className="text-blue-400 hover:underline font-semibold">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
