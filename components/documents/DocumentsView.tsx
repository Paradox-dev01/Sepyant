'use client';

// ============================================================================
// [SEPYANT 2.0] Documents list view (Phase 3). One component serves all three
// QA-library routes via the `scope` prop: bug reports, test plans & cases,
// reports & documentation. Rows come from the localStorage-backed mock store
// (seeded with lib/qa-mock/documents.ts) and support open / copy-as-markdown /
// rename / download / delete with toast feedback.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bug, ClipboardList, Ellipsis, FileText, Inbox, MessageSquare, type LucideIcon } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import {
  DOC_STATUS_META,
  DOC_TYPE_META,
  DOCUMENTS_KEY,
  DOCUMENTS_SEED,
  docFilename,
  documentToMarkdown,
  registerDocsForPalette,
  type DocType,
  type QaDocument,
} from '@/lib/qa-mock/documents';
import { copyText, downloadText, relTime, useMockStore } from '@/lib/mock-store';
import { toast } from '@/components/shell/Toast';
import AppShell from '@/components/shell/AppShell';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  Field,
  IconBtn,
  inputStyle,
  Menu,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  FilterChips,
} from '@/components/shell/bits';

// ------------------------------------------------------------------ config

export type DocumentsScope = 'bug-reports' | 'test-plans' | 'reports';

const SCOPE_CONFIG: Record<
  DocumentsScope,
  { title: string; description: string; icon: LucideIcon; types: DocType[]; emptyTitle: string; emptyBody: string }
