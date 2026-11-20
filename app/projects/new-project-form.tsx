'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewProjectForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

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
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New project name"
        className="flex-1 px-3 py-2 rounded bg-surface border border-border text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-primary text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        Create
      </button>
    </form>
  );
}
