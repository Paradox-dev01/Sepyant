'use client';

// ============================================================================
// [SEPYANT 2.0] Client-side mock store — tiny localStorage-backed state layer
// for the frontend-only 2.0 features (conversations, documents, automation,
// team, notifications, command palette).
//
// Design rules:
//  - FRONTEND ONLY. No API routes, no Supabase, no server state. All 2.0
//    mock interactions persist to localStorage under the "sepyant2." prefix
//    so demo edits survive browser refreshes without touching the backend
//    or the server-side dev store used by the original workspace.
//  - Versioned keys ("…v1"): bump the suffix when a seed shape changes so
//    stale stored data is ignored and the fresh seed is used instead.
//  - SSR-safe: during hydration useSyncExternalStore serves the seed; the
//    persisted value takes over right after hydration.
// ============================================================================

import { useCallback, useSyncExternalStore } from 'react';

const PREFIX = 'sepyant2.';

type Listener = () => void;
type Entry = { value: unknown; loaded: boolean; listeners: Set<Listener> };

const entries = new Map<string, Entry>();

function getEntry(key: string): Entry {
  let e = entries.get(key);
  if (!e) {
    e = { value: undefined, loaded: false, listeners: new Set() };
    entries.set(key, e);
  }
  return e;
}

function load<T>(key: string, seed: T): T {
  const e = getEntry(key);
  if (e.loaded) return e.value as T;
  e.loaded = true;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      e.value = raw != null ? (JSON.parse(raw) as T) : seed;
    } catch {
      e.value = seed;
    }
  } else {
    e.value = seed;
  }
  return e.value as T;
}

function persist<T>(key: string, value: T) {
  const e = getEntry(key);
  e.value = value;
  e.loaded = true;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // Storage may be unavailable (private mode) — degrade silently: the
    // mock interaction still works for the current session.
  }
  e.listeners.forEach((l) => l());
}

/** React hook bound to one mock-store key. `[value, setValue]`. */
export function useMockStore<T>(key: string, seed: T): [T, (update: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (cb: Listener) => {
      const e = getEntry(key);
      e.listeners.add(cb);
      return () => {
        e.listeners.delete(cb);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(() => load(key, seed), [key, seed]);
  const getServerSnapshot = useCallback(() => seed, [seed]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (update: T | ((prev: T) => T)) => {
      const prev = load(key, seed);
      const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
      persist(key, next);
    },
    [key, seed]
  );

  return [value, set];
}

/** One-off read (non-reactive). */
export function readMock<T>(key: string, seed: T): T {
  return load(key, seed);
}

/** Reset one key back to its seed. */
export function resetMockKey(key: string, seed: unknown) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  }
  persist(key, seed);
}

/** Wipe every SEPYANT 2.0 mock key and reload — used by the palette command. */
export function resetAllMockData() {
  if (typeof window === 'undefined') return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
  window.location.reload();
}

// ---------------------------------------------------------------------------
// Small pure helpers shared by the 2.0 surfaces
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic "12 Oct 2025" formatting (no locale drift between SSR/CSR). */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Deterministic "12 Oct 2025, 14:05". */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(iso)}, ${hh}:${mm}`;
}

/** Human "3h ago" style relative time at hour granularity (SSR-stable). */
export function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

/** Short unique id for mock records. */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Trigger a client-side file download (used by document/script export). */
export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Clipboard helper with a boolean success result. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    await window.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