> = {
  'bug-reports': {
    title: 'Bug reports',
    description: 'Structured bug-report documents with severity, environment, repro steps and expected-vs-actual outcomes — exported straight from QA triage.',
    icon: Bug,
    types: ['bug-report'],
    emptyTitle: 'No bug reports yet',
    emptyBody: 'Bug reports created from triage conversations will land here as structured, exportable documents.',
  },
  'test-plans': {
    title: 'Test plans & cases',
    description: 'Test plans with objectives, scope, strategy and exit criteria, plus executable test-case sets ready for assignment and runs.',
    icon: ClipboardList,
    types: ['test-plan', 'test-case-set'],
    emptyTitle: 'No test plans or cases yet',
    emptyBody: 'Generated test plans and their test-case sets are filed here as living, reviewable documents.',
  },
  reports: {
    title: 'Reports & documentation',
    description: 'Execution summaries, regression impact analyses and technical documentation produced from your QA workspace.',
    icon: FileText,
    types: ['execution-summary', 'tech-doc', 'regression-report'],
    emptyTitle: 'No reports or docs yet',
    emptyBody: 'Execution summaries, regression reports and tech docs will be collected here as your releases progress.',
  },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in-review', label: 'In review' },
  { value: 'final', label: 'Final' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

// ------------------------------------------------------------------- view

export default function DocumentsView({ scope, userEmail, projects }: { scope: DocumentsScope; userEmail: string; projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const config = SCOPE_CONFIG[scope];
  const ScopeIcon = config.icon;

  const [docs, setDocs] = useMockStore<QaDocument[]>(DOCUMENTS_KEY, DOCUMENTS_SEED);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Register documents for the sidebar command palette (reads window.__SEPYANT_DOCS__).
  useEffect(() => {
    registerDocsForPalette(docs);
  }, [docs]);

  const scopeDocs = useMemo(() => docs.filter((d) => config.types.includes(d.type)), [docs, config.types]);

  const projectOptions = useMemo(() => {
    const names = Array.from(new Set(scopeDocs.map((d) => d.project))).sort((a, b) => a.localeCompare(b));
    return [{ value: 'all', label: 'All projects' }, ...names.map((n) => ({ value: n, label: n }))];
  }, [scopeDocs]);

  // Search + project filter first; status counts are computed on that set.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopeDocs.filter((d) => {
      const matchesQuery = !q || d.title.toLowerCase().includes(q) || d.project.toLowerCase().includes(q);
      const matchesProject = projectFilter === 'all' || d.project === projectFilter;
      return matchesQuery && matchesProject;
    });
  }, [scopeDocs, query, projectFilter]);

  const statusCounts = useMemo(
    () => ({
      all: searched.length,
      draft: searched.filter((d) => d.status === 'draft').length,
      'in-review': searched.filter((d) => d.status === 'in-review').length,
      final: searched.filter((d) => d.status === 'final').length,
    }),
    [searched]
  );

  const visible = useMemo(
    () =>
      searched
        .filter((d) => statusFilter === 'all' || d.status === statusFilter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [searched, statusFilter]
  );

  const clearFilters = () => {
    setQuery('');
    setProjectFilter('all');
    setStatusFilter('all');
  };

  // ------------------------------------------------------------- actions

  const copyMd = async (doc: QaDocument) => {
    const ok = await copyText(documentToMarkdown(doc));
    toast(ok ? `Copied "${doc.title}" as Markdown` : 'Could not access the clipboard', ok ? 'success' : 'error');
  };
  const downloadMd = (doc: QaDocument) => {
    downloadText(docFilename(doc), documentToMarkdown(doc), 'text/markdown;charset=utf-8');
    toast('Markdown file downloaded', 'success');
  };
  const openRename = (doc: QaDocument) => setRename({ id: doc.id, title: doc.title });
  const confirmRename = () => {
    if (!rename) return;
    const title = rename.title.trim();
    if (!title) {
      toast('Title cannot be empty', 'error');
      return;
    }
    setDocs((prev) => prev.map((d) => (d.id === rename.id ? { ...d, title } : d)));
    toast('Document renamed', 'success');
    setRename(null);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    toast('Document deleted', 'success');
    setDeleteTarget(null);
  };

  // -------------------------------------------------------------- render

  return (
    <AppShell activeView={scope} userEmail={userEmail} projects={projects}>
      <PageHeader
        icon={<ScopeIcon size={17} />}
        title={config.title}
        description={config.description}
      />

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search title or project…" />
        <Select value={projectFilter} onChange={setProjectFilter} ariaLabel="Filter by project" options={projectOptions} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <FilterChips
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          ariaLabel="Filter by status"
          options={STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label, count: statusCounts[s.value] }))}
        />
      </div>

      {/* list */}
      {scopeDocs.length === 0 ? (
        <EmptyState
          icon={<Inbox size={30} />}
          title={config.emptyTitle}
          body={config.emptyBody}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox size={30} />}
          title="No documents match your filters"
          body="Try a different search term, project or status — or clear the filters."
          action={
            <Button onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="list" aria-label={`${config.title} documents`}>
          {visible.map((doc) => {
            const typeMeta = DOC_TYPE_META[doc.type];
            const statusMeta = DOC_STATUS_META[doc.status];
            const TypeIcon = typeMeta.icon;
            return (
              <div
                key={doc.id}
                role="listitem"
                style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}
              >
                {/* clickable main area (title → document) */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open document ${doc.title}`}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/documents/${doc.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220, cursor: 'pointer', padding: '4px 0', borderRadius: 8, transition: 'opacity 120ms ease', background: 'transparent', border: 'none', textAlign: 'left', color: 'inherit' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: alpha(typeMeta.color, 8),
                      border: `1px solid ${alpha(typeMeta.color, 27)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <TypeIcon size={15} color={typeMeta.color} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.title}</span>
                      <Chip color={typeMeta.color}>{typeMeta.label}</Chip>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.fgMuted, marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.project}</div>
                  </div>
                </div>

                {/* meta cluster */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.fgMuted, maxWidth: 150 }}>
                    <Avatar name={doc.owner} size={20} />
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.owner}</span>
                  </span>
                  <Chip color={statusMeta.color}>{statusMeta.label}</Chip>
                  <span
                    title={`${doc.comments.length} comment${doc.comments.length === 1 ? '' : 's'}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.fgMuted, fontFamily: 'var(--font-mono)' }}
                  >
                    <MessageSquare size={12} aria-hidden="true" />
                    {doc.comments.length}
                  </span>
                  <span suppressHydrationWarning style={{ fontSize: 10.5, color: C.fgMuted, minWidth: 56, textAlign: 'right' }}>
                    {relTime(doc.updatedAt)}
                  </span>
                  {/* stopPropagation so menu interactions never trigger row navigation */}
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Menu
                      trigger={(open) => (
                        <button
                          aria-label={`Actions for ${doc.title}`}
                          aria-haspopup="menu"
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 8,
                            border: 'none',
                            background: open ? C.surface2 : 'transparent',
                            color: C.fgMuted,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 120ms ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = open ? C.surface2 : 'transparent')}
                        >
                          <Ellipsis size={16} />
                        </button>
                      )}
                      items={[
                        { label: 'Open', onSelect: () => router.push(`/documents/${doc.id}`) },
                        { label: 'Copy as Markdown', onSelect: () => void copyMd(doc) },
                        { label: 'Rename…', onSelect: () => openRename(doc) },
                        { label: 'Download .md', onSelect: () => downloadMd(doc) },
                        { label: 'Delete…', onSelect: () => setDeleteTarget({ id: doc.id, title: doc.title }), danger: true },
                      ]}
                    />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rename && (
        <Modal title="Rename document" onClose={() => setRename(null)}>
          <Field label="Title">
            <input
              style={inputStyle}
              value={rename.title}
              aria-label="Document title"
              autoFocus
              onChange={(e) => setRename({ ...rename, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename();
              }}
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => setRename(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmRename}>
              Save
            </Button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete document" onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 12.5, color: C.fgDim, lineHeight: 1.55, margin: '0 0 4px' }}>
            Delete <span style={{ color: C.fg, fontWeight: 600 }}>{deleteTarget.title}</span>? This removes it from the library (comments included). The action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete document
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
