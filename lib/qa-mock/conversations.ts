// ============================================================================
// [SEPYANT 2.0] Conversations seed data (Phase 2 — conversation & project
// management). Pure frontend mock data: no backend calls anywhere.
//
// A conversation lives inside a project, has a category (Bug Reports, Test
// Plans, Test Cases, Documentation, Regression Testing) and a message thread
// with the assistant. All mutations (pin/archive/rename/delete/replies) are
// persisted client-side via lib/mock-store.ts.
// ============================================================================

import { C } from '@/lib/theme';

export const CONVERSATIONS_KEY = 'conversations.v1';

export const CATEGORIES = ['Bug Reports', 'Test Plans', 'Test Cases', 'Documentation', 'Regression Testing'] as const;
export type Category = (typeof CATEGORIES)[number];

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string; // ISO
  meta?: string; // e.g. "Generated 12 test cases"
  // [SEPYANT 2.1] context that travelled with this message (names only —
  // demo keeps files/URLs locally and never analyses their contents).
  attachments?: { name: string; kind: 'file' | 'url' }[];
  resourceNames?: string[]; // reused project resources (display names)
};

export type Conversation = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  category: Category;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

// ------------------------------------------------------------- projects
export type MockProject = { id: string; name: string; blurb: string };

export const CONVERSATION_PROJECTS: MockProject[] = [
  { id: 'proj-ecommerce', name: 'E-commerce Website', blurb: 'Storefront, checkout, payments and order management.' },
  { id: 'proj-banking', name: 'Banking App — Mobile', blurb: 'iOS/Android onboarding, transfers and card controls.' },
  { id: 'proj-expense', name: 'Expense Tracker', blurb: 'Receipt scanning, budgets and monthly reporting.' },
];

// ------------------------------------------------------------ messages
const m = (id: string, role: 'user' | 'assistant', content: string, hours: number, meta?: string): ChatMessage => ({
  id,
  role,
  content,
  at: hoursAgo(hours),
  meta,
});

