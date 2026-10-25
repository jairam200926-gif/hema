import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiPost } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Lock, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const cleanUsername = username.trim();
      const data = await apiPost<{ access_token: string; token_type: string }>('/auth/login', {
        username: cleanUsername,
        password,
      });
      if (data && data.access_token) {
        await login(data.access_token);
        const redirectPath = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(redirectPath, { replace: true });
      } else {
        setError('Login failed: invalid response');
      }
    } catch (err: any) {
      const msg = typeof err?.detail === 'string'
        ? err.detail
        : typeof err?.message === 'string'
        ? err.message
        : 'Login failed';
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
          <h1 className="text-xl font-bold text-[#050C09] tracking-tight">Operator Authentication</h1>
          <p className="text-xs text-slate-400">
            Sign in to access threshold recovery ceremonies and vault telemetry.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Operator Username / Email
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Password (Argon2id Hashed)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-glow-sm transition-all"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Verify Credentials & Enter</span>
              </>
            )}
          </button>
        </form>


        {error && (
          <div className="mt-2 text-sm text-red-500 flex items-center space-x-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2 border-t border-vault-800 text-center text-xs text-slate-400">
          <span>Need an account? </span>
          <Link to="/register" className="text-blue-500 hover:underline font-semibold">
            Create One Here
          </Link>
        </div>
      </div>
    </div>
  );
};
