'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';
import SettingsModal from './SettingsModal';

type ProjectSummary = { id: string; name: string };

export default function AppSidebar({
  currentProjectId,
  projects,
  userEmail,
  visible,
  onHide,
  width,
}: {
  currentProjectId: string;
  projects: ProjectSummary[];
  userEmail: string;
  visible: boolean;
  onHide: () => void;
  width: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('projects').insert({ name: newName, owner_id: user!.id }).select().single();

    setLoading(false);
    if (!error && data) {
      setNewName('');
      setCreating(false);
      router.push(`/projects/${data.id}`);
      router.refresh();
    }
  }

  if (!visible) return null;

  return (
    <div style={{ width, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      <button
        onClick={onHide}
        title="Hide sidebar"
        style={{ position: 'absolute', top: 10, right: 8, zIndex: 10, background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.fg)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.fgMuted)}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: C.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sepyant</span>
      </div>

      <div style={{ padding: '4px 10px 10px' }}>
        {creating ? (
          <form onSubmit={handleCreate}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => !newName && setCreating(false)}
              placeholder="Project name"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.accent}`, background: C.surface2, color: C.fg, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New project
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: C.fgMuted, textTransform: 'uppercase', padding: '10px 8px 4px', fontFamily: 'var(--font-mono)' }}>
          Projects
        </div>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/projects/${p.id}`)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '7px 10px',
              borderRadius: 6,
              border: 'none',
              background: currentProjectId === p.id ? C.surface2 : 'transparent',
              color: currentProjectId === p.id ? C.fg : C.fgDim,
              cursor: 'pointer',
              fontSize: 12,
              display: 'block',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
            onMouseEnter={(e) => {
              if (currentProjectId !== p.id) e.currentTarget.style.background = `${C.surface2}80`;
            }}
            onMouseLeave={(e) => {
              if (currentProjectId !== p.id) e.currentTarget.style.background = 'transparent';
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 8px' }}>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: profileOpen ? C.surface2 : 'transparent', color: C.fgDim, cursor: 'pointer', overflow: 'hidden' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => {
              if (!profileOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: C.fg, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
            </div>
          </button>
          {profileOpen && (
            <div style={{ position: 'absolute', bottom: '100%', left: 6, right: 6, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, marginBottom: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setSettingsOpen(true);
                }}
                style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 5, border: 'none', background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 12, display: 'block' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${C.border}80`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && <SettingsModal userEmail={userEmail} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
