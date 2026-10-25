import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiPost } from '../api/client';

const USERNAME_REGEX = /^[a-zA-Z0-9_.@-]{3,64}$/;

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=[\]{};:'",.<>/?\\|`~]).{10,128}$/;

interface RegisterResponse {
  message?: string;
  detail?: string | Array<{ msg?: string; message?: string }>;
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isLoading) return;

    setError('');
    setSuccess('');

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!USERNAME_REGEX.test(cleanUsername)) {
      setError(
        'Username must be 3–64 characters and contain only letters, numbers, underscores, periods, or hyphens.'
      );
      return;
    }

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setError(
        'Password must be 10–128 characters and contain uppercase, lowercase, a digit, and a special character.'
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiPost<RegisterResponse>(
        '/auth/register',
        {
          username: cleanUsername,
          email: cleanEmail,
          password,
        }
      );

      setSuccess(
        result?.message ||
          'Account created successfully! Redirecting to login...'
      );

      window.setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1200);
    } catch (caught: unknown) {
      console.error('VaultGuard registration error:', caught);

      if (caught instanceof TypeError) {
        setError(
          'Cannot connect to the backend. Check that the backend is deployed, the API URL is correct, and CORS allows this frontend.'
        );
      } else if (caught instanceof Error) {
        setError(caught.message || 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-glow-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>

          <h1 className="text-xl font-bold text-[#050C09] tracking-tight">
            Create Account
          </h1>

          <p className="text-xs text-slate-400">
            Provision a secure account protected by Argon2id password hashing.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label
              htmlFor="register-username"
              className="block text-xs font-mono text-slate-300 mb-1"
            >
              Username
            </label>

            <input
              id="register-username"
              type="text"
              name="username"
              autoComplete="username"
              inputMode="text"
              required
              minLength={3}
              maxLength={64}
              pattern="[a-zA-Z0-9_.@-]{3,64}"
              title="3–64 characters: letters, numbers, underscores, periods, or hyphens"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. jairam200926"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-mono text-slate-300 mb-1"
            >
              Email Address (For Security Alerts)
            </label>

            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-xs font-mono text-slate-300 mb-1"
            >
              Password (Min 10 characters with uppercase, lowercase, digit & symbol)
            </label>

            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a secure password"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-lg bg-vault-950 border border-vault-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60"
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
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-start space-x-2 break-words"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              aria-live="polite"
              className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-start space-x-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Account...</span>
              </>
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
          <Link
            to="/login"
            className="text-blue-400 hover:underline font-semibold"
          >
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
