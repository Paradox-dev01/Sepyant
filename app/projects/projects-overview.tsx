'use client';

// ============================================================================
// [SEPYANT 2.0] Projects overview (Phase 2 — create & organise projects,
// switch between projects easily). Shows every project as a card with its
// 2.0 activity (conversation counts from the mock store) plus the existing
// create-project form. The three-panel workspace itself is untouched —
// "Open workspace" navigates into it.
// ============================================================================

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, MessageSquare, Plus } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppShell from '@/components/shell/AppShell';
import { Button, EmptyState, PageHeader } from '@/components/shell/bits';
import { fmtDate, useMockStore } from '@/lib/mock-store';
import { CONVERSATIONS_KEY, CONVERSATIONS_SEED, CONVERSATION_PROJECTS, type Conversation } from '@/lib/qa-mock/conversations';
import NewProjectForm from './new-project-form';

type ProjectRow = { id: string; name: string; created_at?: string | null; description?: string | null };

function blurbFor(name: string): string {
  const lower = name.toLowerCase();
  const seed = CONVERSATION_PROJECTS.find((p) => lower.startsWith(p.name.toLowerCase()) || p.name.toLowerCase().startsWith(lower));
  return seed?.blurb || 'QA workspace project — conversations, documents and test assets live here.';
}

function seedProjectNameFor(name: string): string | null {
  const lower = name.toLowerCase();
  const seed = CONVERSATION_PROJECTS.find((p) => lower.startsWith(p.name.toLowerCase()) || p.name.toLowerCase().startsWith(lower));
  return seed?.name || null;
}

export default function ProjectsOverview({
  userEmail,
  projects,
}: {
  userEmail: string;
  projects: ProjectRow[];
}) {
  const router = useRouter();
  const [conversations] = useMockStore<Conversation[]>(CONVERSATIONS_KEY, CONVERSATIONS_SEED);

  const cards = useMemo(
    () =>
      projects.map((p) => {
        const seedName = seedProjectNameFor(p.name);
        const convCount = conversations.filter((c) => (seedName ? c.projectName === seedName || c.projectName === p.name : c.projectName === p.name)).length;
        return { ...p, convCount, blurb: blurbFor(p.name) };
      }),
    [projects, conversations]
  );

  return (
    <AppShell activeView="projects" userEmail={userEmail} projects={projects.map((p) => ({ id: p.id, name: p.name }))}>
      <PageHeader
        icon={<FolderKanban size={17} />}
        title="Projects"
        description="Create and organise QA projects, then switch between them from the sidebar at any time. Each project keeps its own conversations, documents and quality analytics."
      />

      {projects.length === 0 ? (
        <div style={{ maxWidth: 420, margin: '48px auto 0', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: alpha(C.accent, 12), border: `1px solid ${alpha(C.accent, 27)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <span style={{ color: C.accent, fontSize: 14, fontWeight: 700 }}>S</span>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 650, color: C.fg, margin: '0 0 6px' }}>Welcome to Sepyant</h2>
          <p style={{ fontSize: 12.5, color: C.fgMuted, margin: '0 0 18px', lineHeight: 1.55 }}>Create your first project to get started.</p>
          <CreateCard />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
          <CreateCard inGrid />
          {cards.map((p) => (
            <div
              key={p.id}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 148 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: alpha(C.accent, 8), border: `1px solid ${alpha(C.accent, 27)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderKanban size={15} color={C.accent} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: C.fg, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={p.name}>
                    {p.name}
                  </div>
                  {p.created_at && (
                    <span suppressHydrationWarning style={{ fontSize: 10.5, color: C.fgMuted }}>
                      created {fmtDate(p.created_at)}
                    </span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: C.fgMuted, lineHeight: 1.5, margin: 0, flex: 1 }}>{p.blurb}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: C.fgMuted }}>
                  <MessageSquare size={11} /> {p.convCount} {p.convCount === 1 ? 'conversation' : 'conversations'}
                </span>
                <Button small onClick={() => router.push(`/projects/${p.id}`)} ariaLabel={`Open workspace for ${p.name}`}>
                  Open workspace
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects.length === 0 && (
        <div style={{ marginTop: 28 }}>
          <EmptyState
            icon={<FolderKanban size={28} />}
            title="Why projects?"
            body="Projects group everything Sepyant generates for one product: conversations, bug reports, test plans, cases, automation scripts and analytics."
          />
        </div>
      )}
    </AppShell>
  );
}

function CreateCard({ inGrid }: { inGrid?: boolean }) {
  return (
    <div
      style={{
        background: inGrid ? C.surface : 'transparent',
        border: inGrid ? `1px dashed ${C.muted}` : 'none',
        borderRadius: 10,
        padding: inGrid ? '16px' : 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: inGrid ? 148 : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: C.fgDim, marginBottom: 10 }}>
        <Plus size={14} /> New project
      </div>
      <NewProjectFormSlot />
    </div>
  );
}

function NewProjectFormSlot() {
  // The original creation form (dev-bypass aware) is reused verbatim.
  return <NewProjectForm />;
}
