// ============================================================================
// [FRONTEND-FIRST DEV BYPASS] — demo seed script for the mock store.
// Server-side only (imports node:fs via dev-store-persistence). Run manually
// with:  bun run scripts/seed-dev-store.ts   (from the sepyant/ directory)
//
// It resets the mock store, creates one curated demo project with one mock
// generation round, flips the first three cases to "approved" so the UI shows
// all three review states (approved / needs review / draft), and writes the
// snapshot to /tmp/sepyant-dev-store.json (the same file the dev server
// hydrates from). Safe to re-run at any time to reset the demo.
// ============================================================================

import fs from 'node:fs';
import {
  buildMockGeneration,
  createDevProject,
  getDevTestPlans,
  restoreDevStore,
  snapshotDevStore,
} from '../lib/dev-bypass';
import { saveDevStore } from '../lib/dev-store-persistence';

const STORE_FILE = '/tmp/sepyant-dev-store.json';

// Start from a clean slate (idempotent seeding).
restoreDevStore(JSON.stringify({ version: 1, data: { projects: [], plansByProject: {}, counter: 0 } }));

const project = createDevProject('Expense Tracker — QA Demo');

buildMockGeneration(
  project.id,
  project.name,
  'As a user, I can add an expense with an amount, category, date and an optional note. ' +
    'The app shows monthly totals per category and lets me delete or edit past expenses.'
);

// Demo variety: first three cases approved, the rest keep their generated
// review state (needs_review for cases flagged needs_verification, draft
// otherwise). Review status is derived from these flags at render time.
const plans = getDevTestPlans(project.id);
let approvedCount = 0;
for (const plan of plans) {
  for (const scenario of plan.test_scenarios) {
    for (const tc of scenario.test_cases) {
      if (approvedCount < 3 && !tc.needs_verification) {
        tc.approved = true;
        approvedCount += 1;
      }
    }
  }
}

fs.writeFileSync(STORE_FILE, snapshotDevStore());
console.log(`[dev-bypass] seeded ${STORE_FILE}: 1 project, ${plans.length} plan round(s), ${approvedCount} approved case(s)`);
console.log('[dev-bypass] (saveDevStore also called below for parity with the server code path)');
saveDevStore();
