'use client';

// ============================================================================
// [SEPYANT 2.0] Team collaboration (Phase 6 — simulated). Members with roles,
// a team activity timeline and the "shared with team" grid. Everything is
// frontend-only demo data: role changes, invites and removals persist to the
// client-side mock store and always toast honest feedback — no real auth or
// permissions are involved anywhere.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Copy,
  Crown,
  FileText,
  FolderKanban,
  History,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppShell from '@/components/shell/AppShell';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  Field,
  IconBtn,
  Menu,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  inputStyle,
} from '@/components/shell/bits';
import { toast } from '@/components/shell/Toast';
import { copyText, fmtDate, relTime, uid, useMockStore } from '@/lib/mock-store';
import {
  ACTIVITY_KEY,
  ACTIVITY_SEED,
  DEFAULT_TITLE,
  ROLES,
  ROLE_META,
  SHARED_SEED,
  TEAM_KEY,
  TEAM_SEED,
  type ActivityEvent,
  type ActivityKind,
  type Member,
  type Role,
  type SharedKind,
} from '@/lib/qa-mock/team';

// ------------------------------------------------------------------ meta
const YOU = 'You (demo owner)';

const KIND_META: Record<ActivityKind, { Icon: LucideIcon; color: string }> = {
  comment: { Icon: MessageSquare, color: C.accent },
  edit: { Icon: Pencil, color: C.warning },
  invite: { Icon: UserPlus, color: C.success },
  approve: { Icon: ShieldCheck, color: C.ai },
  create: { Icon: Plus, color: C.accent },
  role: { Icon: Briefcase, color: C.danger },
};

const SHARED_META: Record<SharedKind, { Icon: LucideIcon; color: string; route: string }> = {
  project: { Icon: FolderKanban, color: C.accent, route: '/projects' },
  conversation: { Icon: MessageSquare, color: C.success, route: '/conversations' },
  document: { Icon: FileText, color: C.ai, route: '/bug-reports' },
};

type TabKey = 'members' | 'activity' | 'shared';

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: C.fgMuted,
  fontFamily: 'var(--font-mono)',
};

/** matchMedia-based breakpoint hook (inline styles have no media queries). */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

