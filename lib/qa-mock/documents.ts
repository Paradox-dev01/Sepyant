// ============================================================================
// [SEPYANT 2.0] QA document seed data (Phase 3 — multiple QA document &
// output types). Pure frontend mock data: no backend calls, no Supabase.
//
// One discriminated union (`QaDocument`, discriminator: `type`) covers every
// QA artefact the 2.0 surfaces render: bug reports, test plans, test-case
// sets, execution summaries, technical docs and regression reports. Each
// member carries its own structured `content` so previews and the markdown
// export can be type-safe.
//
// Persistence: localStorage via useMockStore (DOCUMENTS_KEY), so renames,
// edits, status changes and deletes survive browser refreshes during the
// demo. The sidebar command palette discovers documents through the lazy
// `window.__SEPYANT_DOCS__` registry (see registerDocsForPalette below).
// ============================================================================

import {
  BookOpen,
  Bug,
  ClipboardList,
  FileCheck2,
  History,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { C } from '@/lib/theme';

// ------------------------------------------------------------------- Types

export type DocType =
  | 'bug-report'
  | 'test-plan'
  | 'test-case-set'
  | 'execution-summary'
  | 'tech-doc'
  | 'regression-report';

export type DocStatus = 'draft' | 'in-review' | 'final';

export type DocComment = {
  id: string;
  author: string; // display name
  body: string;
  at: string; // ISO timestamp
};

// Per-type structured content ---------------------------------------------

export type BugReportContent = {
  severity: string;
  priority: string;
  environment: string;
  steps: string[];
  expected: string;
  actual: string;
  attachments: string[];
};

export type TestPlanContent = {
  objectives: string;
  scopeIn: string[];
  scopeOut: string[];
  strategy: string;
  resources: string[];
  risks: string[];
  entryCriteria: string[];
  exitCriteria: string[];
};

export type TestCaseContent = {
  id: string;
  title: string;
  preconditions: string;
  steps: string[];
  expected: string;
  priority: string;
  category: string;
};

export type TestCaseSetContent = {
  cases: TestCaseContent[];
};

export type SuiteResult = {
  name: string;
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
};

export type ExecutionSummaryContent = {
  totals: { passed: number; failed: number; blocked: number; pending: number };
  durationHours: number;
  passRate: number; // percent
  suites: SuiteResult[];
  coveragePct: number; // percent
};

export type TechDocSection = {
  heading: string;
  body: string;
  code?: string;
};

export type TechDocContent = {
  sections: TechDocSection[];
};

export type AffectedCase = {
  id: string;
  title: string;
  reason: string;
};

export type RegressionReportContent = {
  impactAnalysis: string;
  scenarios: string[];
  affectedCases: AffectedCase[];
};

// Discriminated union ------------------------------------------------------

export type QaDocument = {
  id: string;
  type: DocType;
  title: string;
  project: string; // display name
  status: DocStatus;
  owner: string; // display name
  updatedAt: string; // ISO
  comments: DocComment[];
  // [SEPYANT 2.1] traceability: resources selected as generation context when
  // this document was produced by the workspace generation flow. Optional —
  // seeded documents predate the field. Names only: in the demo no document
  // or URL content is ever read, and the UI must not imply otherwise.
  resourcesUsed?: { name: string; kind: 'file' | 'url' }[];
} & (
  | { type: 'bug-report'; content: BugReportContent }
  | { type: 'test-plan'; content: TestPlanContent }
  | { type: 'test-case-set'; content: TestCaseSetContent }
  | { type: 'execution-summary'; content: ExecutionSummaryContent }
  | { type: 'tech-doc'; content: TechDocContent }
  | { type: 'regression-report'; content: RegressionReportContent }
);

// ------------------------------------------------------------------- Meta

export const DOC_TYPE_META: Record<DocType, { label: string; color: string; icon: LucideIcon }> = {
  'bug-report': { label: 'Bug report', color: C.danger, icon: Bug },
  'test-plan': { label: 'Test plan', color: C.accent, icon: ClipboardList },
  'test-case-set': { label: 'Test cases', color: C.success, icon: ListChecks },
  'execution-summary': { label: 'Execution summary', color: C.warning, icon: FileCheck2 },
  'tech-doc': { label: 'Tech doc', color: C.ai, icon: BookOpen },
  'regression-report': { label: 'Regression report', color: '#5dc9e8', icon: History },
};

export const DOC_STATUS_META: Record<DocStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: C.fgMuted },
  'in-review': { label: 'In review', color: C.warning },
  final: { label: 'Final', color: C.success },
};

