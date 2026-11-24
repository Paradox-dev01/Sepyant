// ============================================================================
// [FRONTEND-FIRST DEV BYPASS] — server-only persistence for the in-memory dev
// mock store (lib/dev-bypass.ts). Active only while DEV_BYPASS is on: every
// caller guards with `if (DEV_BYPASS)`.
//
// Purpose: the dev store lives on globalThis, so mock data already survives
// browser refreshes and hot reloads, but it used to reset when the dev server
// process restarted. This module snapshots the store to /tmp/sepyant-dev-store.json
// after every mutation and restores it on first server access, so a crafted
// demo scenario survives dev-server restarts too. The file lives in /tmp
// (never committed, never contains real user data — mock rows only).
//
// Safety: this module must ONLY be imported from server files (route handlers,
// server components) because it imports node:fs. lib/dev-bypass.ts itself
// stays free of node imports and remains safe for client bundles. In
// production the DEV_BYPASS flag is impossible (NODE_ENV check in
// dev-bypass.ts), so none of this code ever runs there.
// ============================================================================

import fs from 'node:fs';
import { restoreDevStore, snapshotDevStore } from './dev-bypass';

const STORE_FILE = '/tmp/sepyant-dev-store.json';

const globalRef = globalThis as unknown as { __sepyantDevStoreLoaded?: boolean };

// Restore the store from disk exactly once per server process. Later calls
// are no-ops, so every server entry point can call it defensively.
export function loadDevStoreOnce(): void {
  if (globalRef.__sepyantDevStoreLoaded) return;
  globalRef.__sepyantDevStoreLoaded = true;
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    if (restoreDevStore(raw)) {
      console.info(`[dev-bypass] restored mock store from ${STORE_FILE}`);
    }
  } catch {
    // Mock data only — any IO/parse problem just means a fresh empty store.
  }
}

// Persist after mutations. Best-effort: failures are swallowed because the
// in-memory store keeps working (a restart would then simply start empty).
export function saveDevStore(): void {
  try {
    fs.writeFileSync(STORE_FILE, snapshotDevStore());
  } catch {
    // ignore — dev convenience only
  }
}
