'use client';

// ============================================================================
// [SEPYANT 2.1] Resource-aware chat composer.
//
// Builds on the Phase 1 Ask/Generate composer:
//   - Ask answers questions about the project (copilot endpoint, unchanged).
//   - Generate turns a requirement into QA output. The output TYPE is now an
//     explicit selector (Test Plan / Test Cases use the real generation flow;
//     six more types produce clearly-labeled demo outputs in the chat).
//
// New resource input area (ResourceBar): file attachments (browse + drag &
// drop, simulated upload, local previews), URL chips (format-validated only)
// and reusable project resources — all combinable with the message text in a
// single request. Demo honesty is enforced in copy throughout.
// ============================================================================

import { useRef, useState } from 'react';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import { IBtn } from './primitives';
import ResourceBar from './composer/ResourceBar';
import OutputCard from './composer/OutputCard';
import { Bookmark, FileText, Link2 } from 'lucide-react';
import { FRAMEWORKS, type FrameworkId, type ScriptLang } from '@/lib/qa-mock/automation';
import { OUTPUT_TYPES, type GeneratedOutput, type OutputTypeId } from '@/lib/qa-mock/generation';
import type { ComposerAttachment, ProjectResource } from '@/lib/qa-mock/resources';
import type { ChatMode, Msg } from './types';

// Quick prompts set the matching mode explicitly instead of relying on the
// old keyword-sniffing router.
const QUICK_PROMPTS: { text: string; mode: ChatMode }[] = [
  { text: 'Generate test cases for...', mode: 'generate' },
  { text: 'Create a test plan for...', mode: 'generate' },
  { text: 'Negative cases for...', mode: 'generate' },
  { text: 'What needs more coverage?', mode: 'ask' },
];

const MODE_HINT: Record<ChatMode, string> = {
  ask: 'Ask about this project…',
  generate: 'Optional instructions — e.g. “include positive, negative, boundary, security and edge-case scenarios”…',
};

/** Everything one submitted request carries. */
export type ComposerPayload = {
  text: string;
  mode: ChatMode;
  outputType: OutputTypeId;
  framework?: { id: FrameworkId; name: string; language: string };
  attachments: { name: string; kind: 'file' | 'url' }[];
  resourceIds: string[];
};

