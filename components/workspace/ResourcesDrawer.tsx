'use client';

// ============================================================================
// [SEPYANT 2.1] Project resources manager — a slide-over panel (deliberately
// NOT a modal dialog) listing the project's reusable resource collection:
// files and URLs added once, then available to every conversation and to the
// generation context picker.
//
// Demo honesty: files are read locally for previews only and never uploaded;
// URLs are validated for format and never fetched. Persistence is the 2.0
// client-side mock store (survives refreshes, per-browser).
// ============================================================================

import { useMemo, useRef, useState } from 'react';
import { Link2, Plus, Trash2, X } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import { Button } from '@/components/shell/bits';
import { toast } from '@/components/shell/Toast';
import { fmtDate, uid, useMockStore } from '@/lib/mock-store';
import { createAttachmentsFromFiles } from '@/components/workspace/composer/ResourceBar';
import {
  fileKindMeta,
  humanSize,
  normalizeUrl,
  RESOURCES_SEED,
  RESOURCE_CATEGORY_META,
  RESOURCES_KEY,
  type ProjectResource,
  type ResourceCategory,
} from '@/lib/qa-mock/resources';

export default function ResourcesDrawer({
  projectId,
  projectName,
  demoUser,
  onClose,
}: {
  projectId: string;
  projectName: string;
  demoUser: string;
  onClose: () => void;
}) {
  // One store entry holds the whole map: projectId → resources.
  const [map, setMap] = useMockStore<Record<string, ProjectResource[]>>(RESOURCES_KEY, RESOURCES_SEED);
  const resources = useMemo(() => map[projectId] || [], [map, projectId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addingUrl, setAddingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  const [busy, setBusy] = useState(false);

  function setProjectResources(next: ProjectResource[]) {
    setMap((prev) => ({ ...prev, [projectId]: next }));
  }

  async function addFiles(files: FileList | File[]) {
    setBusy(true);
    const staged = await createAttachmentsFromFiles(files);
    const valid = staged.filter((a) => a.kind === 'file' && a.status !== 'error');
    const rejected = staged.length - valid.length;
    const now = new Date().toISOString();
    const created: ProjectResource[] = valid.map((a) => {
      const att = a as Extract<typeof a, { kind: 'file' }>;
      return {
        id: uid('res'),
        projectId,
        kind: 'file',
        name: att.name,
        category: guessCategory(att.name),
        addedAt: now,
        addedBy: demoUser,
        mime: att.mime,
        size: att.size,
        excerpt: att.excerpt,
        dataUrl: att.dataUrl,
      };
    });
    if (created.length) {
      setProjectResources([...created, ...resources]);
      toast(`${created.length} file${created.length === 1 ? '' : 's'} added to project resources (demo — not uploaded)`, 'success');
    }
    if (rejected > 0) toast(`${rejected} file${rejected === 1 ? ' was' : 's were'} skipped — unsupported format or over the 10 MB demo limit`, 'error');
    setBusy(false);
  }

  function addUrl() {
    const normalized = normalizeUrl(urlDraft);
    if (!normalized) {
      setUrlError('Enter a valid URL (e.g. https://staging.example.com)');
      return;
    }
    setUrlError('');
    const now = new Date().toISOString();
    setProjectResources([
      {
        id: uid('res'),
        projectId,
        kind: 'url',
        name: normalized,
        url: normalized,
        category: guessCategory(normalized),
        addedAt: now,
        addedBy: demoUser,
        note: undefined,
      },
      ...resources,
    ]);
    setUrlDraft('');
    setAddingUrl(false);
    toast('URL added to project resources (format validated only — nothing is fetched)', 'success');
  }

  function remove(id: string) {
    setProjectResources(resources.filter((r) => r.id !== id));
    toast('Resource removed', 'info');
  }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    padding: '6px 11px',
    borderRadius: 7,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.fgDim,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      role="dialog"
      aria-label={`Project resources for ${projectName}`}
      style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(5,6,9,0.44)', display: 'flex', justifyContent: 'flex-end' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <aside
        style={{
          width: 'min(420px, calc(100vw - 24px))',
          height: '100%',
          background: C.sidebar,
          borderLeft: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-16px 0 48px rgba(0,0,0,0.4)',
        }}
        aria-label="Project resources panel"
      >
        {/* -------------------------------------------------------- header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.fg, display: 'flex', alignItems: 'center', gap: 8 }}>
              Project resources
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.warning, border: `1px solid ${alpha(C.warning, 33)}`, background: alpha(C.warning, 7), padding: '2px 6px', borderRadius: 4 }}>DEMO</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.fgMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</div>
          </div>
          <button onClick={onClose} aria-label="Close resources panel" style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* ---------------------------------------------------- add actions */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={btnStyle} disabled={busy} aria-label="Upload files to project resources">
              <Plus size={13} /> Upload files
            </button>
            <button type="button" onClick={() => setAddingUrl((v) => !v)} aria-expanded={addingUrl} style={{ ...btnStyle, borderColor: addingUrl ? C.accent : C.border, color: addingUrl ? C.accent : C.fgDim }}>
              <Link2 size={13} /> Add URL
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files?.length) void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {addingUrl && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus
                value={urlDraft}
                onChange={(e) => {
                  setUrlDraft(e.target.value);
                  setUrlError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addUrl();
                  if (e.key === 'Escape') setAddingUrl(false);
                }}
                placeholder="https://staging.example.com"
                aria-label="Resource URL"
                style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 6, border: `1px solid ${urlError ? C.danger : C.border}`, background: C.surface, color: C.fg, fontSize: 12, outline: 'none' }}
              />
              <Button small variant="primary" onClick={addUrl} ariaLabel="Add URL to project resources">
                Add
              </Button>
            </div>
          )}
          {urlError && <div role="alert" style={{ fontSize: 10.5, color: C.danger }}>{urlError}</div>}
          <div style={{ fontSize: 10.5, color: C.fgMuted, lineHeight: 1.5 }}>
            Saved once, reusable in every conversation and in generation context. Files stay in your browser (demo) — no upload; URLs are validated for format only, never fetched.
          </div>
        </div>

        {/* ----------------------------------------------------------- list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resources.length === 0 && (
            <div
              style={{
                border: `1px dashed ${C.muted}`,
                borderRadius: 10,
                padding: '28px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>No resources yet</div>
              <div style={{ fontSize: 11.5, color: C.fgMuted, lineHeight: 1.55, maxWidth: 280 }}>
                Add requirement documents, API references, design screenshots or staging URLs once — then reuse them in any conversation of this project.
              </div>
            </div>
          )}
          {resources.map((r) => {
            const meta = RESOURCE_CATEGORY_META[r.category];
            const fmeta = r.kind === 'file' ? fileKindMeta(r.name) : null;
            return (
              <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {r.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.dataUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }} />
                ) : (
                  <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 8, background: C.surface2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.fgMuted, flexShrink: 0 }}>
                    {r.kind === 'url' ? <Link2 size={14} /> : <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{(r.name.split('.').pop() || 'file').slice(0, 4)}</span>}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.fg, overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.4 }}>{r.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: meta.color, border: `1px solid ${alpha(meta.color, 27)}`, background: alpha(meta.color, 8), padding: '1px 7px', borderRadius: 999 }}>{meta.label}</span>
                    <span style={{ fontSize: 10.5, color: C.fgMuted }}>
                      {r.kind === 'url' ? 'URL' : fmeta?.label || 'File'}{r.kind === 'file' && r.size ? ` · ${humanSize(r.size)}` : ''}
                    </span>
                    {r.note && <span style={{ fontSize: 10.5, color: C.fgMuted }}>· {r.note}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 4 }}>
                    added {fmtDate(r.addedAt)} by {r.addedBy}
                  </div>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  aria-label={`Remove ${r.name} from project resources`}
                  title="Remove resource"
                  style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function guessCategory(name: string): ResourceCategory {
  const n = name.toLowerCase();
  if (/require|prd|user.?stor/.test(n)) return 'requirements';
  if (/api|swagger|openapi|postman/.test(n)) return 'api-doc';
  if (/design|mock|figma|screenshot|wireframe/.test(n) || /\.(png|jpe?g)$/.test(n)) return 'design';
  if (/spec|test.?plan/.test(n)) return 'spec';
  if (/\.(csv|tsv|xlsx?|json)$/.test(n)) return 'data';
  return 'other';
}