export const DOC_STATUS_OPTIONS: { value: DocStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in-review', label: 'In review' },
  { value: 'final', label: 'Final' },
];

// -------------------------------------------------------------------- Seed

export const DOCUMENTS_KEY = 'documents.v1';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export const DOCUMENTS_SEED: QaDocument[] = [
  // ------------------------------------------------------------- Bug reports
  {
    id: 'doc-bug-104',
    type: 'bug-report',
    title: 'BUG-104 Login hangs after OTP entry (2FA)',
    project: 'E-commerce Website',
    status: 'in-review',
    owner: 'Sofia Reyes',
    updatedAt: hoursAgo(2),
    comments: [
      {
        id: 'cmt-b104-1',
        author: 'Priya Nair',
        body: 'Reproduced on staging — steps 2–4 match exactly. Happens on Firefox too, so it is not a WebKit issue. Attaching the HAR file to the linked ticket.',
        at: hoursAgo(3),
      },
      {
        id: 'cmt-b104-2',
        author: 'Marcus Lee',
        body: 'Console log attached. The loader keeps spinning and the network tab shows the /auth/verify call never resolves — no response, no timeout. Suspect the new retry wrapper swallowing the abort.',
        at: hoursAgo(1),
      },
    ],
    content: {
      severity: 'High',
      priority: 'P1',
      environment: 'Staging (stg.ecom-demo.io) · Chrome 130 / macOS 14 · Build 2.14.0-rc3',
      steps: [
        'Open the storefront and click "Sign in".',
        'Enter a registered email address and password, then submit the form.',
        'Enter the 6-digit OTP from the authenticator app.',
        'Click "Verify".',
      ],
      expected:
        'The user is authenticated within 2 seconds and redirected to the storefront home with a session established.',
      actual:
        'The verify button enters a permanent loading state and no error is shown; the user must hard-refresh to recover. Reproduces on ~90% of staging attempts and ~30% in production.',
      attachments: ['har-login-otp.zip (2.1 MB)', 'console-log-otp-hang.txt', 'screenshot-loader-stuck.png'],
    },
  },
  {
    id: 'doc-bug-211',
    type: 'bug-report',
    title: 'BUG-211 Transfer fails silently when beneficiary name contains an emoji',
    project: 'Banking App — Mobile',
    status: 'draft',
    owner: 'Daniel Kim',
    updatedAt: hoursAgo(26),
    comments: [],
    content: {
      severity: 'Critical',
      priority: 'P0',
      environment: 'Android 14 · Pixel 8 · Banking App 4.7.1 (build 4183) · Production',
      steps: [
        'Log in to the mobile banking app on an Android 14 device.',
        'Navigate to Payments → New transfer.',
        'Add a beneficiary whose display name contains an emoji (e.g. "Ana 🌸").',
        'Enter an amount (e.g. 25.00) and confirm the transfer.',
      ],
      expected:
        'The transfer completes and a success receipt with a reference number is displayed; the transaction appears in the history.',
      actual:
        'The app silently returns to the transfer form — no error message or toast. No transaction is created and the amount is not debited. iOS is unaffected.',
      attachments: ['android-logcat-emoji-failure.txt', 'screen-recording-transfer.mp4'],
    },
  },

  // ---------------------------------------------------------- Test-case sets
  {
    id: 'doc-tc-checkout',
    type: 'test-case-set',
    title: 'Checkout Test Cases — Guest Flow',
    project: 'E-commerce Website',
    status: 'final',
    owner: 'Marcus Lee',
    updatedAt: hoursAgo(5),
    comments: [
      {
        id: 'cmt-tcc-1',
        author: 'Marcus Lee',
        body: 'Guest checkout covers cart → address → shipping → payment → confirmation. Promo-code edge cases live in the payments set referenced by the Payment & Checkout plan (TC-2xx series).',
        at: hoursAgo(6),
      },
    ],
    content: {
      cases: [
        {
          id: 'TC-201',
          title: 'Guest checkout with a single in-stock item — happy path',
          preconditions: 'Cart contains 1 in-stock item; user is not signed in.',
          steps: [
            'Add the item to the cart and open the cart page.',
            'Click "Checkout as guest".',
            'Fill contact, address and shipping fields with valid data.',
            'Pay with test card 4111 1111 1111 1111 (any future expiry).',
          ],
          expected: 'Order is placed; the confirmation page shows an order number and the estimated delivery window.',
          priority: 'critical',
          category: 'Happy path',
        },
        {
          id: 'TC-202',
          title: 'Guest checkout with items from multiple categories',
          preconditions: 'Cart contains items from 2 categories, including one heavy item with a shipping surcharge.',
          steps: [
            'Open the cart and verify the per-line totals.',
            'Proceed to guest checkout and choose standard shipping.',
            'Compare the order summary against the cart summary.',
          ],
          expected: 'The shipping surcharge applies exactly once; per-line totals and the grand total match the cart summary.',
          priority: 'high',
          category: 'Happy path',
        },
        {
          id: 'TC-203',
          title: 'Invalid email format in the contact field blocks order placement',
          preconditions: 'Guest checkout started with a valid cart.',
          steps: [
            'Enter "not-an-email" in the contact email field.',
            'Fill the remaining address fields with valid data.',
            'Attempt to continue to payment.',
          ],
          expected: 'Submission is blocked and inline validation highlights the email field with a readable message.',
          priority: 'high',
          category: 'Validation',
        },
        {
          id: 'TC-204',
          title: 'Shipping address containing special characters is accepted',
          preconditions: 'Guest checkout started with a valid cart.',
          steps: [
            'Enter an address with special characters, e.g. "Apt 3B — Østre Allé 12".',
            'Continue to payment and place the order.',
            'Open the confirmation page.',
          ],
          expected: 'The address is accepted and rendered correctly (no mojibake or HTML escaping artifacts) on the confirmation page.',
          priority: 'medium',
          category: 'Validation',
        },
        {
          id: 'TC-205',
          title: 'Express shipping option updates totals correctly',
          preconditions: 'Guest checkout reached the shipping step with a valid address.',
          steps: [
            'Note the standard-shipping total.',
            'Switch to express shipping.',
            'Compare the updated order total.',
          ],
          expected: 'The express fee is added once and tax is recalculated on the new subtotal; no duplicate charges.',
          priority: 'medium',
          category: 'Happy path',
        },
        {
          id: 'TC-206',
          title: 'Promo code applied before tax calculation',
          preconditions: 'Promo code PROMO10 active (10% off, gift cards excluded); cart contains a promo-eligible item.',
          steps: [
            'Apply PROMO10 in the cart.',
            'Continue to the payment review step.',
            'Verify the discount, tax and grand total lines.',
          ],
          expected: 'The 10% discount is applied before tax and the grand total reflects the discounted base.',
          priority: 'high',
          category: 'Payments',
        },
        {
          id: 'TC-207',
          title: 'Out-of-stock item is removed at checkout with a user notification',
          preconditions: 'Cart contains an item with 1 unit left; another session purchases that unit.',
          steps: [
            'Refresh / continue the checkout.',
            'Observe the cart contents and notifications.',
            'Complete the order with the remaining items.',
          ],
          expected: 'The unavailable item is flagged or removed with a visible notice and the order completes without it.',
          priority: 'high',
          category: 'Edge case',
        },
        {
          id: 'TC-208',
          title: 'Session timeout mid-checkout preserves the cart',
          preconditions: 'Guest session configured to expire after 30 minutes of inactivity.',
          steps: [
            'Reach the shipping step, then leave the page idle until the session expires.',
            'Continue the checkout.',
            'Inspect the cart and entered data.',
          ],
          expected: 'The user is prompted to re-authenticate or restart cleanly; previously entered data is not silently lost.',
          priority: 'medium',
          category: 'Edge case',
        },
        {
          id: 'TC-209',
          title: 'Declined payment shows a readable error and keeps the cart intact',
          preconditions: 'Guest checkout reached payment with a valid cart.',
          steps: [
            'Pay with the decline test card 4000 0000 0000 0002.',
            'Observe the error presentation.',
            'Retry with the success test card.',
          ],
          expected: 'A specific, readable decline error is shown, the cart remains intact and the retry succeeds without duplication.',
          priority: 'critical',
          category: 'Payments',
        },
        {
          id: 'TC-210',
          title: 'Order confirmation email contains the correct order summary',
          preconditions: 'An order was placed successfully as a guest.',
          steps: [
            'Open the mailbox for the contact email used at checkout.',
            'Open the confirmation email.',
            'Compare items, totals and the delivery address with the order.',
          ],
          expected: 'The email matches the placed order exactly — items, quantities, totals and address.',
          priority: 'medium',
          category: 'Notifications',
        },
        {
          id: 'TC-211',
          title: 'Browser back after payment does not duplicate the order',
          preconditions: 'An order was just placed successfully as a guest.',
          steps: [
            'On the confirmation page, press the browser back button.',
            'Attempt to re-submit the payment step if it is presented.',
            'Count the resulting orders in the admin panel.',
          ],
          expected: 'No duplicate order is created; the cart is empty and the user lands on a safe page.',
          priority: 'critical',
          category: 'Edge case',
        },
      ],
    },
  },
  {
    id: 'doc-tc-kyc',
    type: 'test-case-set',
    title: 'Mobile KYC Onboarding Cases',
    project: 'Banking App — Mobile',
    status: 'draft',
    owner: 'Priya Nair',
    updatedAt: hoursAgo(40),
    comments: [],
    content: {
      cases: [
        {
          id: 'TC-301',
          title: 'First-time onboarding — passport document scan accepted',
          preconditions: 'Fresh install; user signed up but not KYC-verified.',
          steps: [
            'Start identity verification and choose "Passport".',
            'Scan a valid test passport with the camera.',
            'Submit and wait for the automated check.',
          ],
          expected: 'The document is accepted, extraction succeeds and onboarding advances to the selfie step.',
          priority: 'critical',
          category: 'Happy path',
        },
        {
          id: 'TC-302',
          title: 'Blurred document image triggers a retake',
          preconditions: 'Verification flow started.',
          steps: [
            'Capture a deliberately blurred photo of the document.',
            'Submit the capture.',
          ],
          expected: 'The app rejects the image with a "blurry photo" hint and offers a retake without losing flow state.',
          priority: 'high',
          category: 'Validation',
        },
        {
          id: 'TC-303',
          title: 'Selfie liveness check passes under normal lighting',
          preconditions: 'Document step passed.',
          steps: [
            'Follow the on-screen prompts for the liveness selfie in a normally lit room.',
            'Submit the selfie.',
          ],
          expected: 'Liveness passes and verification continues to the review screen.',
          priority: 'critical',
          category: 'Happy path',
        },
        {
          id: 'TC-304',
          title: 'Selfie liveness rejects a printed photo (anti-spoofing)',
          preconditions: 'Document step passed.',
          steps: [
            'Present a printed photograph of a face to the camera.',
            'Complete the liveness prompt.',
          ],
          expected: 'Liveness fails with a generic anti-spoofing message; the attempt is logged and the user may retry a limited number of times.',
          priority: 'critical',
          category: 'Security',
        },
        {
          id: 'TC-305',
          title: 'Expired ID document is rejected with a reason',
          preconditions: 'Verification flow started.',
          steps: [
            'Scan a test document with an expiry date in the past.',
            'Submit for the automated check.',
          ],
          expected: 'The document is rejected with an explicit "document expired" reason and the user can choose another document type.',
          priority: 'high',
          category: 'Validation',
        },
        {
          id: 'TC-306',
          title: 'Extracted KYC data matches the typed-in personal details',
          preconditions: 'Document scan accepted.',
          steps: [
            'Review the pre-filled personal details extracted from the document.',
            'Compare every field against the physical document.',
            'Confirm the details.',
          ],
          expected: 'All extracted fields (name, document number, DOB) match the document exactly; manual edits are tracked.',
          priority: 'high',
          category: 'Data integrity',
        },
        {
          id: 'TC-307',
          title: 'Onboarding resumes after the app is killed mid-flow',
          preconditions: 'Verification flow reached the selfie step.',
          steps: [
            'Force-kill the app.',
            'Relaunch and navigate back to onboarding.',
            'Resume verification.',
          ],
          expected: 'The flow resumes at the last completed step; already uploaded documents do not need to be recaptured.',
          priority: 'medium',
          category: 'Edge case',
        },
        {
          id: 'TC-308',
          title: 'Unsupported issuing country shows the fallback path',
          preconditions: 'Verification flow started.',
          steps: [
            'Select an issuing country that is not supported.',
            'Attempt to continue.',
          ],
          expected: 'A clear unsupported-country message is shown with the manual review contact path — no dead end.',
          priority: 'medium',
          category: 'Edge case',
        },
        {
          id: 'TC-309',
          title: 'Manual review queue after two failed automated attempts',
          preconditions: 'Two automated verification attempts already failed for the account.',
          steps: [
            'Start a third verification attempt.',
            'Complete the document and selfie steps.',
          ],
          expected: 'The submission is routed to manual review, the user sees the expected turnaround time and no further automated retry is offered.',
          priority: 'high',
          category: 'Process',
        },
      ],
    },
  },

  // -------------------------------------------------------------- Test plans
  {
    id: 'doc-plan-payment',
    type: 'test-plan',
    title: 'Payment & Checkout Test Plan',
    project: 'E-commerce Website',
    status: 'in-review',
    owner: 'Elena Novak',
    updatedAt: hoursAgo(8),
    comments: [],
    content: {
      objectives:
        'Validate the end-to-end payment and checkout experience for guest and signed-in customers on web and mobile web — including payment authorisation, tax and shipping calculations, and order confirmation — before the 2.14 release cut.',
      scopeIn: [
        'Guest and signed-in checkout flows (cart → payment → confirmation)',
        'Card, wallet and buy-now-pay-later methods in the sandbox',
        'Shipping options, surcharges and tax calculation for EU and US addresses',
        'Promo codes and gift-card redemption',
        'Declined payments, retries and idempotency of order submission',
      ],
      scopeOut: [
        'Native mobile apps (covered by the Banking App plans)',
        'Performance and load testing of the payment gateway',
        'PCI compliance audit',
        'Refunds and chargebacks (separate plan, Q3)',
      ],
      strategy:
        'Risk-based functional testing driven by the checkout test-case set (TC-201…TC-211) plus exploratory passes on payment edge cases. Sandbox processors only — no live charges. The automated smoke suite runs on every release candidate.',
      resources: [
        'Elena Novak — QA lead (plan owner, payments)',
        'Marcus Lee — QA engineer (checkout flows)',
        'Sofia Reyes — QA engineer (tax & shipping)',
        'Payments sandbox environment + test-card matrix',
      ],
      risks: [
        'Gateway sandbox instability has historically delayed the cycle by up to 1 day',
        'Tax-engine rules for the new EU VAT-inclusive pricing are still being finalised',
        'Only one QA resource is familiar with the BNPL provider quirks',
      ],
      entryCriteria: [
        'Build 2.14.0-rc deployed to staging with migrations applied',
        'Payment sandbox credentials provisioned for all supported providers',
        'Checkout test-case set reviewed and approved',
        'No open P0/P1 defects in the cart and address services',
      ],
      exitCriteria: [
        '100% of critical and high test cases executed',
        '≥ 95% pass rate with no open P0/P1 defects',
        'All blocked cases have a linked ticket and an owner',
        'Regression suite green on the release candidate',
      ],
    },
  },
  {
    id: 'doc-plan-card-controls',
    type: 'test-plan',
    title: 'Card Controls Test Plan',
    project: 'Banking App — Mobile',
    status: 'final',
    owner: 'Priya Nair',
    updatedAt: hoursAgo(72),
    comments: [],
    content: {
      objectives:
        'Verify that cardholders can freeze/unfreeze cards, set per-category spend limits and toggle online/international usage — and that every control takes effect on authorisation requests within the 5-second SLA.',
      scopeIn: [
        'Freeze and unfreeze for physical and virtual cards',
        'Per-category spend limits (ATM, online, retail)',
        'Online and international usage toggles',
        'Push notification on control change',
        'Control changes reflected in authorisation decisioning',
      ],
      scopeOut: [
        'Corporate cards and multi-card business profiles',
        'Disputes and chargebacks',
        'Wearable companions (Wear OS / watchOS)',
      ],
      strategy:
        'Scenario-based manual testing on physical test cards through the issuer sandbox, paired with API-level probes to confirm authorisation behaviour. Every control change is verified against a live authorisation attempt within the 5-second SLA.',
      resources: [
        'Priya Nair — QA engineer (controls & decisioning)',
        'Daniel Kim — QA engineer (mobile UX)',
        'Issuer sandbox with 6 test cards across tiers',
      ],
      risks: [
        'Issuer sandbox applies control changes asynchronously (up to 2s lag)',
        'The ATM authorisation path can only be simulated, not exercised physically',
      ],
      entryCriteria: [
        'Card Controls API v3 deployed to the issuer sandbox',
        'Test cards activated and enrolled in push notifications',
        'Authorisation simulator configured for the 5s SLA check',
      ],
      exitCriteria: [
        'All planned cases executed with ≥ 97% pass rate',
        'No open severity-1 or severity-2 defects',
        'Control-to-authorisation SLA verified for every control type',
        'Sign-off from the product owner recorded',
      ],
    },
  },

  // ------------------------------------------------------- Execution summary
  {
    id: 'doc-exec-214',
    type: 'execution-summary',
    title: 'Release 2.14 Execution Summary',
    project: 'E-commerce Website',
    status: 'final',
    owner: 'Elena Novak',
    updatedAt: hoursAgo(12),
    comments: [],
    content: {
      totals: { passed: 18, failed: 3, blocked: 2, pending: 1 },
      durationHours: 6.5,
      passRate: 75,
      suites: [
        { name: 'Checkout — guest flow', passed: 7, failed: 1, blocked: 0, pending: 0 },
        { name: 'Payments — providers', passed: 5, failed: 2, blocked: 1, pending: 1 },
        { name: 'Tax & shipping', passed: 4, failed: 0, blocked: 0, pending: 0 },
        { name: 'Accounts & session', passed: 2, failed: 0, blocked: 1, pending: 0 },
      ],
      coveragePct: 87,
    },
  },

  // --------------------------------------------------------------- Tech docs
  {
    id: 'doc-doc-api',
    type: 'tech-doc',
    title: 'API Documentation — Orders v2',
    project: 'E-commerce Website',
    status: 'final',
    owner: 'Daniel Kim',
    updatedAt: hoursAgo(30),
    comments: [],
    content: {
      sections: [
        {
          heading: 'Overview',
          body:
            'The Orders v2 API replaces the legacy /v1/orders endpoints. It introduces cursor pagination, idempotent creation and a versioned error envelope. v1 remains available until 2026-03-31 but receives no new features; all new integrations must use v2.',
        },
        {
          heading: 'Authentication',
          body:
            'All requests require a Bearer token issued per integration. Tokens are scoped: orders:read for retrieval endpoints, orders:write for creation and cancellation. Tokens expire after 24 hours; rotate them via the dashboard or the /auth/token endpoint.',
        },
        {
          heading: 'Endpoint summary',
          body: 'Core order resources exposed by v2. All endpoints accept and return JSON, and require the Idempotency-Key header on POST.',
          code: [
            'POST   /v2/orders                  Create an order from a cart',
            'GET    /v2/orders                  List orders (cursor pagination)',
            'GET    /v2/orders/{id}             Retrieve a single order',
            'POST   /v2/orders/{id}/cancel      Cancel an order (idempotent)',
            'GET    /v2/orders/{id}/events      Order lifecycle events (audit trail)',
          ].join('\n'),
        },
        {
          heading: 'Create an order',
          body:
            'Creating an order converts an open cart into an order. The cart must be in status "ready" and pass stock re-validation server-side. A successful call returns 201 with the full order resource; the Location header points to the new resource.',
          code: [
            'POST /v2/orders',
            'Idempotency-Key: 8f3c1a2e-4b7d-4c1e-9f2a-7d6e5b4a3c2f',
            '',
            '{',
            '  "cartId": "cart_01J9ZK4W2Q",',
            '  "customerEmail": "guest@example.com",',
            '  "shippingAddress": { "line1": "12 Market St", "city": "Berlin", "country": "DE", "postalCode": "10115" },',
            '  "paymentMethod": { "type": "card", "token": "pm_card_visa" }',
            '}',
          ].join('\n'),
        },
        {
          heading: 'Idempotency',
          body:
            'POST /v2/orders and the cancel endpoint require an Idempotency-Key header (any UUID). Replaying a request with the same key within 48 hours returns the original result instead of creating a duplicate — this is what makes client retries safe after gateway timeouts.',
        },
        {
          heading: 'Errors & rate limits',
          body:
            'Errors use a versioned envelope with a stable machine-readable code, a human message and an optional trace id for support. Rate-limited calls return 429 with a Retry-After header in seconds; integrations must honour it before retrying. Added for 2.14: the rate-limit headers are now also present on 200 responses so clients can budget proactively.',
          code: [
            'HTTP/1.1 429 Too Many Requests',
            'Retry-After: 12',
            '',
            '{',
            '  "error": {',
            '    "code": "rate_limited",',
            '    "message": "Too many requests. Retry after 12 seconds.",',
            '    "traceId": "trc_7f2a9c"',
            '  }',
            '}',
          ].join('\n'),
        },
      ],
    },
  },

  // ------------------------------------------------------ Regression reports
  {
    id: 'doc-regression-214',
    type: 'regression-report',
    title: 'Release 2.14 impact analysis',
    project: 'E-commerce Website',
    status: 'in-review',
    owner: 'SEPYANT',
    updatedAt: hoursAgo(20),
    comments: [],
    content: {
      impactAnalysis:
        'The 2.14 release touches the checkout pipeline (cart service v9), the payment authorisation adapter and the tax-engine upgrade to EU VAT-inclusive pricing. Dependency-graph analysis flagged 18 test cases across 4 suites whose fixtures or assertions reference the changed services. The eight highest-priority cases are listed below; 6 of them also cover the promotions service consumed by the new promo-code validation path.',
      scenarios: [
        'Guest checkout with a promo code at the payment review step',
        'Card payment retried after a gateway timeout (idempotency check)',
        'EU address with VAT-inclusive pricing and express shipping',
        'Wallet payment where the cart total changes between authorisation and capture',
        'Order cancellation within the 30-minute window after payment',
        'Tax recalculation when the shipping address changes after quoting',
      ],
      affectedCases: [
        { id: 'TC-206', title: 'Promo code applied before tax calculation', reason: 'Promo validation now runs in the cart service v9 pipeline' },
        { id: 'TC-201', title: 'Guest checkout with a single in-stock item — happy path', reason: 'Cart service v9 changes the cart-total payload contract' },
        { id: 'TC-205', title: 'Express shipping option updates totals correctly', reason: 'Tax-engine upgrade recalculates shipping tax on address change' },
        { id: 'TC-209', title: 'Declined payment shows a readable error and keeps the cart intact', reason: 'Authorisation adapter error mapping was rewritten' },
        { id: 'TC-211', title: 'Browser back after payment does not duplicate the order', reason: 'Idempotency key moved from the cart to the order service' },
        { id: 'TC-202', title: 'Guest checkout with items from multiple categories', reason: 'Cart-total payload contract changed (v9)' },
        { id: 'TC-210', title: 'Order confirmation email contains the correct order summary', reason: 'Order totals now include VAT-inclusive breakdown fields' },
        { id: 'TC-204', title: 'Shipping address containing special characters is accepted', reason: 'Address normalisation moved into the tax-engine upgrade' },
      ],
    },
  },
];