export default function ChatPanel({
  messages,
  streaming,
  onSend,
  projectId,
  projectName,
  demoUser,
  projectResources,
  onSaveAttachmentAsResource,
  onRegenerateOutput,
  onRefineOutput,
  onSaveOutputToProject,
}: {
  messages: Msg[];
  streaming: boolean;
  onSend: (payload: ComposerPayload) => void;
  projectId: string;
  projectName: string;
  demoUser: string;
  projectResources: ProjectResource[];
  onSaveAttachmentAsResource?: (localId: string, att: { name: string; kind: 'file' | 'url'; size?: number }) => void;
  onRegenerateOutput?: (messageIndex: number) => void;
  onRefineOutput?: (messageIndex: number, instructions: string) => void;
  onSaveOutputToProject?: (messageIndex: number) => string | null | void;
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('ask');
  const [expanded, setExpanded] = useState(false);
  const [outputType, setOutputType] = useState<OutputTypeId>('test-plan');
  const [frameworkId, setFrameworkId] = useState<FrameworkId>('playwright');
  const [language, setLanguage] = useState<ScriptLang>('typescript');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chosenOutput = OUTPUT_TYPES.find((o) => o.id === outputType)!;
  const framework = FRAMEWORKS.find((f) => f.id === frameworkId)!;
  const uploading = attachments.some((a) => a.kind === 'file' && a.status === 'uploading');
  const hasContext = attachments.some((a) => a.status !== 'error') || resourceIds.length > 0;
  const canSend = !streaming && !uploading && (input.trim().length > 0 || (mode === 'generate' && !chosenOutput.usesEndpoint && hasContext));

  function send() {
    if (!canSend) return;
    onSend({
      text: input.trim(),
      mode,
      outputType,
      framework: chosenOutput.needsFramework ? { id: framework.id, name: framework.name, language } : undefined,
      attachments: attachments
        .filter((a) => a.status !== 'error')
        .map((a) => (a.kind === 'file' ? { name: a.name, kind: 'file' as const } : { name: a.name, kind: 'url' as const })),
      resourceIds: [...resourceIds],
    });
    setInput('');
    setAttachments([]);
    setResourceIds([]);
    setExpanded(false);
  }

  function toggleResource(id: string) {
    setResourceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const msgChip = (name: string, kind: 'file' | 'url', key: number, reused?: boolean) => (
    <span
      key={`${key}-${name}`}
      title={kind === 'url' ? `URL context${reused ? ' (project resource)' : ''}` : `File context${reused ? ' (project resource)' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 999,
        background: reused ? alpha(C.ai, 7) : C.surface2,
        border: `1px solid ${reused ? alpha(C.ai, 27) : C.border}`,
        color: C.fgDim,
        maxWidth: 220,
      }}
    >
      {reused ? <Bookmark size={9} color={C.ai} /> : kind === 'url' ? <Link2 size={9} /> : <FileText size={9} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  );

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.sidebar, position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) {
          void import('./composer/ResourceBar').then(({ createAttachmentsFromFiles }) =>
            createAttachmentsFromFiles(e.dataTransfer.files).then((created) => setAttachments((prev) => [...prev, ...created]))
          );
        }
      }}
    >
      {dragOver && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            border: `2px dashed ${C.accent}`,
            background: alpha(C.accent, 8),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12.5,
            fontWeight: 600,
            color: C.accent,
            pointerEvents: 'none',
            borderRadius: 4,
          }}
        >
          Drop files to attach
        </div>
      )}

      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: C.ai, fontSize: 13 }}>✦</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>Sepyant AI</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: C.fgMuted, lineHeight: 1.6, padding: '8px 2px' }}>
            <strong style={{ color: C.fgDim }}>Generate</strong> turns a requirement into QA output — pick the output type below, optionally attach files, add URLs or reuse
            project resources as context. <strong style={{ color: C.fgDim }}>Ask</strong> answers questions about this project and its coverage. Demo note: attached files and
            URLs are kept locally and their contents are not analysed.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', minWidth: 0, width: '100%' }}>
            {msg.role === 'ai' && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: C.ai }}>✦</span>
                <span style={{ fontSize: 11, color: C.fgMuted }}>AI</span>
              </div>
            )}
            <div
              style={{
                maxWidth: '90%',
                fontSize: 13,
                lineHeight: 1.6,
                padding: '9px 12px',
                borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '3px 10px 10px 10px',
                background: msg.role === 'user' ? C.accent : C.surface2,
                color: msg.role === 'user' ? '#fff' : C.fg,
                border: msg.role === 'ai' ? `1px solid ${C.border}` : 'none',
              }}
            >
              {msg.content.split('\n').map((line, li) => (
                <span key={li} style={{ display: 'block' }}>
                  {line.split(/(\*\*[^*]+\*\*)/).map((part, pi) =>
                    part.startsWith('**') && part.endsWith('**') ? <strong key={pi}>{part.slice(2, -2)}</strong> : <span key={pi}>{part}</span>
                  )}
                </span>
              ))}
            </div>
            {/* context chips that travelled with this message */}
            {(msg.attachments?.length || msg.resourceNames?.length) && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                {(msg.resourceNames || []).map((n, k) => msgChip(n, 'file', k, true))}
                {(msg.attachments || []).map((a, k) => msgChip(a.name, a.kind, k + 100, false))}
              </div>
            )}
            {/* generated output card */}
            {msg.role === 'ai' && msg.output && (
              <div style={{ width: '100%', minWidth: 0 }}>
                <OutputCard
                  output={msg.output}
                  projectName={projectName}
                  demoUser={demoUser}
                  savedDocumentId={msg.outputDocId ?? null}
                  onRegenerate={onRegenerateOutput ? () => onRegenerateOutput(i) : undefined}
                  onRefine={onRefineOutput ? (instructions) => onRefineOutput(i, instructions) : undefined}
                  onSaveToProject={onSaveOutputToProject ? () => onSaveOutputToProject(i) : undefined}
                />
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <span style={{ fontSize: 10, color: C.ai }}>✦</span>
              <span style={{ fontSize: 11, color: C.fgMuted }}>AI</span>
            </div>
            <div style={{ padding: '9px 14px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '3px 10px 10px 10px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="animate-pulse-dot"
                  style={{ width: 5, height: 5, borderRadius: '50%', background: C.ai, display: 'inline-block', animationDelay: `${d * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '6px 14px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.text}
            onClick={() => {
              setMode(p.mode);
              setInput(p.text);
            }}
            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface2, color: C.fgDim, cursor: 'pointer' }}
          >
            {p.text}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* [PHASE 1] Explicit Ask / Generate choice — replaces keyword-based
            routing of free-form chat text. */}
        <div role="radiogroup" aria-label="Chat mode" style={{ display: 'flex', gap: 6 }}>
          {(['ask', 'generate'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              title={m === 'ask' ? 'Ask a question about this project' : 'Generate a QA output from your instructions and selected context'}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                padding: '7px 10px',
                borderRadius: 7,
                cursor: 'pointer',
                border: `1px solid ${mode === m ? C.accent : C.border}`,
                background: mode === m ? alpha(C.accent, 9) : 'transparent',
                color: mode === m ? C.accent : C.fgDim,
                transition: 'all 120ms',
              }}
            >
              {m === 'ask' ? (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              ) : (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              )}
              {m === 'ask' ? 'Ask' : 'Generate'}
            </button>
          ))}
        </div>

        {/* [SEPYANT 2.1] output-type selector for Generate mode */}
        {mode === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor="output-type" style={{ fontSize: 10.5, color: C.fgMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                Output
              </label>
              <select
                id="output-type"
                value={outputType}
                onChange={(e) => setOutputType(e.target.value as OutputTypeId)}
                aria-label="Output type to generate"
                style={{ flex: 1, minWidth: 150, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.fg, fontSize: 11.5, cursor: 'pointer' }}
              >
                {OUTPUT_TYPES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {chosenOutput.needsFramework && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="framework-select" style={{ fontSize: 10.5, color: C.fgMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  Framework
                </label>
                <select
                  id="framework-select"
                  value={frameworkId}
                  onChange={(e) => {
                    const next = e.target.value as FrameworkId;
                    setFrameworkId(next);
                    const f = FRAMEWORKS.find((x) => x.id === next);
                    if (f && !f.languages.includes(language)) setLanguage(f.languages[0]);
                  }}
                  aria-label="Automation framework"
                  style={{ flex: 1, minWidth: 110, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.fg, fontSize: 11.5, cursor: 'pointer' }}
                >
                  {FRAMEWORKS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as ScriptLang)}
                  aria-label="Script language"
                  style={{ flex: 1, minWidth: 100, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.fg, fontSize: 11.5, cursor: 'pointer' }}
                >
                  {framework.languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ fontSize: 10, color: C.fgMuted, lineHeight: 1.5 }}>
              {chosenOutput.usesEndpoint
                ? 'Runs the workspace generation flow — the plan and cases appear in the IDE panel for review.'
                : `${chosenOutput.hint}. Output is a clearly-labeled demo simulation.`}
            </div>
          </div>
        )}

        {/* [SEPYANT 2.1] resource input area: files, URLs, project resources */}
        <ResourceBar
          projectId={projectId}
          projectResources={projectResources}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          selectedResourceIds={resourceIds}
          onToggleResource={toggleResource}
          onSaveAttachmentAsResource={(localId) => {
            const att = attachments.find((a) => a.localId === localId);
            if (att && att.kind === 'file' && onSaveAttachmentAsResource) {
              onSaveAttachmentAsResource(localId, { name: att.name, kind: 'file', size: att.size });
              setAttachments((prev) => prev.map((a) => (a.localId === localId && a.kind === 'file' ? { ...a, savedAsResource: true } : a)));
            }
          }}
        />

        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={MODE_HINT[mode]}
              aria-label={mode === 'ask' ? 'Ask a question' : 'Optional generation instructions'}
              rows={expanded ? 12 : 3}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.fg, fontSize: 13, resize: 'none', lineHeight: 1.5, padding: '10px 34px 10px 12px', boxSizing: 'border-box' }}
            />
            <div style={{ position: 'absolute', top: 6, right: 6 }}>
              <IBtn title={expanded ? 'Collapse input' : 'Expand input for longer specifications'} onClick={() => setExpanded((v) => !v)}>
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </IBtn>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px', gap: 2 }}>
            {uploading && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.fgMuted, marginRight: 'auto' }}>
                <Loader2 size={11} className="animate-pulse-dot" /> Uploading (simulated)…
              </span>
            )}
            <div style={{ flex: uploading ? 0 : 1 }} />
            <button
              onClick={send}
              disabled={!canSend}
              aria-label={mode === 'ask' ? 'Send question' : `Generate ${chosenOutput.label}`}
              title={uploading ? 'Wait for the simulated upload to finish' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: canSend ? C.accent : C.surface,
                border: `1px solid ${canSend ? C.accent : C.border}`,
                color: canSend ? '#fff' : C.fgMuted,
                borderRadius: 7,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                cursor: canSend ? 'pointer' : 'default',
                transition: 'all 120ms',
                flexShrink: 0,
              }}
            >
              {mode === 'generate' && !chosenOutput.usesEndpoint ? 'Generate' : 'Send'}
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: C.fgMuted, lineHeight: 1.5 }}>
          Demo workspace — files and URLs stay in your browser; generation is simulated. Chat history is per session and clears when you reload. Connect the backend for real uploads, URL fetching and AI analysis.
        </div>
      </div>
    </div>
  );
}
