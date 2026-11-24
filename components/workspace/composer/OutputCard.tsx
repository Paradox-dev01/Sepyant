'use client';

// ============================================================================
// [SEPYANT 2.1] Generated-output card — the post-generation experience in the
// workspace chat. Renders the simulated output blocks with:
//   - context transparency (resources used + what was/wasn't actually read)
//   - preview / edit (markdown) / copy / download / save-to-project
//   - regenerate and refine-with-follow-up-instructions
// Save-to-project files the output into the matching QA library surface
// (documents mock store), carrying `resourcesUsed` for traceability.
// ============================================================================

import { useState } from 'react';
import { Check, Copy, Download, FilePlus2, Pencil, RefreshCw, SendHorizontal, X } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import { Button } from '@/components/shell/bits';
import { toast } from '@/components/shell/Toast';
import { copyText, downloadText } from '@/lib/mock-store';
import { CodeBlock } from '@/components/automation/highlight';
import { generatedToMarkdown, type GeneratedOutput, type OutputBlock } from '@/lib/qa-mock/generation';

function BlocksView({ blocks }: { blocks: OutputBlock[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return (
              <div key={i} style={{ fontSize: 12.5, fontWeight: 650, color: C.fg, marginTop: 2 }}>
                {b.text}
              </div>
            );
          case 'p':
            return (
              <div key={i} style={{ fontSize: 12.5, lineHeight: 1.6, color: C.fgDim, whiteSpace: 'pre-wrap' }}>
                {b.text.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 === 1 ? <strong key={j} style={{ color: C.fg, fontWeight: 650 }}>{part}</strong> : <span key={j}>{part}</span>))}
              </div>
            );
          case 'list':
            return (
              <ul key={i} style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ fontSize: 12.5, lineHeight: 1.55, color: C.fgDim }}>
                    {it.split(/\*\*(.+?)\*\*/g).map((part, k) => (k % 2 === 1 ? <strong key={k} style={{ color: C.fg, fontWeight: 650 }}>{part}</strong> : <span key={k}>{part}</span>))}
                  </li>
                ))}
              </ul>
            );
          case 'code':
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {b.filename && <span style={{ fontSize: 10.5, color: C.fgMuted, fontFamily: 'var(--font-mono)' }}>{b.filename}</span>}
                <CodeBlock code={b.code} lang={b.lang === 'python' ? 'python' : b.lang === 'json' ? 'json' : b.lang === 'java' ? 'java' : 'ts'} maxHeight={280} />
              </div>
            );
          case 'stats':
            return (
              <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {b.items.map((s, j) => (
                  <span
                    key={j}
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: C.surface2,
                      border: `1px solid ${C.border}`,
                      minWidth: 86,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: s.tone === 'good' ? C.success : s.tone === 'warn' ? C.warning : s.tone === 'bad' ? C.danger : C.fg }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: C.fgMuted }}>{s.label}</span>
                  </span>
                ))}
              </div>
            );
          case 'kv':
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {b.items.map((kv, j) => (
                  <div key={j} style={{ fontSize: 12.5, lineHeight: 1.55, color: C.fgDim }}>
                    <span style={{ color: C.fgDim, fontWeight: 600 }}>{kv.k}: </span>
                    <span>{kv.v}</span>
                  </div>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}

export default function OutputCard({
  output,
  projectName,
  demoUser,
  onRegenerate,
  onRefine,
  onSaveToProject,
  savedDocumentId,
}: {
  output: GeneratedOutput;
  projectName: string;
  demoUser: string;
  onRegenerate?: () => void;
  onRefine?: (instructions: string) => void;
  onSaveToProject?: () => string | null | void; // returns document id when saved
  savedDocumentId?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [edited, setEdited] = useState<string | null>(null); // markdown override after manual edit
  const [refining, setRefining] = useState(false);
  const [refineDraft, setRefineDraft] = useState('');
  const [savedId, setSavedId] = useState<string | null>(savedDocumentId ?? null);
  const [copied, setCopied] = useState(false);

  const markdown = edited ?? generatedToMarkdown(output, projectName);

  async function copy() {
    const ok = await copyText(markdown);
    if (ok) {
      setCopied(true);
      toast('Output copied as Markdown', 'success');
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast('Copy failed — clipboard unavailable', 'error');
    }
  }

  function download() {
    const safe = output.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48) || 'generated-output';
    downloadText(`${safe}.md`, markdown, 'text/markdown;charset=utf-8');
    toast('Downloaded as .md', 'success');
  }

  function saveEdit() {
    setEdited(editDraft);
    setEditing(false);
    toast('Output updated (this demo keeps edits locally in the chat)', 'success');
  }

  function saveToProject() {
    if (!onSaveToProject) return;
    const id = onSaveToProject();
    if (typeof id === 'string') {
      setSavedId(id);
      toast('Saved to the project library', 'success');
    }
  }

  return (
    <div
      role="region"
      aria-label={`Generated ${output.outputLabel}`}
      style={{
        width: '100%',
        border: `1px solid ${alpha(C.ai, 33)}`,
        borderRadius: 10,
        background: C.surface,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ------------------------------------------------------------ header */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: alpha(C.ai, 5) }}>
        <span aria-hidden="true" style={{ color: C.ai, fontSize: 12 }}>✦</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.ai }}>{output.outputLabel}</span>
        <span
          title="Simulated demo output — no AI provider, no document/URL analysis"
          style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.warning, border: `1px solid ${alpha(C.warning, 33)}`, background: alpha(C.warning, 7), padding: '2px 6px', borderRadius: 4 }}
        >
          DEMO
        </span>
        <span style={{ fontSize: 11, color: C.fgMuted, marginLeft: 'auto' }}>
          {new Date(output.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* ------------------------------------------------------------- title */}
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: C.fg, lineHeight: 1.4 }}>{output.title}</div>
        {output.framework && (
          <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 3 }}>
            Framework: {output.framework.name} · {output.framework.language}
          </div>
        )}
        {/* resources used — honest traceability */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: C.fgMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            Context used for this output
          </span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {output.resourcesUsed.length === 0 ? (
              <span style={{ fontSize: 11, color: C.fgMuted }}>No resources selected — generated from the instructions only.</span>
            ) : (
              output.resourcesUsed.map((r) => (
                <span
                  key={r.name}
                  title={r.kind === 'url' ? 'URL selected as context — contents were NOT fetched in this demo' : 'File selected as context — contents were NOT read in this demo'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10.5,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: alpha(C.ai, 7),
                    border: `1px solid ${alpha(C.ai, 27)}`,
                    color: C.fgDim,
                  }}
                >
                  {r.kind === 'url' ? '🔗' : '📄'} {r.name}
                </span>
              ))
            )}
          </div>
          {output.resourcesUsed.length > 0 && (
            <span style={{ fontSize: 10, color: C.fgMuted, lineHeight: 1.5 }}>
              Names were provided as context only — contents were <strong>not</strong> read in this demo. Connect the backend integration for real document/URL analysis.
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- body */}
      <div style={{ padding: '12px 12px 14px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.fgMuted }}>Editing the Markdown source of this output:</span>
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              aria-label="Edit generated output (Markdown)"
              rows={12}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.fg,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.55,
                padding: 10,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button small onClick={() => setEditing(false)}>
                <X size={12} /> Cancel
              </Button>
              <Button small variant="primary" onClick={saveEdit}>
                <Check size={12} /> Save changes
              </Button>
            </div>
          </div>
        ) : edited !== null ? (
          <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: C.fgDim, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{edited}</pre>
        ) : (
          <BlocksView blocks={output.blocks} />
        )}
      </div>

      {/* ----------------------------------------------------------- actions */}
      <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {!editing && (
          <Button small onClick={() => { setEditDraft(markdown); setEditing(true); }} title="Edit the output as Markdown">
            <Pencil size={12} /> Edit
          </Button>
        )}
        <Button small onClick={copy} title="Copy as Markdown">
          {copied ? <Check size={12} color={C.success} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button small onClick={download} title="Download as .md">
          <Download size={12} /> Download
        </Button>
        <Button small onClick={saveToProject} disabled={!!savedId} title={savedId ? 'Already saved to the project library' : 'Save to the QA library for this project'}>
          <FilePlus2 size={12} /> {savedId ? 'Saved to project' : 'Save to project'}
        </Button>
        {onRegenerate && (
          <Button small onClick={onRegenerate} title="Regenerate with the same context and instructions">
            <RefreshCw size={12} /> Regenerate
          </Button>
        )}
        {onRefine && !refining && (
          <Button small onClick={() => setRefining(true)} title="Refine with additional instructions">
            <Sparkles16 /> Refine
          </Button>
        )}
        {onRefine && refining && (
          <span style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
            <input
              autoFocus
              value={refineDraft}
              onChange={(e) => setRefineDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && refineDraft.trim()) {
                  onRefine(refineDraft.trim());
                  setRefineDraft('');
                  setRefining(false);
                }
                if (e.key === 'Escape') setRefining(false);
              }}
              placeholder="Additional instructions… (Enter to refine)"
              aria-label="Refinement instructions"
              style={{ flex: 1, minWidth: 0, padding: '5px 9px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.fg, fontSize: 11.5, outline: 'none' }}
            />
            <button
              onClick={() => {
                if (refineDraft.trim() && onRefine) {
                  onRefine(refineDraft.trim());
                  setRefineDraft('');
                  setRefining(false);
                }
              }}
              aria-label="Apply refinement"
              title="Apply refinement"
              style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, width: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <SendHorizontal size={12} />
            </button>
            <button onClick={() => setRefining(false)} aria-label="Cancel refinement" style={{ background: 'none', border: `1px solid ${C.border}`, color: C.fgMuted, borderRadius: 6, width: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={12} />
            </button>
          </span>
        )}
        {savedId && <span style={{ fontSize: 10.5, color: C.success, marginLeft: 'auto', flexShrink: 0 }}>In the project library ✓</span>}
      </div>
      <span hidden>generated-for:{projectName} by {demoUser}</span>
    </div>
  );
}

function Sparkles16() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.7L20 10l-6.1 1.3L12 17l-1.9-5.7L4 10l6.1-1.3z" />
    </svg>
  );
}
