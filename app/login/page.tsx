'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNeedsConfirmation(false);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Supabase returns this specific message when the account exists but
      // the email hasn't been confirmed yet - show a helpful action instead
      // of a generic error.
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true);
      } else if (error.message.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email or password.');
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.push('/projects');
    router.refresh();
  }

  async function handleResendConfirmation() {
    setResendStatus('sending');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendStatus(error ? 'idle' : 'sent');
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-[#0e1016] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface border border-border rounded-xl p-7 shadow-2xl shadow-black/40"
      >
        <div className="mb-6">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center mb-3">
            <span className="text-primary text-sm font-bold">Q</span>
          </div>
          <h1 className="text-xl font-semibold">Welcome to Sepyant</h1>
          <p className="text-muted text-sm mt-1">Log in to your AI QA workspace</p>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {needsConfirmation && (
          <div className="text-sm mb-4 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-3">
            <p className="text-yellow-400">Your email isn't confirmed yet.</p>
            {resendStatus === 'sent' ? (
              <p className="text-muted mt-1">Confirmation email sent — check your inbox.</p>
            ) : (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendStatus === 'sending'}
                className="mt-2 text-primary underline underline-offset-2"
              >
                {resendStatus === 'sending' ? 'Sending...' : 'Resend confirmation email'}
              </button>
            )}
          </div>
        )}

        <label className="text-xs text-muted mb-1.5 block">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-3 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <label className="text-xs text-muted mb-1.5 block">Password</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-5 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted text-xs">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
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
          No account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
