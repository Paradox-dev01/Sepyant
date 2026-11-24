// ============================================================================
// [SEPYANT 2.0] Notification seed data for the sidebar bell (Phase 6 — team
// collaboration, simulated). Pure frontend mock data: no backend calls.
// Persistence: localStorage via useMockStore, so read/unread state survives
// refreshes during the demo.
// ============================================================================

export type NotificationKind = 'comment' | 'mention' | 'invite' | 'approval' | 'system';

export type MockNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actor: string;
  at: string; // ISO
  read: boolean;
  href?: string; // optional deep link into a 2.0 surface
};

export const NOTIFICATIONS_KEY = 'notifications.v1';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export const NOTIFICATIONS_SEED: MockNotification[] = [
  {
    id: 'ntf-001',
    kind: 'comment',
    title: 'New comment on "BUG-104 Payment gateway timeout"',
    body: '“Reproduced on staging — attaching the HAR file. Steps 2–4 match.”',
    actor: 'Priya Nair',
    at: hoursAgo(1),
    read: false,
    href: '/documents/doc-bug-104',
  },
  {
    id: 'ntf-002',
    kind: 'mention',
    title: 'Marcus mentioned you in Checkout Test Cases',
    body: '“@you can you review the guest-checkout edge cases before the release cut?”',
    actor: 'Marcus Lee',
    at: hoursAgo(3),
    read: false,
    href: '/documents/doc-tc-checkout',
  },
  {
    id: 'ntf-003',
    kind: 'approval',
    title: 'Test plan approved: “Payment & Checkout Test Plan”',
    body: 'Elena Novak approved v3 — 42 cases scheduled for the sprint regression cycle.',
    actor: 'Elena Novak',
    at: hoursAgo(7),
    read: false,
    href: '/documents/doc-plan-payment',
  },
  {
    id: 'ntf-004',
    kind: 'invite',
    title: 'Sofia Reyes joined E-commerce Website',
    body: 'Editor access · invited by you. 3 shared conversations are now visible to her.',
    actor: 'Sofia Reyes',
    at: hoursAgo(22),
    read: true,
    href: '/team',
  },
  {
    id: 'ntf-005',
    kind: 'system',
    title: 'Regression report ready: “Release 2.14 impact analysis”',
    body: '18 affected test cases identified across checkout and payment modules.',
    actor: 'SEPYANT',
    at: hoursAgo(30),
    read: true,
    href: '/documents/doc-regression-214',
  },
  {
    id: 'ntf-006',
    kind: 'comment',
    title: 'Reply on “API Documentation — Orders v2”',
    body: 'Daniel Kim: “Added the 429 rate-limit behaviour to the endpoint summary.”',
    actor: 'Daniel Kim',
    at: hoursAgo(49),
    read: true,
    href: '/documents/doc-doc-api',
  },
];
