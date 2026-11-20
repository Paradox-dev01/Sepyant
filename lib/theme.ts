'use client';

// ============================================================================
// SEPYANT design tokens.
//
// [SEPYANT 2.1] Light/dark theming: every token is a CSS custom property
// reference (defined in app/globals.css — dark on :root, light on
// [data-theme='light']). Inline styles resolve var() at paint time, so the
// whole app follows the active theme without touching the 26 files that
// consume C. The one rule: never concatenate hex onto a token (use alpha()).
//
// useTheme() persists the choice to localStorage('sepyant2.theme') and sets
// data-theme on <html>; app/layout.tsx carries a tiny no-flash script so the
// first paint already matches the stored theme.
// ============================================================================

import { useSyncExternalStore } from 'react';

export const C = {
  bg: 'var(--sep-bg)',
  sidebar: 'var(--sep-sidebar)',
  surface: 'var(--sep-surface)',
  surface2: 'var(--sep-surface2)',
  border: 'var(--sep-border)',
  muted: 'var(--sep-muted)',
  // Contrast-checked in both themes (see globals.css palette comments).
  fgMuted: 'var(--sep-fg-muted)',
  fg: 'var(--sep-fg)',
  fgDim: 'var(--sep-fg-dim)',
  accent: 'var(--sep-accent)',
  success: 'var(--sep-success)',
  warning: 'var(--sep-warning)',
  danger: 'var(--sep-danger)',
  ai: 'var(--sep-ai)',
};

/**
 * Translucent variant of a token: alpha(C.accent, 12) ≈ the old
 * hex-suffix trick (e.g. "#4f6ef718"). Works with hex values too (Avatar
 * palette), since color-mix accepts both.
 */
export function alpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// ------------------------------------------------------------------ theming

export type ThemeName = 'dark' | 'light';

const THEME_KEY = 'sepyant2.theme';

type Listener = () => void;
const themeListeners = new Set<Listener>();
let cached: ThemeName | null = null;

function readStored(): ThemeName {
  if (typeof window === 'undefined') return 'dark';
  if (cached) return cached;
  try {
    cached = window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    cached = 'dark';
  }
  return cached;
}

function subscribeTheme(cb: Listener): () => void {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

/** [theme, setTheme] — 'dark' during SSR, stored choice after hydration. */
export function useTheme(): [ThemeName, (t: ThemeName) => void] {
  const theme = useSyncExternalStore(subscribeTheme, readStored, () => 'dark' as ThemeName);
  function setTheme(t: ThemeName) {
    cached = t;
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // private mode — session-only theming
    }
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
    themeListeners.forEach((l) => l());
  }
  return [theme, setTheme];
}

/** Inline no-flash snippet for <head>: apply the stored theme before paint. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('${THEME_KEY}')==='light')document.documentElement.dataset.theme='light'}catch(e){}`;
