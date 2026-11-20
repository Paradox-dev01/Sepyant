'use client';

// ============================================================================
// [SEPYANT 2.1] Resource input area for chat composers (workspace chat +
// conversation threads). Handles the three context channels from the brief:
//
//   A. File upload   — browse button + drag & drop, multi-file, simulated
//                      upload progress, real local previews where the browser
//                      can genuinely produce them (text excerpt / image
//                      thumbnail), removal before send, "Save to project".
//   B. URL input     — validated URL chips (format only; NOTHING is fetched —
//                      stated honestly in the UI).
//   C. Requirements  — the composer textarea itself; this bar also offers the
//                      expand control via the parent.
//
// Project resources (reusable) are picked through the picker popover and are
// visually distinct from the temporary, message-scoped attachments.
// ============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bookmark, FileCode2, FileSpreadsheet, FileText, FileType2, ImageIcon, Link2, Loader2, Paperclip, Plus, Sparkles, X } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import { Button } from '@/components/shell/bits';
import {
  BINARY_EXCERPT,
  fileKindMeta,
  humanSize,
  normalizeUrl,
  validateFile,
  type ComposerAttachment,
  type ProjectResource,
} from '@/lib/qa-mock/resources';

// ----------------------------------------------------------------- helpers

/** Build staged attachments from a FileList (called by button + drop zone). */
export async function createAttachmentsFromFiles(files: File[] | FileList): Promise<ComposerAttachment[]> {
  const list = Array.from(files);
  const out: ComposerAttachment[] = [];
  for (const f of list) {
    const localId = `att-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const error = validateFile(f);
    const meta = fileKindMeta(f.name);
    const att: ComposerAttachment = {
      localId,
      kind: 'file',
      name: f.name,
      mime: f.type || 'application/octet-stream',
      size: f.size,
      status: error ? 'error' : 'uploading',
      progress: error ? 0 : 4,
      error: error || undefined,
    };
    // Real local previews where possible (no upload, no server).
    if (!error && meta?.previewable === 'text') {
      try {
        const text = await f.slice(0, 2048).text();
        att.excerpt = text.trim().slice(0, 1200) || BINARY_EXCERPT;
      } catch {
        att.excerpt = BINARY_EXCERPT;
      }
    } else if (!error && meta?.previewable === 'image' && f.size <= 2 * 1024 * 1024) {
      try {
        att.dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f);
        });
      } catch {
        // thumbnail is best-effort only
      }
    } else if (!error && meta) {
      att.excerpt = BINARY_EXCERPT;
    }
    out.push(att);
  }
  return out;
}

/** Advance simulated upload progress; returns the same list when idle. */
export function tickUploadProgress(list: ComposerAttachment[]): ComposerAttachment[] {
  let changed = false;
  const next = list.map((a) => {
    if (a.kind === 'file' && a.status === 'uploading') {
      changed = true;
      const p = Math.min(100, a.progress + 18 + Math.round(Math.random() * 16));
      return { ...a, progress: p, status: p >= 100 ? ('ready' as const) : ('uploading' as const) };
    }
    return a;
  });
  return changed ? next : list;
}

function FileIcon({ name, dataUrl }: { name: string; dataUrl?: string }) {
  const meta = fileKindMeta(name);
  if (dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={dataUrl} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />;
  }
  const size = 13;
  // [Task 12b] flexShrink must ride in `style`, not as a spread prop — lucide
  // icons forward unknown props to the <svg> DOM element, which triggered
  // React's "does not recognize the flexShrink prop" dev warning.
  const common = { width: size, height: size, style: { flexShrink: 0 } as CSSProperties };
  if (!meta) return <FileText {...common} />;
  if (meta.previewable === 'image') return <ImageIcon {...common} />;
  if (/\.(csv|tsv|xlsx?|xls)$/.test(name)) return <FileSpreadsheet {...common} />;
  if (/\.(ts|tsx|js|jsx|py|java|kt|go|rb|php|cs|sql|sh|html|css)$/.test(name)) return <FileCode2 {...common} />;
  if (/\.(md|markdown)$/.test(name)) return <FileType2 {...common} />;
  return <FileText {...common} />;
}

// -------------------------------------------------------------- component

export default function ResourceBar({
  projectId,
  projectResources,
  attachments,
  onAttachmentsChange,
  selectedResourceIds,
  onToggleResource,
  onSaveAttachmentAsResource,
  compact,
}: {
  projectId: string;
  projectResources: ProjectResource[];
  attachments: ComposerAttachment[];
  onAttachmentsChange: (next: ComposerAttachment[]) => void;
  selectedResourceIds: string[];
  onToggleResource: (id: string) => void;
  onSaveAttachmentAsResource: (localId: string) => void;
  compact?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'none' | 'url' | 'picker'>('none');
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Advance simulated uploads while anything is in flight.
  const uploading = attachments.some((a) => a.kind === 'file' && a.status === 'uploading');
  useEffect(() => {
    if (!uploading) return;
    const t = window.setInterval(() => {
      onAttachmentsChange(tickUploadProgress(attachments));
    }, 260);
    return () => window.clearInterval(t);
  }, [uploading, attachments, onAttachmentsChange]);

  function addFiles(files: File[] | FileList) {
    void createAttachmentsFromFiles(files).then((created) => onAttachmentsChange([...attachments, ...created]));
  }

  function addUrl() {
    const normalized = normalizeUrl(urlDraft);
    if (!normalized) {
      setUrlError('Enter a valid URL (e.g. https://staging.example.com or docs.example.com/api)');
      return;
    }
    setUrlError('');
    setUrlDraft('');
    setMode('none');
    onAttachmentsChange([
      ...attachments,
      { localId: `url-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: 'url', name: normalized, status: 'ready' },
    ]);
  }

  const selectedSet = new Set(selectedResourceIds);
  const selectedResources = projectResources.filter((r) => selectedSet.has(r.id));
  const previewAtt = attachments.find((a) => a.localId === previewId) || null;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    padding: '4px 9px',
    borderRadius: 6,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? alpha(C.accent, 9) : 'transparent',
    color: active ? C.accent : C.fgDim,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {/* ----------------------------------------------------- control row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files (PDF, DOC/DOCX, TXT, MD, CSV, XLSX, JSON, XML, YAML, PNG/JPG, source code — 10 MB max)"
          aria-label="Attach files"
          style={btnStyle(false)}
        >
          <Paperclip size={12} /> Attach files
        </button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'url' ? 'none' : 'url'))}
          title="Add a website or documentation URL (format validated; contents are not fetched in this demo)"
          aria-label="Add URL"
          aria-expanded={mode === 'url'}
          style={btnStyle(mode === 'url')}
        >
          <Link2 size={12} /> Add URL
        </button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'picker' ? 'none' : 'picker'))}
          title={`Reuse project resources (${projectResources.length} available)`}
          aria-label="Reuse project resources"
          aria-expanded={mode === 'picker'}
          style={btnStyle(mode === 'picker' || selectedResources.length > 0)}
        >
          <Bookmark size={12} /> Project resources{selectedResources.length > 0 ? ` (${selectedResources.length})` : ''}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* ------------------------------------------------------- url input */}
      {mode === 'url' && (
        <div role="group" aria-label="Add a URL resource" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              autoFocus
              value={urlDraft}
              onChange={(e) => {
                setUrlDraft(e.target.value);
                setUrlError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addUrl();
                }
                if (e.key === 'Escape') setMode('none');
              }}
              placeholder="https://staging.example.com or docs.example.com/api"
              aria-label="Resource URL"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${urlError ? C.danger : C.border}`,
                background: C.surface,
                color: C.fg,
                fontSize: 12,
                outline: 'none',
              }}
            />
            {urlError ? (
              <div role="alert" style={{ fontSize: 10.5, color: C.danger, marginTop: 3 }}>{urlError}</div>
            ) : (
              <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 3 }}>
                Format is validated locally — the URL is <strong>not</strong> fetched or read in this demo.
              </div>
            )}
          </div>
          <Button small variant="primary" onClick={addUrl} ariaLabel="Add URL">
            <Plus size={12} /> Add
          </Button>
        </div>
      )}

      {/* ---------------------------------------------------- resource picker */}
      {mode === 'picker' && (
        <div
          role="group"
          aria-label="Project resources picker"
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: C.surface,
            padding: 8,
            maxHeight: compact ? 180 : 240,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div style={{ fontSize: 10, color: C.fgMuted, padding: '2px 4px 6px', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            Reuse project resources — contents are not read in this demo
          </div>
          {projectResources.length === 0 && (
            <div style={{ fontSize: 11.5, color: C.fgMuted, padding: '6px 4px 4px', lineHeight: 1.5 }}>
              No resources saved for this project yet. Attach files below and choose “Save to project”, or add them from the Resources panel in the workspace header.
            </div>
          )}
          {projectResources.map((r) => {
            const on = selectedSet.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggleResource(r.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: `1px solid ${on ? C.accent : 'transparent'}`,
                  background: on ? alpha(C.accent, 7) : 'transparent',
                  color: C.fgDim,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${on ? C.accent : C.muted}`, background: on ? C.accent : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}
                >
                  {on && (
                    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <FileIcon name={r.name} dataUrl={r.dataUrl} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.fg }}>{r.name}</span>
                <span style={{ fontSize: 10, color: C.fgMuted, flexShrink: 0 }}>
                  {r.kind === 'url' ? 'URL' : humanSize(r.size || 0)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- chips */}
      {(selectedResources.length > 0 || attachments.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {selectedResources.map((r) => (
            <span
              key={r.id}
              title={`Project resource (reused) — ${r.name}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                maxWidth: '100%',
                fontSize: 11.5,
                padding: '4px 6px 4px 8px',
                borderRadius: 7,
                background: alpha(C.ai, 7),
                border: `1px solid ${alpha(C.ai, 27)}`,
                color: C.fg,
              }}
            >
              <Bookmark size={11} color={C.ai} aria-hidden="true" />
              <FileIcon name={r.name} dataUrl={r.dataUrl} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.name}</span>
              <span style={{ fontSize: 9.5, color: C.fgMuted, flexShrink: 0 }}>reused</span>
              <button
                type="button"
                onClick={() => onToggleResource(r.id)}
                aria-label={`Remove ${r.name} from this request`}
                title="Remove from this request"
                style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4 }}
              >
                <X size={11} />
              </button>
            </span>
          ))}

          {attachments.map((a) => (
            <span
              key={a.localId}
              title={a.kind === 'file' ? `${a.name} — ${humanSize(a.size)}` : a.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                maxWidth: '100%',
                fontSize: 11.5,
                padding: '4px 6px 4px 8px',
                borderRadius: 7,
                background: a.status === 'error' ? alpha(C.danger, 7) : C.surface2,
                border: `1px solid ${a.status === 'error' ? alpha(C.danger, 40) : C.border}`,
                color: a.status === 'error' ? C.danger : C.fg,
              }}
            >
              {a.kind === 'file' ? <FileIcon name={a.name} dataUrl={a.dataUrl} /> : <Link2 size={13} color={C.ai} aria-hidden="true" />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>
              {a.kind === 'file' && a.status !== 'error' && (
                <span style={{ fontSize: 9.5, color: C.fgMuted, flexShrink: 0 }}>
                  {a.status === 'uploading' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Loader2 size={10} className="animate-pulse-dot" aria-hidden="true" /> {a.progress}%
                    </span>
                  ) : (
                    humanSize(a.size)
                  )}
                </span>
              )}
              {a.status === 'error' && a.error && (
                <span style={{ fontSize: 9.5, flexShrink: 0 }} role="alert">{a.error}</span>
              )}
              {a.kind === 'file' && a.status === 'ready' && !a.savedAsResource && (
                <button
                  type="button"
                  onClick={() => onSaveAttachmentAsResource(a.localId)}
                  title="Save this file to the project resources for reuse"
                  aria-label={`Save ${a.name} to project resources`}
                  style={{ background: 'none', border: 'none', color: C.ai, cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4, flexShrink: 0 }}
                >
                  <Bookmark size={11} />
                </button>
              )}
              {a.kind === 'file' && a.status === 'ready' && (a.excerpt || a.dataUrl) && (
                <button
                  type="button"
                  onClick={() => setPreviewId((p) => (p === a.localId ? null : a.localId))}
                  title="Toggle preview"
                  aria-label={`Preview ${a.name}`}
                  aria-expanded={previewId === a.localId}
                  style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4, flexShrink: 0 }}
                >
                  <Sparkles size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onAttachmentsChange(attachments.filter((x) => x.localId !== a.localId))}
                aria-label={`Remove ${a.name}`}
                title="Remove attachment"
                style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4, flexShrink: 0 }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------- preview */}
      {previewAtt && previewAtt.kind === 'file' && (
        <div
          role="region"
          aria-label={`Preview of ${previewAtt.name}`}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.fgDim, fontFamily: 'var(--font-mono)' }}>preview · {previewAtt.name}</span>
            <button onClick={() => setPreviewId(null)} aria-label="Close preview" style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={11} />
            </button>
          </div>
          {previewAtt.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewAtt.dataUrl} alt={`Preview of ${previewAtt.name}`} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, border: `1px solid ${C.border}`, objectFit: 'contain' }} />
          ) : (
            <pre
              style={{
                margin: 0,
                fontSize: 10.5,
                lineHeight: 1.55,
                color: C.fgDim,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 140,
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {previewAtt.excerpt || BINARY_EXCERPT}
            </pre>
          )}
          <div style={{ fontSize: 10, color: C.fgMuted }}>
            Read locally in your browser — nothing was uploaded, and AI generation does not analyse file contents in this demo.
          </div>
        </div>
      )}
    </div>
  );
}