// ------------------------------------------------------ Markdown serializer

const MD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MD_FENCE = '```';

function mdDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MD_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function mdBullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function mdHeader(doc: QaDocument): string {
  return [
    `# ${doc.title}`,
    '',
    mdTable(
      ['Field', 'Value'],
      [
        ['Type', DOC_TYPE_META[doc.type].label],
        ['Project', doc.project],
        ['Owner', doc.owner],
        ['Status', DOC_STATUS_META[doc.status].label],
        ['Last updated', mdDate(doc.updatedAt)],
      ]
    ),
    '',
  ].join('\n');
}

/** Serialize any QaDocument into a clean, professional Markdown file. */
export function documentToMarkdown(doc: QaDocument): string {
  const lines: string[] = [mdHeader(doc)];

  switch (doc.type) {
    case 'bug-report': {
      const c = doc.content;
      lines.push(
        '## Summary',
        '',
        mdTable(
          ['Severity', 'Priority', 'Environment'],
          [[c.severity, c.priority, c.environment.replace(/\|/g, '\\|')]]
        ),
        '',
        '## Steps to reproduce',
        '',
        c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        '',
        '## Expected result',
        '',
        c.expected,
        '',
        '## Actual result',
        '',
        c.actual
      );
      if (c.attachments.length > 0) {
        lines.push('', '## Attachments', '', mdBullets(c.attachments));
      }
      break;
    }

    case 'test-plan': {
      const c = doc.content;
      lines.push(
        '## Objectives',
        '',
        c.objectives,
        '',
        '## Scope',
        '',
        '### In scope',
        '',
        mdBullets(c.scopeIn),
        '',
        '### Out of scope',
        '',
        mdBullets(c.scopeOut),
        '',
        '## Test strategy',
        '',
        c.strategy,
        '',
        '## Resources',
        '',
        mdBullets(c.resources),
        '',
        '## Risks',
        '',
        mdBullets(c.risks),
        '',
        '## Entry criteria',
        '',
        c.entryCriteria.map((i) => `- [ ] ${i}`).join('\n'),
        '',
        '## Exit criteria',
        '',
        c.exitCriteria.map((i) => `- [ ] ${i}`).join('\n')
      );
      break;
    }

    case 'test-case-set': {
      const c = doc.content;
      lines.push(
        `**${c.cases.length} test cases** — ${doc.project}`,
        ''
      );
      c.cases.forEach((tc) => {
        lines.push(
          `### ${tc.id} — ${tc.title}`,
          '',
          mdTable(['Priority', 'Category'], [[tc.priority, tc.category]]),
          '',
          `**Preconditions:** ${tc.preconditions}`,
          '',
          '**Steps:**',
          '',
          tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          '',
          `**Expected:** ${tc.expected}`,
          ''
        );
      });
      break;
    }

    case 'execution-summary': {
      const c = doc.content;
      const t = c.totals;
      lines.push(
        '## Results',
        '',
        mdTable(
          ['Passed', 'Failed', 'Blocked', 'Pending', 'Total'],
          [[String(t.passed), String(t.failed), String(t.blocked), String(t.pending), String(t.passed + t.failed + t.blocked + t.pending)]]
        ),
        '',
        '## Key metrics',
        '',
        `- Pass rate: **${c.passRate}%**`,
        `- Duration: **${c.durationHours}h**`,
        `- Coverage: **${c.coveragePct}%**`,
        '',
        '## Suites',
        '',
        mdTable(
          ['Suite', 'Passed', 'Failed', 'Blocked', 'Pending'],
          c.suites.map((s) => [s.name, String(s.passed), String(s.failed), String(s.blocked), String(s.pending)])
        )
      );
      break;
    }

    case 'tech-doc': {
      doc.content.sections.forEach((s) => {
        lines.push(`## ${s.heading}`, '', s.body);
        if (s.code && s.code.trim().length > 0) {
          lines.push('', MD_FENCE, s.code, MD_FENCE);
        }
        lines.push('');
      });
      break;
    }

    case 'regression-report': {
      const c = doc.content;
      lines.push(
        '## Impact analysis',
        '',
        c.impactAnalysis,
        '',
        '## Suggested regression scenarios',
        '',
        mdBullets(c.scenarios),
        '',
        `## Affected cases (${c.affectedCases.length})`,
        '',
        mdTable(
          ['ID', 'Title', 'Reason'],
          c.affectedCases.map((a) => [a.id, a.title, a.reason])
        )
      );
      break;
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

// ------------------------------------------------------- Palette registry

/** Register documents for the sidebar command palette (lazy global hook). */
export function registerDocsForPalette(docs: QaDocument[] = DOCUMENTS_SEED): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __SEPYANT_DOCS__?: { id: string; title: string; typeLabel: string; project: string }[] };
  w.__SEPYANT_DOCS__ = docs.map((d) => ({
    id: d.id,
    title: d.title,
    typeLabel: DOC_TYPE_META[d.type].label,
    project: d.project,
  }));
}

/** Filesystem-safe .md filename for a document download. */
export function docFilename(doc: QaDocument): string {
  const slug = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'document'}.md`;
}
