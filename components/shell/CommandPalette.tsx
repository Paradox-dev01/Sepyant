'use client';

// ============================================================================
// [SEPYANT 2.0] Command palette (Ctrl/Cmd + K) — Phase 7 product experience.
// Custom, dependency-free modal in the SEPYANT design language. Mounted once
// inside AppSidebar, so it is available on every page (workspace included).
//
// Entries: navigation, actions, projects (from props), conversations and
// documents (from the 2.0 mock seeds). Recent selections are remembered.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';
import { useMockStore, resetAllMockData } from '@/lib/mock-store';
import { CONVERSATIONS_SEED } from '@/lib/qa-mock/conversations';
import { DOCUMENTS_SEED, DOC_TYPE_META } from '@/lib/qa-mock/documents';

type PaletteEntry = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
  href?: string;
  action?: () => void;
};

const RECENT_KEY = 'palette.recent.v1';
const MAX_RECENT = 5;

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

export default function CommandPalette({ open, onClose, projects }: { open: boolean; onClose: () => void; projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [recent, setRecent] = useMockStore<string[]>(RECENT_KEY, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state each time the palette opens; focus the input.
  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const entries: PaletteEntry[] = useMemo(() => {
    const nav: PaletteEntry[] = [
      { id: 'nav-projects', label: 'All projects', group: 'Navigate', hint: 'Workspace', href: '/projects', keywords: 'projects overview workspace' },
      { id: 'nav-conversations', label: 'Conversations', group: 'Navigate', hint: 'Workspace', href: '/conversations', keywords: 'chats threads history' },
      { id: 'nav-dashboard', label: 'Quality analytics', group: 'Navigate', hint: 'Insights', href: '/dashboard', keywords: 'dashboard quality coverage analytics test' },
      { id: 'nav-bug-reports', label: 'Bug reports', group: 'Navigate', hint: 'QA library', href: '/bug-reports', keywords: 'bugs defects issues' },
      { id: 'nav-test-plans', label: 'Test plans & cases', group: 'Navigate', hint: 'QA library', href: '/test-plans', keywords: 'testplan cases suite' },
      { id: 'nav-reports', label: 'Reports & documentation', group: 'Navigate', hint: 'QA library', href: '/reports', keywords: 'execution summary docs regression' },
      { id: 'nav-automation', label: 'Automation & script generator', group: 'Navigate', hint: 'Tools', href: '/automation', keywords: 'playwright selenium appium cypress postman scripts' },
      { id: 'nav-team', label: 'Team collaboration', group: 'Navigate', hint: 'Team', href: '/team', keywords: 'members roles invite activity' },
    ];
    const actions: PaletteEntry[] = [
      { id: 'act-new-conversation', label: 'New conversation', group: 'Actions', hint: 'Demo', href: '/conversations?new=1', keywords: 'create chat start' },
      {
        id: 'act-reset-demo',
        label: 'Reset 2.0 demo data',
        group: 'Actions',
        hint: 'Clears localStorage mock state',
        keywords: 'reset clear wipe restore seed demo',
        action: () => resetAllMockData(),
      },
    ];
    const projEntries: PaletteEntry[] = projects.map((p) => ({
      id: `proj-${p.id}`,
      label: p.name,
      group: 'Projects',
      hint: 'Open workspace',
      href: `/projects/${p.id}`,
      keywords: 'project workspace open',
    }));
    const convEntries: PaletteEntry[] = CONVERSATIONS_SEED.filter((c) => !c.archived).map((c) => ({
      id: `conv-${c.id}`,
      label: c.title,
      group: 'Conversations',
      hint: c.projectName,
      href: `/conversations/${c.id}`,
      keywords: `${c.category} ${c.projectName} chat conversation`,
    }));
    return [...nav, ...actions, ...projEntries, ...convEntries];
  }, [projects]);

  // Documents come straight from the 2.0 mock seed (frontend-only data).
  const docEntries: PaletteEntry[] = useMemo(() => {
    return DOCUMENTS_SEED.map((d) => ({
      id: `doc-${d.id}`,
      label: d.title,
      group: 'Documents',
      hint: DOC_TYPE_META[d.type].label,
      href: `/documents/${d.id}`,
      keywords: `${DOC_TYPE_META[d.type].label} ${d.project} document`,
    }));
  }, []);

  const filtered = useMemo(() => {
    const all = [...entries, ...docEntries];
    const q = query.trim().toLowerCase();
    let result = all;
    if (q) {
      result = all.filter((e) => `${e.label} ${e.keywords || ''} ${e.group}`.toLowerCase().includes(q));
    } else {
      // No query: show recents first (deduplicated), then the rest.
      const recentSet = new Set(recent);
      const recentEntries = recent.map((id) => all.find((e) => e.id === id)).filter((e): e is PaletteEntry => Boolean(e));
      const rest = all.filter((e) => !recentSet.has(e.id));
      result = [...recentEntries, ...rest];
    }
    return result.slice(0, 24);
  }, [entries, docEntries, query, recent]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const execute = useCallback(
    (entry: PaletteEntry | undefined) => {
      if (!entry) return;
      if (entry.href) router.push(entry.href);
      if (entry.action) entry.action();
      // Remember recent navigations (not ephemeral actions).
      if (entry.href) {
        setRecent((prev) => [entry.id, ...prev.filter((id) => id !== entry.id)].slice(0, MAX_RECENT));
      }
      onClose();
    },
    [router, setRecent, onClose]
  );

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(filtered[index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Group headers in display order.
  let lastGroup = '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(5,6,9,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}
    >
      <div style={{ width: '100%', maxWidth: 560, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 28px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ stroke: C.fgMuted, flexShrink: 0 }} strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, projects, conversations, documents…"
            aria-label="Command palette search"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.fg, fontSize: 14 }}
          />
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C.fgMuted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', background: C.surface2 }}>ESC</kbd>
        </div>

        <div ref={listRef} role="listbox" aria-label="Results" style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '26px 14px', textAlign: 'center', color: C.fgMuted, fontSize: 12.5 }}>No matches for “{query}”.</div>
          )}
          {filtered.map((entry, i) => {
            const showGroup = entry.group !== lastGroup;
            lastGroup = entry.group;
            const selected = i === index;
            return (
              <div key={entry.id}>
                {showGroup && (
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.fgMuted, padding: '10px 10px 4px', fontFamily: 'var(--font-mono)' }}>
                    {entry.group}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => execute(entry)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 7,
                    background: selected ? C.surface2 : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 13, color: selected ? C.fg : C.fgDim, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{entry.label}</span>
                  {entry.hint && <span style={{ fontSize: 10.5, color: C.fgMuted, flexShrink: 0 }}>{entry.hint}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 14px', borderTop: `1px solid ${C.border}`, color: C.fgMuted, fontSize: 10.5 }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{isMac() ? '⌘K' : 'Ctrl K'}</span>
        </div>
      </div>
    </div>
  );
}
