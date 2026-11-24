'use client';

import { useState } from 'react';
import { C, alpha } from '@/lib/theme';

/**
 * Explicit generation entry point: a visible "Generate Test Plan" form with an
 * optional target-case-count input (QA-IDE-inspired, rebuilt with Sepyant's
 * inline-style design system).
 *
 * Contract notes (unchanged backend contract — app/api/ai/generate-test-plan):
 *  - requirementText is sent verbatim, same as chat-triggered generation.
 *  - requestedCaseCount is sent ONLY when the user typed a value. Empty field
 *    => the key is omitted entirely, matching the exact pre-existing payload.
 *  - The backend/prompt treats the count as APPROXIMATE guidance ("The user
 *    requested approximately N test cases total"), so the UI copy says
 *    "target" and the hint explains the AI may generate more for coverage.
 *  - Client-side validation mirrors the planned backend contract (optional
 *    integer >= 1). No maximum is enforced because none is documented in the
 *    API contract — flagged to the lead as an open contract decision.
 */
export default function GenerateForm({
  onGenerate,
  busy,
  compact,
}: {
  onGenerate: (text: string, requestedCaseCount?: number) => void;
  busy: boolean;
  compact?: boolean;
}) {
  const [text, setText] = useState('');
  const [count, setCount] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter a requirement first.');
      return;
    }

    let requestedCaseCount: number | undefined;
    if (count.trim() !== '') {
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1) {
        setError('Target case count must be a whole number of 1 or more.');
        return;
      }
      requestedCaseCount = n;
    }

    setError(null);
    onGenerate(trimmed, requestedCaseCount);
    setText('');
    setCount('');
  }

  const pad = compact ? '10px 12px' : '12px 14px';

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{
        width: '100%',
        maxWidth: compact ? 'none' : 560,
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: pad,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: busy ? 0.6 : 1,
        pointerEvents: busy ? 'none' : 'auto',
        transition: 'opacity 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12, color: C.ai }}>✦</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>Generate from requirement</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Paste a requirement, user story, or acceptance criteria…"
        rows={compact ? 3 : 4}
        aria-label="Requirement text"
        style={{
          width: '100%',
          background: 'transparent',
          border: `1px solid ${C.border}`,
          borderRadius: 7,
          outline: 'none',
          color: C.fg,
          fontSize: 13,
          lineHeight: 1.55,
          padding: '9px 11px',
          resize: 'vertical',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          min={1}
          step={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="Target case count"
          aria-label="Target case count (optional, approximate)"
          style={{
            width: 168,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 7,
            outline: 'none',
            color: C.fg,
            fontSize: 12,
            padding: '8px 10px',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 7,
            border: `1px solid ${C.accent}`,
            background: C.accent,
            color: '#fff',
            cursor: busy ? 'default' : 'pointer',
            transition: 'all 120ms',
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {busy ? 'Generating…' : 'Generate Test Plan'}
        </button>
        <div style={{ flex: 1 }} />
      </div>

      {error ? (
        <div role="alert" style={{ fontSize: 11, color: C.danger }}>
          {error}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: alpha(C.fgMuted, 69) }}>
          The count is approximate guidance — the AI may generate more cases if coverage requires it. Press ⌘/Ctrl+Enter to generate.
        </div>
      )}
    </form>
  );
}
