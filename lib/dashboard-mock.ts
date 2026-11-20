// ============================================================================
// [DASHBOARD DEMO DATA] — static, realistic, deterministic mock dataset for
// the AI Test Quality Dashboard (/dashboard). Frontend-only by design: this
// module never touches Supabase, the dev store, or any API route, so the
// dashboard renders identically with or without the dev-bypass flag.
//
// Determinism: every "random" series comes from a seeded PRNG (mulberry32),
// so each load shows the same numbers — no flicker between the server render
// and hydration, and the dataset stays stable across refreshes.
//
// Internal consistency: KPI totals are derived from / reconciled with the
// module table and the 90-day daily series (e.g. generated-per-day sums to
// the project's total case count), so cards and charts never contradict
// each other.
// ============================================================================

export type RiskLevel = 'high' | 'medium' | 'low';

export type DashboardModule = {
  name: string;
  cases: number;
  covered: number;
  scenarios: Record<RiskLevel, number>;
};

export type DashboardGap = {
  id: string;
  severity: RiskLevel;
  module: string;
  title: string;
  description: string;
  suggestion: string;
};

export type DashboardRecommendation = {
  id: string;
  priority: RiskLevel;
  title: string;
  rationale: string;
  action: string;
  impact: string;
};

export type DailyPoint = { iso: string; label: string; coverage: number; generated: number };

export type DashboardProjectData = {
  id: string;
  name: string;
  tagline: string;
  totals: { cases: number; approved: number; pending: number; rejected: number };
  coverage: { overall: number; target: number; coveredRequirements: number; totalRequirements: number };
  scenarios: { total: number; high: number; medium: number; low: number };
  modules: DashboardModule[];
  daily: DailyPoint[]; // oldest → newest, 90 entries
  gaps: DashboardGap[];
  recommendations: DashboardRecommendation[];
};

// ---------------------------------------------------------------------------
// Deterministic series generation
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = 90;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 90 days of coverage % (trending from ~20 pts below `endCoverage` up to it,
// with a slow wave + seeded noise) and generated-cases-per-day bursts that
// sum exactly to `totalGenerated` so the KPI cards stay consistent.
function buildDaily(seed: number, endCoverage: number, totalGenerated: number): DailyPoint[] {
  const rand = mulberry32(seed);
  const start = endCoverage - 18 - Math.floor(rand() * 6);
  const today = new Date();
  const points: DailyPoint[] = [];

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1 - i));
    const t = i / (DAYS - 1);
    const wave = Math.sin(t * Math.PI * 2.4 + seed) * 2.2;
    const noise = (rand() - 0.5) * 2.6;
    const coverage = Math.max(0, Math.min(100, start + (endCoverage - start) * t + wave + noise));
    points.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      coverage: Math.round(coverage * 10) / 10,
      generated: 0,
    });
  }
  points[DAYS - 1].coverage = endCoverage;

  let sum = 0;
  for (let i = 0; i < DAYS; i++) {
    const r = rand();
    const g = r < 0.52 ? 0 : r < 0.85 ? 1 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 4);
    points[i].generated = g;
    sum += g;
  }
  let diff = totalGenerated - sum;
  for (let i = 0; diff > 0 && i < DAYS; i += 3) {
    points[i].generated += 1;
    diff -= 1;
  }
  let guard = 0;
  while (diff < 0 && guard < DAYS * 10) {
    const idx = guard % DAYS;
    if (points[idx].generated > 0) {
      points[idx].generated -= 1;
      diff += 1;
    }
    guard += 1;
  }
  return points;
}

// ---------------------------------------------------------------------------
// Project 1 — echoes the curated demo project from scripts/seed-dev-store.ts
// ---------------------------------------------------------------------------