// ----------------------------------------------------------- seed data
export const CONVERSATIONS_SEED: Conversation[] = [
  // ---------------------------------------------------- E-commerce Website
  {
    id: 'conv-login-bug',
    projectId: 'proj-ecommerce',
    projectName: 'E-commerce Website',
    title: 'Login Bug Report',
    category: 'Bug Reports',
    pinned: true,
    archived: false,
    createdAt: hoursAgo(76),
    updatedAt: hoursAgo(2),
    messages: [
      m('m1', 'user', 'Users with 2FA enabled get stuck on the login screen after entering the OTP. The spinner keeps spinning and eventually the page goes blank. Happens on Chrome 121 and Safari 17, roughly 1 in 5 attempts. Can you structure this as a bug report?', 76),
      m('m2', 'assistant', 'Here is a structured draft for your bug report:\n\n**Title:** Login hangs and blanks out after OTP entry for 2FA users (intermittent)\n\n**Severity:** High · **Priority:** P1\n\n**Steps to reproduce:**\n1. Open /login on Chrome 121 or Safari 17\n2. Sign in with an account that has 2FA enabled\n3. Enter the valid OTP within 30 seconds\n4. Observe the loading spinner\n\n**Expected result:** User lands on the account dashboard within 3 seconds.\n**Actual result:** Spinner persists for ~45s, then the page renders blank (console: unhandled promise rejection on /api/session/verify).', 75.8, 'Drafted BUG-104'),
      m('m3', 'user', 'Good. Add the environment details and note that the failing call returns 502 from the gateway about half the time.', 3),
      m('m4', 'assistant', 'Updated. **Environment:** staging (build 2.14.1), Chrome 121 / Safari 17, macOS 14. **Network note:** the intermittent factor correlates with POST /api/session/verify returning 502 from the API gateway in ~50% of observed failures — likely a timeout between the gateway and the auth service, not the OTP validation itself.\n\nI saved this as BUG-104 in Bug Reports so the team can comment and triage it.', 2.6, 'Saved to Bug Reports'),
    ],
  },
  {
    id: 'conv-payment-plan',
    projectId: 'proj-ecommerce',
    projectName: 'E-commerce Website',
    title: 'Payment Test Plan',
    category: 'Test Plans',
    pinned: false,
    archived: false,
    createdAt: hoursAgo(60),
    updatedAt: hoursAgo(6),
    messages: [
      m('m5', 'user', 'We need a test plan for the payments rework: card, wallet and bank-transfer flows, plus the new 3-D Secure step. Sprint is 2 weeks, 3 testers.', 60),
      m('m6', 'assistant', '**Scope & objectives**\n- Validate card, wallet and bank-transfer payments end to end, including the new 3-D Secure challenge step.\n- Confirm refund and partial-refund paths for each method.\n\n**Strategy**\n- Sprint 1 week 1: happy paths per method on staging, test cards from the sandbox matrix.\n- Sprint 1 week 2: negative paths (declines, timeouts, 3-DS abandonment), refunds, reconciliation.\n\n**Resources:** 3 QA (2 web, 1 API), sandbox gateway access, seed data set v9.\n\n**Risks:** sandbox 3-DS rate limits; bank-transfer settlement delays make same-day verification impossible — plan a mock settlement endpoint.\n\n**Entry criteria:** builds deploy to staging via CI green; **Exit criteria:** 100% of P0/P1 cases executed, 0 open critical bugs.', 59.5, 'Outline ready'),
      m('m7', 'user', 'Add the wallet expiry edge case and turn this into the formal plan document.', 6),
      m('m8', 'assistant', 'Added "Wallet token expires mid-payment → graceful restart of the payment, cart preserved" to the negative-path set.\n\nThe formal document is saved as **Payment & Checkout Test Plan** (v3) under Test Plans — 42 cases, entry/exit criteria included, ready for review.', 5.8, 'Saved to Test Plans'),
    ],
  },
  {
    id: 'conv-checkout-cases',
    projectId: 'proj-ecommerce',
    projectName: 'E-commerce Website',
    title: 'Checkout Test Cases',
    category: 'Test Cases',
    pinned: false,
    archived: false,
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(10),
    messages: [
      m('m9', 'user', 'Generate test cases for the guest checkout flow. Cover: empty cart guard, address autofill, shipping method switch, promo code edge cases and the order summary totals.', 48),
      m('m10', 'assistant', 'Generated **12 test cases** for guest checkout:\n\n- TC-201 Empty cart → checkout guarded with "Your cart is empty" state\n- TC-202 Address autofill accepts valid street/city/postal combinations\n- TC-203 Switching shipping method recalculates totals and ETA instantly\n- TC-204 Valid promo code applies discount once (idempotent on re-apply)\n- TC-205 Expired promo code shows actionable error, cart preserved\n- TC-206 Case-sensitive promo code handled without duplicate discounts\n- TC-207 Order summary matches line items + shipping + tax to the cent\n- TC-208 Browser back after payment auth does not double-charge\n- TC-209 Session timeout at payment step recovers cart contents\n- TC-210 Invalid postal format blocks progress with field-level error\n- TC-211 Multi-currency display consistent across summary and confirmation\n- TC-212 Order confirmation email/lock icon shown after success\n\nEach case has preconditions, numbered steps, expected results and priority. Review them in Test Plans & Cases when ready.', 47.4, 'Generated 12 test cases'),
      m('m11', 'user', 'TC-208 is the critical one. Add the exact expected network behaviour.', 10),
      m('m12', 'assistant', 'TC-208 updated — **Expected:** exactly one POST /api/orders charge request; a second submit while the first is in-flight is blocked client-side; after back-navigation the order state is "processing" and re-payment is prevented by the idempotency key. The case is marked **Critical** priority.', 9.7, 'Updated TC-208'),
    ],
  },
  {
    id: 'conv-regression',
    projectId: 'proj-ecommerce',
    projectName: 'E-commerce Website',
    title: 'Regression Testing',
    category: 'Regression Testing',
    pinned: false,
    archived: false,
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(30),
    messages: [
      m('m13', 'user', 'Release 2.14 touches the payment service and the order API. Build me a regression scope — what should we re-run?', 30),
      m('m14', 'assistant', '**Impact analysis — Release 2.14**\n\nChanged areas: payment service (3-DS step), order API (idempotency keys).\n\n**Suggested regression scope (18 cases):**\n- Full checkout suite TC-201…212 (order API touched)\n- Payment happy paths for card/wallet/transfer\n- Refund + partial refund\n- Order history display and status transitions\n- Webhook-driven fulfilment smoke\n\n**Safe to skip:** marketing pages, search, reviews (no dependency changes).\n\nThe full breakdown is saved as the regression report **Release 2.14 impact analysis**.', 29.8, 'Saved regression report'),
    ],
  },
  {
    id: 'conv-api-doc',
    projectId: 'proj-ecommerce',
    projectName: 'E-commerce Website',
    title: 'API Documentation',
    category: 'Documentation',
    pinned: false,
    archived: false,
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(20),
    messages: [
      m('m15', 'user', 'Summarise the Orders API v2 endpoints our QA team needs: create order, get order, cancel, refund. Include auth and rate limits.', 26),
      m('m16', 'assistant', '**Orders API v2 — QA summary**\n\n- `POST /v2/orders` — creates an order from a cart; requires `Idempotency-Key`; 429 on >120 req/min.\n- `GET /v2/orders/{id}` — full order state machine (pending → paid → fulfilled → closed).\n- `POST /v2/orders/{id}/cancel` — allowed while `pending`; 409 once paid.\n- `POST /v2/orders/{id}/refund` — full or partial; partial sums must not exceed paid amount (422).\n\n**Auth:** bearer token, scope `orders:write` for mutations. **Rate limits:** 120 req/min per token, `Retry-After` on 429.\n\nSaved as **API Documentation — Orders v2** in Reports & Documentation.', 25.6, 'Saved documentation'),
    ],
  },

  // -------------------------------------------------- Banking App — Mobile
  {
    id: 'conv-onboarding',
    projectId: 'proj-banking',
    projectName: 'Banking App — Mobile',
    title: 'Onboarding Test Cases',
    category: 'Test Cases',
    pinned: true,
    archived: false,
    createdAt: hoursAgo(54),
    updatedAt: hoursAgo(4),
    messages: [
      m('m17', 'user', 'New KYC onboarding flow for the mobile app. Generate cases for document capture, liveness check and the fallback branch when liveness fails twice.', 54),
      m('m18', 'assistant', 'Generated **9 test cases** for mobile KYC onboarding:\n\n- TC-301 Document capture auto-detects passport/ID edges in good light\n- TC-302 Glare rejection prompts retake without losing session\n- TC-303 Liveness check passes with natural head turn\n- TC-304 Liveness rejects static photo replay\n- TC-305 First liveness failure → one retry offered, documents retained\n- TC-306 Second failure → manual review queue + status screen\n- TC-307 App backgrounded mid-capture resumes to the same step\n- TC-308 Network drop during upload retries with exponential backoff\n- TC-309 Completed onboarding lands on the home screen with the account visible\n\nPriority and preconditions filled in; ready for review.', 53.4, 'Generated 9 test cases'),
      m('m19', 'user', 'TC-307 is flaky on Android — note the specific resume behaviour we expect.', 4),
      m('m20', 'assistant', 'TC-307 updated with the Android-specific expectation: on resume the capture screen restores its state from the view-model within 2s, the camera preview re-initialises, and previously captured document images are **not** re-uploaded (deduplicated by upload token).', 3.9, 'Updated TC-307'),
    ],
  },
  {
    id: 'conv-transfer-bug',
    projectId: 'proj-banking',
    projectName: 'Banking App — Mobile',
    title: 'Transfer Failure Bug Reports',
    category: 'Bug Reports',
    pinned: false,
    archived: false,
    createdAt: hoursAgo(44),
    updatedAt: hoursAgo(40),
    messages: [
      m('m21', 'user', 'Inter-account transfers over 10,000 fail silently on Android 14 — no error, the button just does nothing. iOS works. Draft the bug.', 44),
      m('m22', 'assistant', '**Title:** Transfers > 10,000 fail silently on Android 14 (no user feedback)\n\n**Severity:** High · **Priority:** P1\n\n**Steps to reproduce:**\n1. On Android 14, open Transfers\n2. Select two accounts of the same user\n3. Enter an amount above 10,000 and confirm\n\n**Expected:** validation message or a success/failure screen.\n**Actual:** button press is swallowed; no network call fires (logcat shows a crash in the amount formatter caught by a broad try/catch).\n\n**Environment:** Android 14, app 5.2.0; iOS 17 unaffected.', 43.6, 'Drafted BUG-211'),
    ],
  },
  {
    id: 'conv-bank-plan',
    projectId: 'proj-banking',
    projectName: 'Banking App — Mobile',
    title: 'Card Controls Test Plan',
    category: 'Test Plans',
    pinned: false,
    archived: true,
    createdAt: hoursAgo(90),
    updatedAt: hoursAgo(72),
    messages: [
      m('m23', 'user', 'Plan for the new card freeze/spend-limits feature. Mobile only, both platforms.', 90),
      m('m24', 'assistant', '**Scope:** freeze/unfreeze, per-channel spend limits (ATM/online/in-store), limit-change push notifications.\n\n**Strategy:** platform matrix iOS 17 / Android 13–14; verify limit enforcement server-side (not just UI); offline state behaviour for freeze toggle.\n\n**Risks:** backend limit propagation delay (up to 60s) may look like a bug — define acceptable propagation window with the payments team.\n\n**Exit criteria:** all P0/P1 executed; freeze enforcement verified on a real terminal + ATM simulator.', 89.4, 'Plan outline'),
    ],
  },

  // -------------------------------------------------------- Expense Tracker
  {
    id: 'conv-expense-kickoff',
    projectId: 'proj-expense',
    projectName: 'Expense Tracker',
    title: 'Expense Tracker QA Kickoff',
    category: 'Test Plans',
    pinned: false,
    archived: false,
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(1),
    messages: [
      m('m25', 'user', 'Kickoff for the Expense Tracker QA cycle: receipt scanning, budget alerts and the monthly report. What do you suggest we cover first?', 20),
      m('m26', 'assistant', 'Suggested order of attack:\n\n1. **Receipt scanning (highest risk)** — OCR accuracy across 6 receipt styles, duplicate detection, currency parsing.\n2. **Budget alerts** — threshold edge cases (exactly at limit, overshoot by 1 cent), notification preferences respected.\n3. **Monthly report** — totals reconcile with the transaction ledger; timezone boundary at month edges.\n\nI can turn any of these into test cases or a formal plan — say the word.', 19.4, 'Suggested coverage order'),
      m('m27', 'user', 'Start with receipt scanning cases.', 1),
      m('m28', 'assistant', 'Queued: generating the receipt-scanning test case set (OCR happy paths, glare/fold damage, multi-currency, duplicates). The set will appear under Test Plans & Cases for review.', 0.9, 'Generation queued (demo)'),
    ],
  },
];

