'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, useTheme, alpha, type ThemeName } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-bypass';
import { CURRENT_AI_SETUP } from '@/lib/ai/model-info';

type Tab = 'appearance' | 'ai' | 'account';

export default function SettingsModal({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const router = useRouter();
  // [FRONTEND-FIRST DEV BYPASS] don't build a Supabase browser client while
  // auth is bypassed; sign-out below just navigates in dev mode.
  const supabase = DEV_BYPASS ? null : createClient();
  const [tab, setTab] = useState<Tab>('appearance');
  // [SEPYANT 2.1] Appearance tab now does what it promised: light/dark theming.
  const [theme, setTheme] = useTheme();

  // [PHASE 1] Essential modal keyboard support: Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSignOut() {
    // [FRONTEND-FIRST DEV BYPASS] there is no real session to clear — just
    // navigate back to /login (which shows the dev-mode banner).
    if (DEV_BYPASS) {
      router.push('/login');
      router.refresh();
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, maxHeight: '78vh', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '22px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.fg }}>Settings</span>
          <button onClick={onClose} aria-label="Close settings" style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
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
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.fgDim, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Theme</div>
              <div role="radiogroup" aria-label="Theme" style={{ display: 'flex', gap: 10 }}>
                {(
                  [
                    { id: 'dark' as ThemeName, label: 'Dark', hint: 'Default IDE-style palette', swatch: ['#0b0d11', '#1a1e28', '#4f6ef7'] },
                    { id: 'light' as ThemeName, label: 'Light', hint: 'Bright workspace palette', swatch: ['#f4f6fb', '#ffffff', '#4f6ef7'] },
                  ]
                ).map((opt) => {
                  const active = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(opt.id)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '12px 14px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        border: `1px solid ${active ? C.accent : C.border}`,
                        background: active ? alpha(C.accent, 9) : C.surface2,
                      }}
                    >
                      <span style={{ display: 'flex', gap: 4 }}>
                        {opt.swatch.map((s) => (
                          <span key={s} aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 5, border: `1px solid ${C.border}`, background: s }} />
                        ))}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: active ? C.fg : C.fgDim }}>{opt.label}</span>
                      <span style={{ fontSize: 11, color: C.fgMuted }}>{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: C.fgMuted, marginTop: 12, lineHeight: 1.55 }}>
                The choice is remembered per browser. The demo defaults to dark.
              </div>
            </div>
          )}
          {tab === 'ai' && (
            // [PHASE 1] Was a misleading hardcoded placeholder: a green
            // "active" dot + model string that never reflected the real
            // config. Now reads the actual routing from lib/ai/model-info.ts
            // (the same constant the orchestrator uses) and states the API
            // key requirement honestly.
            <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.fgDim, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Configured provider
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', border: `1.5px solid ${C.fgDim}`, display: 'inline-block' }} />
                <span style={{ fontSize: 13, color: C.fg, flex: 1 }}>{CURRENT_AI_SETUP.providerLabel}</span>
                <span style={{ fontSize: 11, color: C.fgMuted, fontFamily: 'var(--font-mono)' }}>{CURRENT_AI_SETUP.model}</span>
              </div>
              <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 6, lineHeight: 1.5 }}>{CURRENT_AI_SETUP.statusNote}</div>
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
                  {/* [PHASE 1] removed the fake "Free plan" chip — no plan/billing
                      system exists in Phase 1, so showing one was misleading. */}
                </div>
              </div>
              <div style={{ paddingTop: 4 }}>
                <button
                  onClick={handleSignOut}
                  style={{ fontSize: 13, padding: '7px 16px', borderRadius: 6, border: `1px solid ${alpha(C.danger, 19)}`, background: alpha(C.danger, 6), color: C.danger, cursor: 'pointer' }}
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
