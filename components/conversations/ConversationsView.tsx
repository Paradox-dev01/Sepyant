'use client';

// ============================================================================
// [SEPYANT 2.0] Conversations list (Phase 2 — conversation & project
// management). Searchable, filterable, grouped by project; supports
// pin / archive / rename / delete and creating new conversations. All state
// persists client-side via the mock store — no backend calls.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Bug,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  ListChecks,
  MessageSquare,
  Pin,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppShell from '@/components/shell/AppShell';
import { Button, Chip, EmptyState, Field, FilterChips, IconBtn, Menu, Modal, PageHeader, SearchInput, Select, inputStyle } from '@/components/shell/bits';
import { toast } from '@/components/shell/Toast';
import { relTime, uid, useMockStore } from '@/lib/mock-store';
import { CATEGORIES, CATEGORY_META, CONVERSATIONS_KEY, CONVERSATIONS_SEED, CONVERSATION_PROJECTS, type Category, type Conversation } from '@/lib/qa-mock/conversations';

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  'Bug Reports': Bug,
  'Test Plans': ClipboardList,
  'Test Cases': ListChecks,
  Documentation: FileText,
  'Regression Testing': History,
};

type ViewFilter = 'active' | 'archived';

export default function ConversationsView({
  userEmail,
  projects,
}: {
  userEmail: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useMockStore<Conversation[]>(CONVERSATIONS_KEY, CONVERSATIONS_SEED);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [view, setView] = useState<ViewFilter>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState(CONVERSATION_PROJECTS[0].id);
  const [newCategory, setNewCategory] = useState<Category>('Test Cases');

  // Support "New conversation" deep link from the command palette.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('new=1')) {
      setCreateOpen(true);
      window.history.replaceState({}, '', '/conversations');
    }
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => (view === 'archived' ? c.archived : !c.archived))
      .filter((c) => projectFilter === 'all' || c.projectId === projectFilter)
      .filter((c) => categoryFilter === 'all' || c.category === categoryFilter)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((msg) => msg.content.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [conversations, query, projectFilter, categoryFilter, view]);

  const grouped = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    visible.forEach((c) => {
      const list = map.get(c.projectName) || [];
      list.push(c);
      map.set(c.projectName, list);
    });
    return Array.from(map.entries());
  }, [visible]);

  const counts = useMemo(() => {
    const byCat: Record<string, number> = { all: conversations.filter((c) => !c.archived).length };
    CATEGORIES.forEach((cat) => {
      byCat[cat] = conversations.filter((c) => c.category === cat && !c.archived).length;
    });
    return byCat;
  }, [conversations]);

  const projectOptions = useMemo(() => {
    const fromSeeds = CONVERSATION_PROJECTS.map((p) => ({ value: p.id, label: p.name }));
    const seedNames = new Set(CONVERSATION_PROJECTS.map((p) => p.name));
    const fromServer = projects.filter((p) => !seedNames.has(p.name)).map((p) => ({ value: p.id, label: p.name }));
    return [...fromSeeds, ...fromServer];
  }, [projects]);

  const projectNameOf = (id: string): string => projectOptions.find((o) => o.value === id)?.label || id;

  function createConversation() {
    const title = newTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: uid('conv'),
      projectId: newProject,
      projectName: projectNameOf(newProject),
      title,
      category: newCategory,
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setCreateOpen(false);
    setNewTitle('');
    toast('Conversation created', 'success');
    router.push(`/conversations/${conv.id}`);
  }

  function setPinned(conv: Conversation, pinned: boolean) {
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, pinned, updatedAt: c.updatedAt } : c)));
    toast(pinned ? 'Pinned to top' : 'Unpinned', 'info');
  }

  function setArchived(conv: Conversation, archived: boolean) {
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, archived, pinned: archived ? false : c.pinned } : c)));
    toast(archived ? 'Moved to archive' : 'Restored from archive', 'info');
  }

  function rename() {
    if (!renaming) return;
    const title = renameValue.trim();
    if (!title) return;
    setConversations((prev) => prev.map((c) => (c.id === renaming.id ? { ...c, title } : c)));
    setRenaming(null);
    toast('Conversation renamed', 'success');
  }

  function remove() {
    if (!deleting) return;
    setConversations((prev) => prev.filter((c) => c.id !== deleting.id));
    setDeleting(null);
    toast('Conversation deleted', 'info');
  }

  const lastLine = (c: Conversation): string => {
    const last = c.messages[c.messages.length - 1];
    if (!last) return 'No messages yet — open to start the thread.';
    const firstLine = last.content.split('\n')[0].replace(/\*\*(.+?)\*\*/g, '$1');
    return `${last.role === 'assistant' ? '✦ ' : ''}${firstLine.length > 96 ? `${firstLine.slice(0, 96)}…` : firstLine}`;
  };

  return (
    <AppShell activeView="conversations" userEmail={userEmail} projects={projects}>
      <PageHeader
        icon={<MessageSquare size={17} />}
        title="Conversations"
        description="Every QA discussion organised by project and category — bug reports, test plans, generated cases, documentation and regression scopes. Pinned threads stay on top."
        right={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New conversation
          </Button>
        }
      />

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search titles and messages…" />
        <Select
          value={projectFilter}
          onChange={setProjectFilter}
          ariaLabel="Filter by project"
          options={[{ value: 'all', label: 'All projects' }, ...projectOptions.map((p) => ({ value: p.value, label: p.label }))]}
        />
        <FilterChips
          value={view}
          onChange={(v) => setView(v as ViewFilter)}
          ariaLabel="Archive filter"
          options={[
            { value: 'active', label: 'Active', count: conversations.filter((c) => !c.archived).length },
            { value: 'archived', label: 'Archived', count: conversations.filter((c) => c.archived).length },
          ]}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <FilterChips
          value={categoryFilter}
          onChange={setCategoryFilter}
          ariaLabel="Filter by category"
          options={[{ value: 'all', label: 'All categories', count: counts.all }, ...CATEGORIES.map((cat) => ({ value: cat, label: cat, count: counts[cat] }))]}
        />
      </div>

      {/* list */}
      {visible.length === 0 ? (
        conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={30} />}
            title="No conversations yet"
            body="Start a conversation to plan tests, triage bugs or generate cases. Threads stay organised per project and category."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus size={14} /> New conversation
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<MessageSquare size={30} />}
            title={view === 'archived' ? 'Nothing archived' : 'No conversations match your filters'}
            body={view === 'archived' ? 'Archived conversations will appear here when you archive them.' : 'Try a different search term, project or category — or clear the filters.'}
            action={
              <Button
                onClick={() => {
                  setQuery('');
                  setProjectFilter('all');
                  setCategoryFilter('all');
                  setView('active');
                }}
              >
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map(([projectName, items]) => (
            <section key={projectName} aria-label={projectName}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.fgMuted, fontFamily: 'var(--font-mono)' }}>{projectName}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: C.fgMuted }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((c) => {
                  const Icon = CATEGORY_ICON[c.category];
                  const color = CATEGORY_META[c.category].color;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open conversation ${c.title}`}
                      onClick={() => router.push(`/conversations/${c.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && router.push(`/conversations/${c.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 120ms ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.muted)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                    >
                      <span style={{ width: 30, height: 30, borderRadius: 8, background: alpha(color, 8), border: `1px solid ${alpha(color, 27)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={15} color={color} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {c.pinned && <Pin size={11} color={C.warning} aria-label="Pinned" />}
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.title}</span>
                          <Chip color={color}>{c.category}</Chip>
                        </div>
                        <div style={{ fontSize: 11.5, color: C.fgMuted, marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{lastLine(c)}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span suppressHydrationWarning style={{ fontSize: 10.5, color: C.fgMuted }}>
                          {relTime(c.updatedAt)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C.fgMuted }}>
                          {c.messages.length} {c.messages.length === 1 ? 'msg' : 'msgs'}
                        </span>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                        <Menu
                          trigger={() => (
                            <IconBtn label={`Actions for ${c.title}`}>
                              <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
                            </IconBtn>
                          )}
                          items={[
                            { label: 'Open', onSelect: () => router.push(`/conversations/${c.id}`) },
                            c.pinned
                              ? { label: 'Unpin', onSelect: () => setPinned(c, false) }
                              : { label: 'Pin to top', onSelect: () => setPinned(c, true) },
                            c.archived
                              ? { label: 'Restore from archive', onSelect: () => setArchived(c, false) }
                              : { label: 'Archive', onSelect: () => setArchived(c, true) },
                            {
                              label: 'Rename…',
                              onSelect: () => {
                                setRenaming(c);
                                setRenameValue(c.title);
                              },
                            },
                            { label: 'Delete…', danger: true, onSelect: () => setDeleting(c) },
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {view === 'active' && (
            <button
              onClick={() => setView('archived')}
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.fgMuted, fontSize: 11.5, cursor: 'pointer', padding: 4 }}
            >
              <Archive size={12} /> View archived ({conversations.filter((c) => c.archived).length})
            </button>
          )}
          {view === 'archived' && (
            <button
              onClick={() => setView('active')}
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.fgMuted, fontSize: 11.5, cursor: 'pointer', padding: 4 }}
            >
              <ArchiveRestore size={12} /> Back to active conversations
            </button>
          )}
        </div>
      )}

      {/* create modal */}
      {createOpen && (
        <Modal title="New conversation" onClose={() => setCreateOpen(false)}>
          <Field label="Title">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Payment edge cases" aria-label="Conversation title" style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && createConversation()} />
          </Field>
          <Field label="Project">
            <Select value={newProject} onChange={setNewProject} ariaLabel="Conversation project" options={projectOptions} width="100%" />
          </Field>
          <Field label="Category">
            <Select value={newCategory} onChange={(v) => setNewCategory(v as Category)} ariaLabel="Conversation category" options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))} width="100%" />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createConversation} disabled={!newTitle.trim()}>
              Create & open
            </Button>
          </div>
        </Modal>
      )}

      {/* rename modal */}
      {renaming && (
        <Modal title="Rename conversation" onClose={() => setRenaming(null)}>
          <Field label="Title">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && rename()}
              aria-label="Conversation title"
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button variant="primary" onClick={rename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </div>
        </Modal>
      )}

      {/* delete confirm */}
      {deleting && (
        <Modal title="Delete conversation?" onClose={() => setDeleting(null)} width={400}>
          <p style={{ fontSize: 12.5, color: C.fgDim, lineHeight: 1.55, margin: '0 0 16px' }}>
            “{deleting.title}” and its {deleting.messages.length} message{deleting.messages.length === 1 ? '' : 's'} will be removed from this demo workspace. This cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={13} /> Delete
            </Button>
          </div>
        </Modal>
      )}

    </AppShell>
  );
}