// ------------------------------------------------------------- helpers
export const CATEGORY_META: Record<Category, { color: string }> = {
  'Bug Reports': { color: C.danger },
  'Test Plans': { color: C.accent },
  'Test Cases': { color: C.success },
  Documentation: { color: C.ai },
  'Regression Testing': { color: C.warning },
};

/** A believable simulated assistant reply for the demo composer. */
export function mockReply(
  category: Category,
  conversationTitle: string,
  userText: string,
  contextNames: string[] = []
): { content: string; meta: string } {
  const trimmed = userText.trim().replace(/\s+/g, ' ');
  const short = trimmed.length > 64 ? `${trimmed.slice(0, 64)}…` : trimmed;
  const ctxNote =
    contextNames.length > 0
      ? `\n\n**Context noted:** ${contextNames.join(', ')} — in this demo their contents are not read; connect the backend integration for real document/URL analysis.`
      : '';
  const byCat: Record<Category, { content: string; meta: string }> = {
    'Bug Reports': {
      content: `Triaged against the context of this conversation.${ctxNote}\n\n**Summary:** ${short}\n\n**Proposed severity:** High · **Priority:** P1 (data-integrity or blocked-flow bugs default here — adjust in the saved report).\n\n**Draft structure:** steps to reproduce numbered and minimal; expected vs actual split; environment captured from what you described. Open Bug Reports to save and refine the full document with the team.`,
      meta: 'Triage draft ready',
    },
    'Test Plans': {
      content: `Updated the plan outline for “${conversationTitle}” with your note: ${short}${ctxNote}\n\n**Added:** scope entry, owner column and an exit-criteria line covering the new item.\n\nWhen the outline feels complete, save it as a formal plan document from this thread — it will appear under Test Plans & Cases with a version badge.`,
      meta: 'Plan outline updated',
    },
    'Test Cases': {
      content: `Generated a new draft case set from your note: ${short}${ctxNote}\n\nEach case carries preconditions, numbered steps, an expected result, and a priority (Critical for idempotency/money paths). Open the thread history any time — the earlier cases in this conversation stay in context, so numbering continues from where we left off.`,
      meta: 'Draft cases added to thread',
    },
    Documentation: {
      content: `Drafted a documentation update for “${conversationTitle}” reflecting your note: ${short}${ctxNote}\n\nStructure: purpose → scope → endpoint/behaviour summary → QA notes. Save it to Reports & Documentation when you are happy with the wording.`,
      meta: 'Documentation draft ready',
    },
    'Regression Testing': {
      content: `Re-ran the impact analysis for “${conversationTitle}” including your change note: ${short}${ctxNote}\n\n**Delta:** 2 additional cases flagged for re-run; the rest of the previous scope is unaffected. Save the updated scope as a regression report to share it with the team.`,
      meta: 'Impact analysis updated',
    },
  };
  return byCat[category];
}

/** Next TC number continuing the conversation's context (demo continuity). */
export function nextCaseNumber(conv: Conversation): number {
  let max = 200;
  conv.messages.forEach((msg) => {
    const matches = msg.content.matchAll(/TC-(\d+)/g);
    for (const match of matches) max = Math.max(max, parseInt(match[1], 10));
  });
  return max + 1;
}