export default function TeamView({
  userEmail,
  projects,
}: {
  userEmail: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const narrow = useIsNarrow();

  const [members, setMembers] = useMockStore<Member[]>(TEAM_KEY, TEAM_SEED);
  const [activity, setActivity] = useMockStore<ActivityEvent[]>(ACTIVITY_KEY, ACTIVITY_SEED);

  const [tab, setTab] = useState<TabKey>('members');
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Editor');
  const [inviteError, setInviteError] = useState('');
  const [removing, setRemoving] = useState<Member | null>(null);

  // ----------------------------------------------------------- derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, query]);

  const events = useMemo(() => [...activity].sort((a, b) => b.at.localeCompare(a.at)), [activity]);

  const roleOptions = ROLES.map((r) => ({ value: r, label: r }));
  // Inviting a second Owner makes no sense — the Owner is the seeded demo member.
  const inviteRoleOptions = ROLES.filter((r) => r !== 'Owner').map((r) => ({ value: r, label: r }));

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'members', label: 'Members', count: members.length },
    { key: 'activity', label: 'Activity', count: activity.length },
    { key: 'shared', label: 'Shared', count: SHARED_SEED.length },
  ];

  // ----------------------------------------------------------- actions
  function openInvite() {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Editor');
    setInviteError('');
    setInviteOpen(true);
  }

  function submitInvite() {
    const name = inviteName.trim();
    const email = inviteEmail.trim();
    if (!name) return;
    if (!email.includes('@')) {
      setInviteError('Enter a valid email — it must contain “@”.');
      return;
    }
    const now = new Date().toISOString();
    const member: Member = {
      id: uid('mem'),
      name,
      email,
      role: inviteRole,
      title: DEFAULT_TITLE[inviteRole],
      joinedAt: now,
      lastActiveAt: now,
    };
    setMembers((prev) => [member, ...prev]);
    const event: ActivityEvent = {
      id: uid('act'),
      actor: YOU,
      action: 'invited',
      target: `${name} (${inviteRole})`,
      at: now,
      kind: 'invite',
    };
    setActivity((prev) => [event, ...prev]);
    setInviteOpen(false);
    toast('Invite sent — demo only', 'success');
  }

  function changeRole(m: Member, next: string) {
    if (!(ROLES as readonly string[]).includes(next) || next === m.role) return;
    const role = next as Role;
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
    const event: ActivityEvent = {
      id: uid('act'),
      actor: YOU,
      action: 'changed the role of',
      target: `${m.name} → ${role}`,
      at: new Date().toISOString(),
      kind: 'role',
    };
    setActivity((prev) => [event, ...prev]);
    toast('Role updated — demo only, no real permissions changed', 'info');
  }

  async function copyEmail(m: Member) {
    const ok = await copyText(m.email);
    toast(ok ? `Copied ${m.email} — demo only` : 'Copy failed — clipboard unavailable', ok ? 'success' : 'error');
  }

  function confirmRemove() {
    if (!removing || removing.role === 'Owner') return;
    setMembers((prev) => prev.filter((x) => x.id !== removing.id));
    toast(`Removed ${removing.name} — demo only, no real access changed`, 'info');
    setRemoving(null);
  }

  // ------------------------------------------------------------- rows
  const memberMenu = (m: Member) => (
    <Menu
      trigger={() => (
        <IconBtn label={`Actions for ${m.name}`}>
          <MoreHorizontal size={15} />
        </IconBtn>
      )}
      items={[
        { label: 'Copy email', onSelect: () => void copyEmail(m) },
        {
          label: 'Remove member…',
          danger: true,
          disabled: m.role === 'Owner',
          onSelect: () => setRemoving(m),
        },
      ]}
    />
  );

  const ownerChip = (m: Member) =>
    m.role === 'Owner' ? (
      <Chip color={C.warning} title="The owner cannot be removed">
        <Crown size={10} /> Owner
      </Chip>
    ) : null;

  const lastActiveCell = (m: Member) => (
    <span
      suppressHydrationWarning
      title={`Joined ${fmtDate(m.joinedAt)} · demo data`}
      style={{ fontSize: 11.5, color: C.fgMuted, whiteSpace: 'nowrap' }}
    >
      {relTime(m.lastActiveAt)}
    </span>
  );

  // ------------------------------------------------------------ render
  return (
    <AppShell activeView="team" userEmail={userEmail} projects={projects}>
      <PageHeader
        icon={<Users size={17} />}
        title="Team collaboration"
        description="Invite teammates, assign roles and follow QA activity — demo data, no real permissions enforced."
        right={
          <Button variant="primary" onClick={openInvite}>
            <UserPlus size={14} /> Invite member
          </Button>
        }
      />

      {/* tabs — same treatment as the dashboard tabs */}
      <div
        role="tablist"
        aria-label="Team sections"
        style={{
          display: 'inline-flex',
          gap: 2,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 9,
          padding: 3,
          marginBottom: 18,
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`team-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`team-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              padding: '8px 14px',
              borderRadius: 6,
              border: tab === t.key ? `1px solid ${C.border}` : '1px solid transparent',
              background: tab === t.key ? C.surface2 : 'transparent',
              color: tab === t.key ? C.fg : C.fgMuted,
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 500,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: tab === t.key ? C.accent : C.fgMuted }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ members panel */}
      {tab === 'members' && (
        <div role="tabpanel" id="team-panel-members" aria-labelledby="team-tab-members">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Search members by name or email…" />
            <span style={{ ...labelStyle }}>
              {filtered.length} of {members.length} shown
            </span>
          </div>

          {members.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No members yet"
              body="Invite teammates to simulate how your QA team collaborates on projects, conversations and documents."
              action={
                <Button variant="primary" onClick={openInvite}>
                  <UserPlus size={14} /> Invite member
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No members match"
              body="Try a different name or email — or clear the search to see the whole demo team."
              action={<Button onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : narrow ? (
            /* ---- stacked member cards (below 768px) ---- */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {filtered.map((m) => (
                <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Avatar name={m.name} size={32} color={m.avatarColor} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflowWrap: 'anywhere' }}>{m.name}</span>
                        {ownerChip(m)}
                      </div>
                      <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 2, overflowWrap: 'anywhere' }}>{m.email}</div>
                    </div>
                    {memberMenu(m)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ ...labelStyle }}>Role</span>
                      <Select value={m.role} onChange={(v) => changeRole(m, v)} ariaLabel={`Role for ${m.name}`} options={roleOptions} width={150} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ ...labelStyle }}>Title</span>
                      <span style={{ fontSize: 12, color: C.fgDim, textAlign: 'right' }}>{m.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ ...labelStyle }}>Last active</span>
                      {lastActiveCell(m)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ---- table layout (desktop) ---- */
            <div role="table" aria-label="Team members" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '4px 18px 8px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px, 1.5fr) 160px minmax(110px, 1fr) 120px 44px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 0 8px',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span style={{ ...labelStyle }}>Member</span>
                <span style={{ ...labelStyle }}>Role</span>
                <span style={{ ...labelStyle }}>Title</span>
                <span style={{ ...labelStyle }}>Last active</span>
                <span />
              </div>
              {filtered.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(210px, 1.5fr) 160px minmax(110px, 1fr) 120px 44px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '11px 0',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar name={m.name} size={30} color={m.avatarColor} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        {ownerChip(m)}
                      </div>
                      <div style={{ fontSize: 11, color: C.fgMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                    </div>
                  </div>
                  <div>
                    <Select value={m.role} onChange={(v) => changeRole(m, v)} ariaLabel={`Role for ${m.name}`} options={roleOptions} width={150} />
                  </div>
                  <div style={{ fontSize: 12, color: C.fgDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.title}>
                    {m.title}
                  </div>
                  <div>{lastActiveCell(m)}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{memberMenu(m)}</div>
                </div>
              ))}
            </div>
          )}

          {/* role legend — tooltips carry the demo-only capability blurbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {ROLES.map((r) => (
              <Chip key={r} color={ROLE_META[r].color} title={ROLE_META[r].blurb}>
                {r}
              </Chip>
            ))}
            <span style={{ fontSize: 11, color: C.fgMuted }}>Roles are demo-only — no real permissions are enforced.</span>
          </div>
        </div>
      )}

      {/* ----------------------------------------------- activity panel */}
      {tab === 'activity' && (
        <div role="tabpanel" id="team-panel-activity" aria-labelledby="team-tab-activity">
          {events.length === 0 ? (
            <EmptyState
              icon={<History size={28} />}
              title="No activity yet"
              body="Team events (comments, edits, invites, approvals, role changes) will appear here. If you cleared the demo storage, the seeded timeline is gone until the demo data is reset."
            />
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ ...labelStyle, marginBottom: 14 }}>Team activity</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {events.map((ev, i) => {
                  const { Icon, color } = KIND_META[ev.kind];
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: alpha(color, 8),
                            border: `1px solid ${alpha(color, 27)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={13} color={color} />
                        </span>
                        {i < events.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 12, margin: '4px 0', background: C.border }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingBottom: 16 }}>
                        <p style={{ margin: 0, paddingTop: 4, fontSize: 12.5, color: C.fgDim, lineHeight: 1.5 }}>
                          <strong style={{ color: C.fg, fontWeight: 600 }}>{ev.actor}</strong> {ev.action}{' '}
                          <strong style={{ color: C.fg, fontWeight: 600 }}>{ev.target}</strong>
                          {ev.kind === 'invite' && <span style={{ color: C.fgMuted }}> to the team</span>}
                        </p>
                        <span
                          suppressHydrationWarning
                          style={{ fontSize: 10.5, color: C.fgMuted, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 6 }}
                        >
                          {relTime(ev.at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------- shared panel */}
      {tab === 'shared' && (
        <div role="tabpanel" id="team-panel-shared" aria-labelledby="team-tab-shared">
          <div style={{ ...labelStyle, marginBottom: 10 }}>Shared with the team</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {SHARED_SEED.map((item) => {
              const { Icon, color, route } = SHARED_META[item.kind];
              const shown = item.members.slice(0, 4);
              const extra = item.members.length - shown.length;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${item.kind} ${item.title}`}
                  onClick={() => router.push(route)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(route)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.muted)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    cursor: 'pointer',
                    minWidth: 0,
                    transition: 'border-color 120ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: alpha(color, 8),
                        border: `1px solid ${alpha(color, 27)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={15} color={color} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.kind} · {item.project}
                      </div>
                    </div>
                    <span suppressHydrationWarning style={{ fontSize: 10.5, color: C.fgMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {relTime(item.updatedAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {shown.map((n, i) => (
                        <span
                          key={n}
                          title={n}
                          style={{ marginLeft: i === 0 ? 0 : -7, padding: 1.5, background: C.surface, borderRadius: '50%', display: 'inline-flex', position: 'relative', zIndex: shown.length - i }}
                        >
                          <Avatar name={n} size={22} />
                        </span>
                      ))}
                      {extra > 0 && (
                        <span
                          title={item.members.slice(4).join(', ')}
                          style={{ marginLeft: -7, padding: 1.5, background: C.surface, borderRadius: '50%', display: 'inline-flex', position: 'relative', zIndex: 0 }}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: C.surface2,
                              border: `1px solid ${C.border}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9.5,
                              fontWeight: 700,
                              color: C.fgMuted,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            +{extra}
                          </span>
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10.5, color: C.fgMuted }}>
                      {item.members.length} {item.members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------- invite modal */}
      {inviteOpen && (
        <Modal title="Invite member" onClose={() => setInviteOpen(false)}>
          <Field label="Name">
            <input
              autoFocus
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
              placeholder="e.g. Alex Chen"
              aria-label="Member name"
              style={inputStyle}
            />
          </Field>
          <Field label="Email">
            <input
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (inviteError) setInviteError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
              placeholder="name@company.com"
              aria-label="Member email"
              aria-invalid={!!inviteError}
              style={{ ...inputStyle, ...(inviteError ? { borderColor: C.danger } : {}) }}
            />
            {inviteError && (
              <span role="alert" style={{ display: 'block', fontSize: 11, color: C.danger, marginTop: 5 }}>
                {inviteError}
              </span>
            )}
          </Field>
          <Field label="Role">
            <Select value={inviteRole} onChange={(v) => setInviteRole(v as Role)} ariaLabel="Invite role" options={inviteRoleOptions} width="100%" />
            <span
              style={{
                display: 'block',
                marginTop: 8,
                padding: '8px 10px',
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 11,
                color: C.fgMuted,
                lineHeight: 1.55,
              }}
            >
              <span style={{ color: ROLE_META[inviteRole].color, fontWeight: 600 }}>{inviteRole}</span> — demo capabilities:
              {ROLE_META[inviteRole].can.map((line) => (
                <span key={line} style={{ display: 'block' }}>
                  · {line}
                </span>
              ))}
            </span>
          </Field>
          <p style={{ fontSize: 11, color: C.fgMuted, margin: '0 0 14px', lineHeight: 1.5 }}>
            Demo only — the invited member is simulated and stored in this browser. No email is sent and no real access is granted.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitInvite} disabled={!inviteName.trim() || !inviteEmail.trim() || !inviteEmail.includes('@')}>
              Send invite
            </Button>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------- remove confirm */}
      {removing && (
        <Modal title="Remove member?" onClose={() => setRemoving(null)} width={400}>
          <p style={{ fontSize: 12.5, color: C.fgDim, lineHeight: 1.55, margin: '0 0 16px' }}>
            “{removing.name}” will be removed from this demo team. This is simulated — no real access or permissions change.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove}>
              <Trash2 size={13} /> Remove
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