const expenseTracker: DashboardProjectData = {
  id: 'dash-expense-tracker',
  name: 'Expense Tracker — QA Demo',
  tagline: 'Web app for tracking expenses, budgets and monthly reports',
  totals: { cases: 87, approved: 58, pending: 21, rejected: 8 },
  coverage: { overall: 72.4, target: 80, coveredRequirements: 26, totalRequirements: 36 },
  scenarios: { total: 33, high: 12, medium: 12, low: 9 },
  modules: [
    { name: 'Authentication & Sessions', cases: 16, covered: 13, scenarios: { high: 3, medium: 2, low: 1 } },
    { name: 'Expense Management', cases: 24, covered: 19, scenarios: { high: 4, medium: 3, low: 2 } },
    { name: 'Categories & Budgets', cases: 18, covered: 12, scenarios: { high: 3, medium: 2, low: 2 } },
    { name: 'Reports & Export', cases: 15, covered: 10, scenarios: { high: 1, medium: 3, low: 2 } },
    { name: 'Settings & Data Sync', cases: 14, covered: 9, scenarios: { high: 1, medium: 2, low: 2 } },
  ],
  daily: buildDaily(11, 72.4, 87),
  gaps: [
    {
      id: 'gap-et-1',
      severity: 'high',
      module: 'Expense Management',
      title: 'No negative path for deleting an expense while offline',
      description:
        'Every delete case assumes a live connection. Queued deletion and conflict handling on reconnect are untested, yet deletion is the most data-destructive flow in the app.',
      suggestion:
        'Add cases: delete offline → action queued locally → reconnect and sync; verify no duplicate or silently lost records.',
    },
    {
      id: 'gap-et-2',
      severity: 'high',
      module: 'Authentication & Sessions',
      title: 'Session expiry is only covered for the creation flow',
      description:
        'Round 3 covers session loss during expense creation, but not during export, import or budget editing — all of which hold unsaved state.',
      suggestion:
        'Extend the session-expiry scenario to export, import and budget flows; assert entered data is preserved or clearly warned about.',
    },
    {
      id: 'gap-et-3',
      severity: 'high',
      module: 'Categories & Budgets',
      title: 'Boundary values for budget limits are untested',
      description:
        'No case sets a budget to 0, the maximum allowed value, or an amount that pushes monthly totals past the limit.',
      suggestion: 'Add boundary-value cases (min, max, max+1, non-integer) for the budget amount field.',
    },
    {
      id: 'gap-et-4',
      severity: 'medium',
      module: 'Reports & Export',
      title: 'Export interrupted by navigation or refresh',
      description:
        'Coverage stops at "export completes". Behavior when the user navigates away or refreshes mid-download is unknown.',
      suggestion: 'Cover navigation/refresh during CSV and DOC export; verify file integrity or a clear failure state.',
    },
    {
      id: 'gap-et-5',
      severity: 'medium',
      module: 'Settings & Data Sync',
      title: 'Concurrent edits from two devices',
      description:
        'Two-tab concurrency exists for one flow, but multi-device sync conflicts for settings and categories are uncovered.',
      suggestion: 'Add a scenario where the same setting changes on two offline devices, then both reconnect.',
    },
    {
      id: 'gap-et-6',
      severity: 'medium',
      module: 'Categories & Budgets',
      title: 'Category deletion with linked expenses',
      description: 'No case deletes a category that still has expenses attached (cascade vs. block vs. reassign).',
      suggestion: 'Cover all three product decisions with explicit expected results so behavior is pinned.',
    },
    {
      id: 'gap-et-7',
      severity: 'low',
      module: 'Reports & Export',
      title: 'Extremely large report (10k+ expenses)',
      description: 'Performance and memory behavior for very large exports has no coverage at any scale.',
      suggestion: 'Add one smoke-scale case with a seeded 10k-row dataset; assert completion within the agreed budget.',
    },
    {
      id: 'gap-et-8',
      severity: 'low',
      module: 'Authentication & Sessions',
      title: 'Password manager / autofill interplay',
      description: 'Autofill putting unexpected values into fields (e.g. an OTP into the password box) is unobserved.',
      suggestion: 'One exploratory charter plus an automated check that autofill never auto-submits the form.',
    },
  ],
  recommendations: [
    {
      id: 'rec-et-1',
      priority: 'high',
      title: 'Close the offline-deletion gap in Expense Management',
      rationale:
        'The module carries the highest case volume (24) and 4 high-risk scenarios, yet zero cases exercise deletion without a live connection. Data loss here is the most severe possible regression.',
      action: 'Generate a negative-path round for Expense Management focused on offline queues and reconnect sync.',
      impact: '+6% project coverage · closes gap #1',
    },
    {
      id: 'rec-et-2',
      priority: 'high',
      title: 'Extend session-expiry coverage beyond creation',
      rationale:
        'Authentication & Sessions concentrates the most high-risk scenarios (3), but expiry is only tested in one flow. Every unsaved-state flow shares the same untested recovery path.',
      action: 'Generate data-driven cases reusing the existing session-expiry steps across export, import and budget editing.',
      impact: '+4% project coverage',
    },
    {
      id: 'rec-et-3',
      priority: 'medium',
      title: 'Boundary-test budget limits before the release cut',
      rationale:
        'Budget fields accept arbitrary user input with no min/max cases; overflow behavior is effectively undefined in the current suite.',
      action: 'Generate a boundary round for Categories & Budgets: 0, max, max+1, non-integer, currency rounding.',
      impact: '≈9 new cases · closes gap #3',
    },
    {
      id: 'rec-et-4',
      priority: 'medium',
      title: 'Move Reports & Export drafts through review',
      rationale:
        'The module shows the widest gap between cases written and cases verified; 5 draft cases sit unreviewed while export ships to customers.',
      action: 'Prioritize approval of the draft export cases this sprint, then schedule them into the regression pack.',
      impact: '5 drafts → reviewable',
    },
    {
      id: 'rec-et-5',
      priority: 'low',
      title: 'Add an accessibility pass to critical flows',
      rationale:
        'No case asserts keyboard-only completion of create-expense or budget flows, although the product targets WCAG AA.',
      action: 'Generate keyboard-only variants for the three highest-traffic flows.',
      impact: '3 new cases · WCAG alignment',
    },
  ],
};

