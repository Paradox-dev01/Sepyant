'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { C, alpha } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-bypass';
import type { Artifact, TC } from './types';
import { typeIcon } from './types';
import { EditableText } from './primitives';
import { exportCSV, exportDoc, type ExportScope } from './export';

// Review-status presentation. Kept separate from the execution status, which
// is display-only in Phase 1 (execution runs are Phase 2).
const REVIEW_LABEL: Record<TC['reviewStatus'], string> = {
  approved: 'approved',
  needs_review: 'needs review',
  draft: 'draft',
};
const REVIEW_COLOR: Record<TC['reviewStatus'], string> = {
  approved: C.success,
  needs_review: C.warning,
  draft: C.fgMuted,
};

// How long a deleted case stays recoverable before the delete is persisted.
const UNDO_MS = 6000;

// Editable case fields — mirrors the Supabase columns persistCaseUpdate writes.
type CaseUpdateFields = Partial<{ title: string; steps_json: string[]; expected_result: string; approved: boolean }>;

// [DEV MOCK PERSISTENCE] Server-side mirror of the Supabase update/delete for
// dev mode: review edits, approvals and deletes are written to the mock store
// (via the dev-only /api/dev/test-cases route) so they survive browser
// refreshes exactly like the real backend would persist them. Module-scope on
// purpose — it needs no Supabase client or component state.
async function persistViaDevApi(method: 'PATCH' | 'DELETE', caseId: string, fields?: CaseUpdateFields): Promise<string | null> {
  try {
    const res = await fetch('/api/dev/test-cases', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, fields }),
      keepalive: method === 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const verb = method === 'PATCH' ? 'save your change' : 'delete the case';
      return `Could not ${verb}: ${data.error || res.status}`;
    }
    return null;
  } catch {
    return method === 'PATCH' ? 'Could not save your change: network error.' : 'Could not delete the case: network error.';
  }
}

