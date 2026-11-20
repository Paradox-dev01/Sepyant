'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-bypass';

export default function SignupPage() {
  // [FRONTEND-FIRST DEV BYPASS] don't build a Supabase browser client while
  // auth is bypassed (it would throw without real env vars, including during
  // SSR). Every use below is guarded; the original flow is untouched.
  const supabase = DEV_BYPASS ? null : createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // [FRONTEND-FIRST DEV BYPASS] auth is disabled — explain instead of calling Supabase.
    if (!supabase) {
      setError('Dev mode: authentication is bypassed. Use “Enter the app (dev)” above.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
    if (!supabase) return; // [FRONTEND-FIRST DEV BYPASS] no Supabase client in dev mode
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4 bg-gradient-to-b from-background to-[var(--sep-bg)]">
        <div className="max-w-sm bg-surface border border-border rounded-xl p-7 shadow-2xl shadow-black/20 dark:shadow-black/40">
          <p className="mb-1 font-medium">Check your inbox</p>
          <p className="text-muted text-sm mb-5">
            We sent a confirmation link to <span className="text-white">{email}</span>. Click it to activate your account.
          </p>
          <Link href="/login" className="text-primary text-sm hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-[var(--sep-bg)] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface border border-border rounded-xl p-7 shadow-2xl shadow-black/20 dark:shadow-black/40"
      >
        <div className="mb-6">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center mb-3">
            <span className="text-primary text-sm font-bold">Q</span>
          </div>
          <h1 className="text-xl font-semibold">Join Sepyant</h1>
          <p className="text-muted text-sm mt-1">Start generating tests with AI</p>
        </div>

        {DEV_BYPASS && (
          <div className="mb-5 text-xs bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2.5 text-yellow-400 leading-relaxed">
            Frontend-first dev mode — authentication is bypassed and data is mock.{' '}
            <Link href="/projects" className="underline underline-offset-2 hover:text-yellow-300">
              Enter the app (dev) →
            </Link>
          </div>
        )}

        {error && (
          <p className="text-danger text-sm mb-4 bg-danger/10 border border-danger/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <label htmlFor="signup-email" className="text-xs text-muted mb-1.5 block">Email</label>
        <input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-3 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <label htmlFor="signup-password" className="text-xs text-muted mb-1.5 block">Password</label>
        <input
          id="signup-password"
          type="password"
          placeholder="Min 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full mb-5 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating...' : 'Sign up'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted text-xs">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium hover:bg-background transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-muted text-sm mt-5 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
