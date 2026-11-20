'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';

type Tab = 'appearance' | 'ai' | 'account';

export default function SettingsModal({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('appearance');

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, maxHeight: '78vh', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '22px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.fg }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ display: 'flex', padding: '14px 28px 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0, gap: 0 }}>
          {(['appearance', 'ai', 'account'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 16px',
                fontSize: 13,
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
                color: tab === t ? C.fg : C.fgMuted,
                cursor: 'pointer',
                marginBottom: -1,
                textTransform: 'capitalize',
              }}
            >
              {t === 'ai' ? 'AI & Models' : t}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {tab === 'appearance' && (
            <div style={{ fontSize: 13, color: C.fgDim, lineHeight: 1.6 }}>
              Dark theme only for now — light/system themes are a v2 item.
            </div>
          )}
          {tab === 'ai' && (
            <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.fgDim, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Active provider
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.success, display: 'inline-block' }} />
                <span style={{ fontSize: 13, color: C.fg, flex: 1 }}>OpenRouter (free tier)</span>
                <span style={{ fontSize: 11, color: C.fgMuted, fontFamily: 'var(--font-mono)' }}>llama-3.3-70b</span>
              </div>
              <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 6, lineHeight: 1.5 }}>
                Set in lib/ai/orchestrator.ts. Switch to Claude/GPT at final release by uncommenting the provider there.
              </div>
            </div>
          )}
          {tab === 'account' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>{userEmail}</div>
                  <div style={{ fontSize: 12, color: C.fgMuted }}>Free plan</div>
                </div>
              </div>
              <div style={{ paddingTop: 4 }}>
                <button
                  onClick={handleSignOut}
                  style={{ fontSize: 13, padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.danger}30`, background: `${C.danger}10`, color: C.danger, cursor: 'pointer' }}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '14px 28px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: 13, padding: '7px 18px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
