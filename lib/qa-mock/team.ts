// ============================================================================
// [SEPYANT 2.0] Team collaboration seed data (Phase 6 — simulated, frontend
// only). Pure mock data: no backend calls, no real auth or permissions.
// Mutations (role changes, invites, removals) persist client-side via
// lib/mock-store.ts, so demo edits survive browser refreshes.
//
// Honesty rules baked into the data:
//  - The current user is "You (demo owner)" with the fictional dev-bypass
//    email (dev@sepyant.local) so demo data can never be mistaken for a real
//    account. Teammates use clearly fictional @sepyant.dev addresses.
//  - ROLE_META.blurb / .can describe DEMO roles only — nothing is enforced.
// ============================================================================

import { C } from '@/lib/theme';

export const TEAM_KEY = 'team.members.v1';
export const ACTIVITY_KEY = 'team.activity.v1';

// ------------------------------------------------------------------ roles
export const ROLES = ['Owner', 'Admin', 'Editor', 'Viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<Role, { color: string; blurb: string; can: string[] }> = {
  Owner: {
    color: C.warning,
    blurb: 'Full control incl. billing & delete',
    can: [
      'Full control including billing, plan and project deletion',
      'Manage members, roles and invites',
      'Everything Admins, Editors and Viewers can do',
    ],
  },
  Admin: {
    color: C.ai,
    blurb: 'Manage members & roles',
    can: [
      'Invite and remove members, change roles',
      'Approve test plans, reports and releases',
      'Everything Editors and Viewers can do',
    ],
  },
  Editor: {
    color: C.success,
    blurb: 'Create/edit docs, cases, scripts',
    can: [
      'Create and edit docs, cases and automation scripts',
      'Comment on and reopen bug reports',
      'Cannot manage members (no invites or role changes)',
    ],
  },
  Viewer: {
    color: C.fgMuted,
    blurb: 'Read-only access',
    can: [
      'Read-only access to every shared QA asset',
      'Follow activity and open shared items',
      'Cannot create, edit, delete or manage members',
    ],
  },
};

/** Default job title used when a simulated invite does not specify one. */
export const DEFAULT_TITLE: Record<Role, string> = {
  Owner: 'Project Owner',
  Admin: 'Admin',
  Editor: 'QA Engineer',
  Viewer: 'Viewer (read-only)',
};

// ----------------------------------------------------------------- members
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  joinedAt: string; // ISO
  lastActiveAt: string; // ISO
  avatarColor?: string;
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return hoursAgo(d * 24);
}

// ------------------------------------------------------------- activity
export type ActivityKind = 'comment' | 'edit' | 'invite' | 'approve' | 'create' | 'role';

export type ActivityEvent = {
  id: string;
  actor: string;
  /** Verb phrase, worded so "<actor> <action> <target>" reads naturally. */
  action: string;
  target: string;
  at: string; // ISO
  kind: ActivityKind;
};

// -------------------------------------------------------------- shared
export type SharedKind = 'project' | 'conversation' | 'document';

export type SharedItem = {
  id: string;
  kind: SharedKind;
  title: string;
  project: string;
  /** Member names the item is shared with (used for the avatar stack). */
  members: string[];
  updatedAt: string; // ISO
};

// ----------------------------------------------------------- seed data
/** Six teammates for the "E-commerce Website" demo team — the demo owner first. */
export const TEAM_SEED: Member[] = [
  {
    id: 'mem-01',
    name: 'You (demo owner)',
    email: 'dev@sepyant.local',
    role: 'Owner',
    title: 'Project Owner',
    joinedAt: daysAgo(120),
    lastActiveAt: hoursAgo(0.3),
    avatarColor: C.warning,
  },
  {
    id: 'mem-02',
    name: 'Elena Novak',
    email: 'elena.novak@sepyant.dev',
    role: 'Admin',
    title: 'QA Lead',
    joinedAt: daysAgo(90),
    lastActiveAt: hoursAgo(2),
  },
  {
    id: 'mem-03',
    name: 'Marcus Lee',
    email: 'marcus.lee@sepyant.dev',
    role: 'Editor',
    title: 'Senior QA',
    joinedAt: daysAgo(64),
    lastActiveAt: hoursAgo(5),
  },
  {
    id: 'mem-04',
    name: 'Priya Nair',
    email: 'priya.nair@sepyant.dev',
    role: 'Editor',
    title: 'QA Engineer',
    joinedAt: daysAgo(41),
    lastActiveAt: hoursAgo(9),
  },
  {
    id: 'mem-05',
    name: 'Daniel Kim',
    email: 'daniel.kim@sepyant.dev',
    role: 'Viewer',
    title: 'Developer',
    joinedAt: daysAgo(21),
    lastActiveAt: hoursAgo(44),
  },
  {
    id: 'mem-06',
    name: 'Sofia Reyes',
    email: 'sofia.reyes@sepyant.dev',
    role: 'Editor',
    title: 'QA Engineer',
    joinedAt: hoursAgo(22), // joined recently
    lastActiveAt: hoursAgo(3),
  },
];

