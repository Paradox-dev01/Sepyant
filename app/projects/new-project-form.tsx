'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-bypass';

export default function NewProjectForm() {
  const router = useRouter();
  // [FRONTEND-FIRST DEV BYPASS] don't build a Supabase browser client while
  // auth is bypassed; creation goes through the dev-only API route instead.
  const supabase = DEV_BYPASS ? null : createClient();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setCreateError('');

    // [FRONTEND-FIRST DEV BYPASS] create the project in the in-memory dev
    // store (clearly mock) instead of Supabase.
    if (DEV_BYPASS) {
      try {
        const res = await fetch('/api/dev/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (res.ok && data.project?.id) {
          setName('');
          router.push(`/projects/${data.project.id}`);
          router.refresh();
        } else {
          setCreateError(data.error || 'Could not create the project.');
        }
      } catch {
        setCreateError('Network error while creating the project.');
      }
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, owner_id: user!.id })
      .select()
      .single();

    setLoading(false);
    if (!error && data) {
      setName('');
      router.push(`/projects/${data.id}`);
    } else {
      // Surface failures instead of failing silently.
      setCreateError(error?.message || 'Could not create the project.');
    }
  }

  return (
    <>
      {createError && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
          {createError}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          aria-label="New project name"
          className="flex-1 px-3 py-2 rounded bg-surface border border-border text-sm"
          style={{ minWidth: 120 }}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Create
        </button>
      </form>
    </>
  );
}