export default function IDEPanel({
  artifacts,
  onUpdate,
}: {
  artifacts: Artifact[];
  onUpdate: (arts: Artifact[]) => void;
}) {
  // [FRONTEND-FIRST DEV BYPASS] don't build a Supabase browser client while
  // auth is bypassed; the persist helpers below become no-ops in dev mode.
  const supabase = DEV_BYPASS ? null : createClient();
  const [activeId, setActiveId] = useState<string | null>(artifacts[0]?.id ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  // [PHASE 1] Visible persistence errors (previously console-only) and the
  // pending-delete slot that powers Undo.
  const [persistError, setPersistError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    artId: string;
    caseId: string;
    displayId: string;
    index: number;
    snapshot: TC;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const pendingRef = useRef(pendingDelete);
  pendingRef.current = pendingDelete;

  useEffect(() => {
    if (artifacts.length > 0 && !artifacts.find((a) => a.id === activeId)) {
      setActiveId(artifacts[artifacts.length - 1]?.id ?? null);
    } else if (artifacts.length === 0) {
      setActiveId(null);
    }
  }, [artifacts]);

  // [FRONTEND-FIRST FIX] Auto-focus newly generated artifacts: when a new
  // generation round appends artifacts, jump to the newest tab instead of
  // silently staying on the old one. Initial mount behavior is unchanged
  // (starts on the first artifact).
  const prevLenRef = useRef(artifacts.length);
  useEffect(() => {
    if (artifacts.length > prevLenRef.current) {
      setActiveId(artifacts[artifacts.length - 1]?.id ?? null);
    }
    prevLenRef.current = artifacts.length;
  }, [artifacts]);

  // [PHASE 1] Escape closes the export dropdown.
  useEffect(() => {
    if (!showExport) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExport(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showExport]);

  const art = artifacts.find((a) => a.id === activeId) ?? null;
  const updateArt = (updated: Artifact) => onUpdate(artifacts.map((a) => (a.id === updated.id ? updated : a)));
  // Latest artifacts for precise rollbacks inside async callbacks.
  const artifactsRef = useRef(artifacts);
  artifactsRef.current = artifacts;

  // ---- Real persistence helpers ----
  // [PHASE 1] Return an error message instead of only console.error so the UI
  // can show it and roll the optimistic change back.
  async function persistCaseUpdate(caseId: string, fields: CaseUpdateFields): Promise<string | null> {
    // [FRONTEND-FIRST DEV BYPASS] mirror the Supabase update against the mock
    // store so review curation survives browser refreshes (see persistViaDevApi).
    if (DEV_BYPASS) {
      return persistViaDevApi('PATCH', caseId, fields);
    }
    if (!supabase) return 'Not connected to the database.';
    const { error } = await supabase.from('test_cases').update(fields).eq('id', caseId);
    if (error) {
      console.error('[sepyant] failed to persist test case update:', error.message);
      return `Could not save your change: ${error.message}`;
    }
    return null;
  }
  async function persistCaseDelete(caseId: string): Promise<string | null> {
    // [FRONTEND-FIRST DEV BYPASS] see persistCaseUpdate above.
    if (DEV_BYPASS) {
      return persistViaDevApi('DELETE', caseId);
    }
    if (!supabase) return 'Not connected to the database.';
    const { error } = await supabase.from('test_cases').delete().eq('id', caseId);
    if (error) {
      console.error('[sepyant] failed to persist test case delete:', error.message);
      return `Could not delete the case: ${error.message}`;
    }
    return null;
  }

  // [PHASE 1] Apply an edit optimistically; on persistence failure, revert
  // ONLY the edited case in the latest state and surface the error.
  const editCase = useCallback(
    (art: Artifact, oldCase: TC, nextCase: TC, fields: Parameters<typeof persistCaseUpdate>[1]) => {
      updateArt({ ...art, cases: art.cases!.map((c) => (c.id === oldCase.id ? nextCase : c)) });
      setPersistError(null);
      persistCaseUpdate(nextCase.id, fields).then((err) => {
        if (err) {
          const latest = artifactsRef.current;
          onUpdate(
            latest.map((a) =>
              a.id === art.id ? { ...a, cases: a.cases!.map((c) => (c.id === oldCase.id ? oldCase : c)) } : a
            )
          );
          setPersistError(err);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally bound to the current render's artifacts
    [artifacts, onUpdate]
  );

  // [PHASE 1] Delete with Undo: the row disappears immediately (optimistic)
  // but the DB delete is deferred for UNDO_MS. Undo restores the row; when
  // the window lapses (or the panel unmounts, or another delete starts) the
  // delete is flushed so the DB never silently keeps a "deleted" row.
  const flushPendingDelete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingDelete(null);
    persistCaseDelete(pending.caseId).then((err) => {
      if (err) setPersistError(err);
    });
  }, []);

  const deleteCase = useCallback(
    (art: Artifact, tci: number) => {
      const tc = art.cases![tci];
      // If another delete is still in its undo window, commit it first so
      // there is exactly one pending delete at a time.
      flushPendingDelete();
      const timer = setTimeout(() => {
        pendingRef.current = null;
        setPendingDelete(null);
        persistCaseDelete(tc.id).then((err) => {
          if (err) {
            // Roll the deletion back so the case does not silently vanish.
            const latest = artifactsRef.current;
            const cur = latest.find((a) => a.id === art.id);
            if (cur?.cases) {
              const cases = [...cur.cases];
              cases.splice(Math.min(tci, cases.length), 0, tc);
              onUpdate(latest.map((a) => (a.id === art.id ? { ...a, cases } : a)));
            }
            setPersistError(err);
          }
        });
      }, UNDO_MS);
      pendingRef.current = { artId: art.id, caseId: tc.id, displayId: tc.displayId, index: tci, snapshot: tc, timer };
      setPendingDelete(pendingRef.current);
      updateArt({ ...art, cases: art.cases!.filter((_, i) => i !== tci) });
      setPersistError(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally bound to the current render's artifacts
    [artifacts, flushPendingDelete, onUpdate]
  );

  const undoPendingDelete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingDelete(null);
    // Re-insert the case at (approximately) its old position in the LATEST
    // state. If rows were added meanwhile the index may exceed the list —
    // clamp to the end.
    const latest = artifactsRef.current;
    const current = latest.find((a) => a.id === pending.artId);
    if (current?.cases) {
      const cases = [...current.cases];
      cases.splice(Math.min(pending.index, cases.length), 0, pending.snapshot);
      onUpdate(latest.map((a) => (a.id === pending.artId ? { ...a, cases } : a)));
    }
  }, [onUpdate]);

  // Flush a still-pending delete when leaving the workspace so the DB delete
  // is not silently dropped.
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      if (DEV_BYPASS) {
        // [DEV MOCK PERSISTENCE] keep the mock store consistent on unmount.
        persistViaDevApi('DELETE', pending.caseId);
        return;
      }
      if (supabase) {
        supabase.from('test_cases').delete().eq('id', pending.caseId);
      }
    };
  }, [supabase]);

  if (artifacts.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" style={{ stroke: C.fgMuted, opacity: 0.25 }} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <div style={{ fontSize: 13, color: C.fgMuted }}>Ask the AI to generate a test plan to get started</div>
        <div style={{ fontSize: 11, color: alpha(C.fgMuted, 50), fontFamily: 'var(--font-mono)' }}>sepyant · qa workspace</div>
      </div>
    );
  }

  const pri = (p: TC['priority']) => (p === 'critical' || p === 'high' ? C.danger : p === 'medium' ? C.warning : C.fgMuted);

  // [PHASE 1] Approval-workflow counts for the export menu.
  const approvedCount = art?.cases?.filter((c) => c.reviewStatus === 'approved').length ?? 0;
  const totalCount = art?.cases?.length ?? 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={() => setShowExport(false)}>
      {/* Artifact selector tabs */}
      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: C.surface, flexShrink: 0 }}>
        {artifacts.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveId(a.id)}
            aria-pressed={activeId === a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'all 100ms',
              border: `1px solid ${activeId === a.id ? C.accent : C.border}`,
              background: activeId === a.id ? alpha(C.accent, 9) : 'transparent',
              color: activeId === a.id ? C.accent : C.fgDim,
            }}
          >
            <span style={{ fontSize: 11 }}>{typeIcon[a.type]}</span>
            {a.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {art && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowExport((s) => !s);
              }}
              aria-label="Download artifact"
              aria-haspopup="menu"
              aria-expanded={showExport}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.fgMuted, cursor: 'pointer' }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Download
            </button>
            {showExport && (
              <div
                role="menu"
                aria-label="Export options"
                style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, zIndex: 50, minWidth: 230, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {art.type === 'testcases' ? (
                  // [PHASE 1] The deliverable is the approved set (approval
                  // workflow: draft -> review -> approved -> export). Exporting
                  // everything is still possible but clearly labeled.
                  [
                    { label: `Approved cases (${approvedCount}) — CSV`, scope: 'approved' as ExportScope, fmt: 'csv' as const, disabled: approvedCount === 0, hint: approvedCount === 0 ? 'No approved cases yet' : undefined },
                    { label: `Approved cases (${approvedCount}) — DOC`, scope: 'approved' as ExportScope, fmt: 'doc' as const, disabled: approvedCount === 0, hint: approvedCount === 0 ? 'No approved cases yet' : undefined },
                    { label: `All cases (${totalCount}) incl. drafts — CSV`, scope: 'all' as ExportScope, fmt: 'csv' as const, disabled: totalCount === 0 },
                    { label: `All cases (${totalCount}) incl. drafts — DOC`, scope: 'all' as ExportScope, fmt: 'doc' as const, disabled: totalCount === 0 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      disabled={item.disabled}
                      title={item.hint}
                      onClick={() => {
                        if (item.fmt === 'csv') exportCSV(art, item.scope);
                        else exportDoc(art, item.scope);
                        setShowExport(false);
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 5, border: 'none', background: 'transparent', color: item.disabled ? C.fgMuted : C.fg, fontSize: 13, cursor: item.disabled ? 'default' : 'pointer', display: 'block', opacity: item.disabled ? 0.55 : 1 }}
                      onMouseEnter={(e) => {
                        if (!item.disabled) e.currentTarget.style.background = C.border;
                      }}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.label}
                    </button>
                  ))
                ) : (
                  [
                    ['CSV / Excel', () => exportCSV(art)],
                    ['DOC / Text', () => exportDoc(art)],
                  ].map(([label, fn]) => (
                    <button
                      key={label as string}
                      role="menuitem"
                      onClick={() => {
                        (fn as () => void)();
                        setShowExport(false);
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 5, border: 'none', background: 'transparent', color: C.fg, fontSize: 13, cursor: 'pointer', display: 'block' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.border)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {label as string}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* [PHASE 1] Visible persistence errors (previously console-only). */}
      {persistError && (
        <div role="alert" style={{ margin: '10px 24px 0', padding: '9px 12px', fontSize: 12, lineHeight: 1.5, borderRadius: 8, border: `1px solid ${alpha(C.danger, 33)}`, background: alpha(C.danger, 8), color: C.danger, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>{persistError}</span>
          <button onClick={() => setPersistError(null)} aria-label="Dismiss error" style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 4px' }}>
            ×
          </button>
        </div>
      )}

      {/* [PHASE 1] Delete undo window. */}
      {pendingDelete && (
        <div style={{ margin: '10px 24px 0', padding: '9px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${alpha(C.warning, 33)}`, background: alpha(C.warning, 7), color: C.warning, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>
            {pendingDelete.displayId} deleted — it will be removed permanently in a few seconds.
          </span>
          <button onClick={undoPendingDelete} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: `1px solid ${alpha(C.warning, 40)}`, background: 'transparent', color: C.warning, cursor: 'pointer' }}>
            Undo
          </button>
        </div>
      )}

      {/* Content */}
      {art && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {/* Test Cases */}
          {art.type === 'testcases' &&
            art.cases &&
            art.cases.map((tc, tci) => (
              <div key={tc.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded === tc.id}
                  aria-label={`${expanded === tc.id ? 'Collapse' : 'Expand'} test case ${tc.displayId}: ${tc.title}`}
                  onClick={() => setExpanded(expanded === tc.id ? null : tc.id)}
                  onKeyDown={(e) => {
                    // [FRONTEND-FIRST FIX] keyboard access for case rows
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpanded(expanded === tc.id ? null : tc.id);
                    }
                  }}
                  onFocus={(e) => (e.currentTarget.style.background = C.surface2)}
                  onBlur={(e) => (e.currentTarget.style.background = 'transparent')}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: C.accent, minWidth: 68, flexShrink: 0 }}>{tc.displayId}</span>
                  <span style={{ fontSize: 13, color: C.fg, flex: 1 }}>{tc.title}</span>
                  {tc.needsVerification && (
                    <span title="Relies on an assumption that was not stated in the requirement" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: alpha(C.warning, 8), color: C.warning, border: `1px solid ${alpha(C.warning, 19)}`, flexShrink: 0 }}>
                      needs verification
                    </span>
                  )}
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: `${pri(tc.priority)}15`, color: pri(tc.priority), border: `1px solid ${pri(tc.priority)}30`, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {tc.priority}
                  </span>
                  {/* [PHASE 1] Review status only — execution status is shown
                      inside the expanded detail, keeping the two concerns apart. */}
                  <span style={{ fontSize: 11, color: REVIEW_COLOR[tc.reviewStatus], minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
                    {REVIEW_LABEL[tc.reviewStatus]}
                  </span>
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ stroke: C.fgMuted, transform: expanded === tc.id ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
                {expanded === tc.id && (
                  <div onClick={(e) => e.stopPropagation()} style={{ padding: '16px 0 20px 82px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: C.fgMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</div>
                      <EditableText
                        value={tc.title}
                        style={{ fontSize: 13, color: C.fg }}
                        onChange={(v) => editCase(art, tc, { ...tc, title: v }, { title: v })}
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: C.fgMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Steps</div>
                      {tc.steps.map((s, si) => (
                        <div key={si} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: C.accent, minWidth: 20, flexShrink: 0 }}>{String(si + 1).padStart(2, '0')}</span>
                          <EditableText
                            value={s}
                            style={{ fontSize: 12, color: C.fgDim }}
                            onChange={(v) => {
                              const newSteps = tc.steps.map((st, j) => (j === si ? v : st));
                              editCase(art, tc, { ...tc, steps: newSteps }, { steps_json: newSteps });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: C.fgMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expected Result</div>
                      <EditableText
                        value={tc.expected}
                        multiline
                        style={{ fontSize: 12, color: C.fgDim, lineHeight: 1.6 }}
                        onChange={(v) => editCase(art, tc, { ...tc, expected: v }, { expected_result: v })}
                      />
                    </div>
                    {/* [PHASE 1] Read-only execution status, separate from the
                        review controls below. Actual runs are Phase 2. */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: C.fgMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Execution</div>
                      <div style={{ fontSize: 12, color: C.fgDim, fontFamily: 'var(--font-mono)' }}>
                        {tc.executionStatus}
                        <span style={{ color: C.fgMuted, fontFamily: 'inherit' }}> — test execution arrives in Phase 2; approving does not change this.</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          // [PHASE 1] Approving returns to the correct review
                          // state on un-approve (previously collapsed to
                          // 'draft', losing the needs-review signal).
                          const approving = tc.reviewStatus !== 'approved';
                          const nextReview: TC['reviewStatus'] = approving ? 'approved' : tc.needsVerification ? 'needs_review' : 'draft';
                          editCase(art, tc, { ...tc, reviewStatus: nextReview }, { approved: approving });
                        }}
                        style={{
                          fontSize: 11,
                          padding: '4px 12px',
                          borderRadius: 4,
                          border: `1px solid ${tc.reviewStatus === 'approved' ? C.success : C.border}`,
                          background: tc.reviewStatus === 'approved' ? alpha(C.success, 8) : 'transparent',
                          color: tc.reviewStatus === 'approved' ? C.success : C.fgDim,
                          cursor: 'pointer',
                        }}
                      >
                        {tc.reviewStatus === 'approved' ? '✓ Approved' : 'Approve'}
                      </button>
                      <button
                        onClick={() => deleteCase(art, tci)}
                        aria-label={`Delete test case ${tc.displayId}`}
                        title="Deletes after a short undo window"
                        style={{ fontSize: 11, padding: '4px 12px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.fgMuted, cursor: 'pointer', marginLeft: 'auto' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {/* Test Plan */}
          {art.type === 'testplan' && art.plan && (
            <div style={{ paddingTop: 18 }}>
              {art.plan.map((item, i) => (
                <div key={i} style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: C.accent, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.section}</div>
                  <div style={{ fontSize: 13, color: C.fgDim, lineHeight: 1.7 }}>{item.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