/** 12 believable team events, newest first (matches the notifications seed). */
export const ACTIVITY_SEED: ActivityEvent[] = [
  {
    id: 'act-01',
    actor: 'Priya Nair',
    action: 'commented on',
    target: 'BUG-104 — Payment gateway timeout',
    at: hoursAgo(1),
    kind: 'comment',
  },
  {
    id: 'act-02',
    actor: 'Marcus Lee',
    action: 'edited',
    target: 'Payment & Checkout Test Plan',
    at: hoursAgo(3),
    kind: 'edit',
  },
  {
    id: 'act-03',
    actor: 'Elena Novak',
    action: 'approved',
    target: 'Payment & Checkout Test Plan (v3)',
    at: hoursAgo(5),
    kind: 'approve',
  },
  {
    id: 'act-04',
    actor: 'Marcus Lee',
    action: 'reopened',
    target: 'BUG-104 — Payment gateway timeout',
    at: hoursAgo(8),
    kind: 'edit',
  },
  {
    id: 'act-05',
    actor: 'Sofia Reyes',
    action: 'added a comment to',
    target: 'API Documentation — Orders v2',
    at: hoursAgo(14),
    kind: 'comment',
  },
  {
    id: 'act-06',
    actor: 'Marcus Lee',
    action: 'downloaded the automation script',
    target: 'Checkout — Guest Flow (Playwright)',
    at: hoursAgo(20),
    kind: 'create',
  },
  {
    id: 'act-07',
    actor: 'You (demo owner)',
    action: 'invited',
    target: 'Sofia Reyes (Editor)',
    at: hoursAgo(22),
    kind: 'invite',
  },
  {
    id: 'act-08',
    actor: 'You (demo owner)',
    action: 'pinned',
    target: 'Login Bug Report',
    at: hoursAgo(27),
    kind: 'edit',
  },
  {
    id: 'act-09',
    actor: 'Elena Novak',
    action: 'generated the regression report',
    target: 'Release 2.14 impact analysis',
    at: hoursAgo(30),
    kind: 'create',
  },
  {
    id: 'act-10',
    actor: 'You (demo owner)',
    action: 'changed the role of',
    target: 'Daniel Kim → Viewer',
    at: hoursAgo(32),
    kind: 'role',
  },
  {
    id: 'act-11',
    actor: 'Elena Novak',
    action: 'archived',
    target: 'Card Controls Test Plan',
    at: hoursAgo(34),
    kind: 'edit',
  },
  {
    id: 'act-12',
    actor: 'Marcus Lee',
    action: 'created',
    target: 'Checkout Test Cases — Guest Flow (12 cases)',
    at: hoursAgo(36),
    kind: 'create',
  },
];

/** 8 items shared with the team (2 projects, 3 conversations, 3 documents). */
export const SHARED_SEED: SharedItem[] = [
  {
    id: 'shr-01',
    kind: 'project',
    title: 'E-commerce Website',
    project: 'E-commerce Website',
    members: ['You (demo owner)', 'Elena Novak', 'Marcus Lee', 'Priya Nair', 'Daniel Kim', 'Sofia Reyes'],
    updatedAt: hoursAgo(2),
  },
  {
    id: 'shr-02',
    kind: 'project',
    title: 'Banking App — Mobile',
    project: 'Banking App — Mobile',
    members: ['You (demo owner)', 'Elena Novak', 'Marcus Lee', 'Daniel Kim'],
    updatedAt: hoursAgo(26),
  },
  {
    id: 'shr-03',
    kind: 'conversation',
    title: 'Login Bug Report',
    project: 'E-commerce Website',
    members: ['Priya Nair', 'Marcus Lee', 'You (demo owner)', 'Elena Novak'],
    updatedAt: hoursAgo(1),
  },
  {
    id: 'shr-04',
    kind: 'conversation',
    title: 'Payment Test Plan',
    project: 'E-commerce Website',
    members: ['You (demo owner)', 'Marcus Lee', 'Elena Novak', 'Sofia Reyes', 'Priya Nair'],
    updatedAt: hoursAgo(6),
  },
  {
    id: 'shr-05',
    kind: 'conversation',
    title: 'Onboarding Test Cases',
    project: 'Banking App — Mobile',
    members: ['Marcus Lee', 'Elena Novak', 'Daniel Kim'],
    updatedAt: hoursAgo(4),
  },
  {
    id: 'shr-06',
    kind: 'document',
    title: 'Payment & Checkout Test Plan',
    project: 'E-commerce Website',
    members: ['Marcus Lee', 'Elena Novak', 'You (demo owner)'],
    updatedAt: hoursAgo(3),
  },
  {
    id: 'shr-07',
    kind: 'document',
    title: 'BUG-104 — Payment gateway timeout',
    project: 'E-commerce Website',
    members: ['Priya Nair', 'Daniel Kim', 'Marcus Lee'],
    updatedAt: hoursAgo(1),
  },
  {
    id: 'shr-08',
    kind: 'document',
    title: 'Checkout Test Cases — Guest Flow',
    project: 'E-commerce Website',
    members: ['Marcus Lee', 'Sofia Reyes', 'You (demo owner)', 'Priya Nair', 'Elena Novak'],
    updatedAt: hoursAgo(10),
  },
];