// ---------------------------------------------------------------------------
// Project 2
// ---------------------------------------------------------------------------

const checkoutFlow: DashboardProjectData = {
  id: 'dash-checkout-flow',
  name: 'Checkout Flow Redesign',
  tagline: 'E-commerce checkout: cart, payments, shipping and refunds',
  totals: { cases: 64, approved: 39, pending: 18, rejected: 7 },
  coverage: { overall: 67.2, target: 80, coveredRequirements: 19, totalRequirements: 30 },
  scenarios: { total: 26, high: 11, medium: 10, low: 7 },
  modules: [
    { name: 'Cart & Pricing', cases: 14, covered: 11, scenarios: { high: 2, medium: 2, low: 1 } },
    { name: 'Payments', cases: 19, covered: 12, scenarios: { high: 4, medium: 3, low: 1 } },
    { name: 'Addresses & Shipping', cases: 12, covered: 8, scenarios: { high: 2, medium: 2, low: 1 } },
    { name: 'Order Confirmation', cases: 9, covered: 7, scenarios: { high: 1, medium: 1, low: 2 } },
    { name: 'Refunds & Cancellations', cases: 10, covered: 5, scenarios: { high: 2, medium: 2, low: 2 } },
  ],
  daily: buildDaily(29, 67.2, 64),
  gaps: [
    {
      id: 'gap-co-1',
      severity: 'high',
      module: 'Payments',
      title: '3-D Secure fallback paths are uncovered',
      description:
        'Happy-path card payments are covered, but issuer-declined 3DS challenges, abandoned challenges and timeout recovery have no cases.',
      suggestion: 'Add cases for declined 3DS, abandoned challenge, and retry after timeout; assert cart state is preserved.',
    },
    {
      id: 'gap-co-2',
      severity: 'high',
      module: 'Refunds & Cancellations',
      title: 'Partial refunds below the minimum threshold',
      description:
        'Only full refunds are covered. Partial amounts, multiple sequential refunds and refund-after-shipment are untested.',
      suggestion: 'Cover partial refund boundaries (min amount, remaining balance, over-refund attempt).',
    },
    {
      id: 'gap-co-3',
      severity: 'high',
      module: 'Payments',
      title: 'Double submission of the payment (idempotency)',
      description:
        'No case submits the pay button twice or replays the network request; duplicate charges are the highest-severity risk in the redesign.',
      suggestion: 'Add an idempotency scenario: double-click, replayed request, and back-button resubmission.',
    },
    {
      id: 'gap-co-4',
      severity: 'medium',
      module: 'Addresses & Shipping',
      title: 'Address autocomplete mismatches',
      description:
        'Coverage assumes autocomplete suggestions are accepted; edited suggestions, unrecognized streets and PO boxes are not.',
      suggestion: 'Add a validation matrix: edited suggestion, free-typed address, PO box, address without unit number.',
    },
    {
      id: 'gap-co-5',
      severity: 'medium',
      module: 'Cart & Pricing',
      title: 'Currency rounding on multi-item discounts',
      description: 'Rounding behavior when percentage discounts split across items with odd prices is undefined in the suite.',
      suggestion: 'Table-driven cases over penny-rounding: 3 items at 33% off, trailing .005 totals, zero-value items.',
    },
    {
      id: 'gap-co-6',
      severity: 'low',
      module: 'Order Confirmation',
      title: 'Guest checkout data persistence',
      description: 'No case verifies that a guest who abandons at confirmation can restore the cart on return.',
      suggestion: 'Cover cart restoration after abandonment (same browser, expired session, cleared storage).',
    },
  ],
  recommendations: [
    {
      id: 'rec-co-1',
      priority: 'high',
      title: 'Add idempotency + 3DS coverage to Payments',
      rationale:
        'Payments is the largest and riskiest module (19 cases, 4 high-risk scenarios), yet duplicate-charge and issuer-challenge paths have zero coverage.',
      action: 'Generate a dedicated Payments round: double submission, replayed requests, declined/abandoned 3DS.',
      impact: '+8% Payments coverage · closes gaps #1, #3',
    },
    {
      id: 'rec-co-2',
      priority: 'high',
      title: 'Build out the Refunds & Cancellations module',
      rationale:
        'The module has the lowest coverage in the project (50%) while handling money movement in reverse; partial refunds are entirely untested.',
      action: 'Generate boundary cases for partial refunds, sequential refunds and refund-after-shipment.',
      impact: '+5 cases · module coverage 50% → 80%',
    },
    {
      id: 'rec-co-3',
      priority: 'medium',
      title: 'Pin down currency rounding with table-driven cases',
      rationale:
        'Pricing splits discounts across items; without rounding cases, any pricing refactor can silently change cent-level totals.',
      action: 'Generate a table-driven rounding round over discount splits and trailing-half-cent totals.',
      impact: '≈7 new cases · closes gap #5',
    },
    {
      id: 'rec-co-4',
      priority: 'medium',
      title: 'Validate the address autocomplete matrix',
      rationale:
        'Autocomplete is on the critical path for every order, but only the accepted-suggestion path is covered today.',
      action: 'Generate a validation matrix: edited suggestion, free-typed address, PO box, missing unit.',
      impact: '+4 cases · closes gap #4',
    },
    {
      id: 'rec-co-5',
      priority: 'low',
      title: 'Cover guest cart restoration',
      rationale: 'Abandoned carts are a revenue recovery lever; restoration behavior after abandonment is currently unobserved.',
      action: 'Generate restoration cases across same-browser return, expired session and cleared storage.',
      impact: '3 new cases · closes gap #6',
    },
  ],
};

export const DASHBOARD_PROJECTS: DashboardProjectData[] = [expenseTracker, checkoutFlow];

export const DASHBOARD_TARGET = 80; // default coverage target line, in %
