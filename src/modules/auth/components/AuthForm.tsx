'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, signupAction } from '../actions';

export default function AuthForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isServerActionMismatch = (msg: string) => {
    if (!msg) return false;
    return (
      msg.includes('was not found on the server') ||
      msg.includes('failed-to-find-server-action') ||
      msg.includes('Server Action')
    );
  };

  const handleFallbackApi = async (formData: FormData, signup: boolean): Promise<{ success: boolean; error?: string; pendingApproval?: boolean }> => {
    try {
      const url = signup ? '/api/auth/signup' : '/api/auth/login';
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      return (await response.json()) as { success: boolean; error?: string; pendingApproval?: boolean };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    try {
      let res: { success: boolean; error?: string; pendingApproval?: boolean };

      try {
        if (isSignUp) {
          res = await signupAction(formData);
        } else {
          res = await loginAction(formData);
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (isServerActionMismatch(errMsg)) {
          console.warn('[AuthForm] Server Action mismatch detected. Using REST API fallback...');
          res = await handleFallbackApi(formData, isSignUp);
        } else {
          throw err;
        }
      }

      // If action returned a response object containing a server action error string
      if (!res.success && res.error && isServerActionMismatch(res.error)) {
        console.warn('[AuthForm] Server Action mismatch in response error. Using REST API fallback...');
        res = await handleFallbackApi(formData, isSignUp);
      }

      if (res.success) {
        if (isSignUp && res.pendingApproval) {
          setSuccessMessage(
            'Welcome aboard! Your registration is complete. We are currently setting up your workspace and will activate it shortly.'
          );
          formElement.reset();
          setIsSignUp(false);
          setLoading(false);
        } else {
          setIsLoggingIn(true);
          router.push('/dashboard');
          router.refresh();
        }
      } else {
        setError(res.error || 'Authentication failed');
        setLoading(false);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (isServerActionMismatch(errMsg)) {
        setError('Aplikasi telah diperbarui. Memuat ulang...');
        setTimeout(() => window.location.reload(), 300);
      } else {
        setError(errMsg || 'An unexpected error occurred.');
        setLoading(false);
      }
    }
  };

  return (
    <>
      {/* Full-Screen Loading Overlay when Logging In */}
      {isLoggingIn && (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-[#030303] flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-200/30 dark:border-zinc-800/30 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-zinc-200/20 dark:border-zinc-800/20 border-b-pink-500 dark:border-b-pink-400 animate-[spin_1.5s_linear_infinite_reverse]" />
          </div>
          <p className="text-[10px] font-black tracking-[0.35em] text-zinc-400 dark:text-zinc-500 uppercase text-center pl-[0.35em] select-none">
            JUST MOMENT
          </p>
        </div>
      )}

      <div className="w-full max-w-md glass-panel premium-shadow rounded-3xl p-5 sm:p-8 transition-all duration-300 border border-zinc-200/80 dark:border-zinc-800/80">
      {/* Tab Selectors */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-4 sm:mb-6">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(false);
            setError(null);
          }}
          className={`flex-1 pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all duration-300 ${
            !isSignUp
              ? 'border-purple-600 dark:border-purple-500 text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-400 dark:text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(true);
            setError(null);
          }}
          className={`flex-1 pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all duration-300 ${
            isSignUp
              ? 'border-purple-600 dark:border-purple-500 text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-400 dark:text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        {isSignUp && (
          <>
            <div>
              <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 sm:mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. John Doe"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 sm:mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                placeholder="e.g. johndoe"
                pattern="[a-zA-Z0-9_-]{3,20}"
                title="Username must be 3-20 characters long (letters, numbers, _, -)"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 sm:mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="e.g. john@kian.hq"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none transition-all duration-200"
              />
            </div>
          </>
        )}

        {!isSignUp && (
          <div>
            <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 sm:mb-2">
              Username or Email
            </label>
            <input
              type="text"
              name="identifier"
              required
              placeholder="Username or email address"
              className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none transition-all duration-200"
            />
          </div>
        )}

        <div>
          <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 sm:mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            placeholder="••••••••"
            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none transition-all duration-200"
          />
        </div>

        {error && (
          <div className="text-[11px] sm:text-xs text-red-500 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-2.5 sm:py-3">
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div className="text-[11px] sm:text-xs text-emerald-500 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-2.5 sm:py-3">
            ✓ {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 sm:py-3.5 rounded-xl transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_24px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-1 sm:mt-2 text-xs sm:text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : isSignUp ? (
            'Create Account'
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  </>
);
}
