'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';
import type { Artifact, TC } from './types';
import { typeIcon } from './types';
import { EditableText } from './primitives';
import { exportCSV, exportDoc } from './export';

export default function IDEPanel({
  artifacts,
  onUpdate,
}: {
  artifacts: Artifact[];
  onUpdate: (arts: Artifact[]) => void;
}) {
  const supabase = createClient();
  const [activeId, setActiveId] = useState<string | null>(artifacts[0]?.id ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (artifacts.length > 0 && !artifacts.find((a) => a.id === activeId)) {
      setActiveId(artifacts[artifacts.length - 1]?.id ?? null);
    } else if (artifacts.length === 0) {
      setActiveId(null);
    }
  }, [artifacts]);

  const art = artifacts.find((a) => a.id === activeId) ?? null;
  const updateArt = (updated: Artifact) => onUpdate(artifacts.map((a) => (a.id === updated.id ? updated : a)));

  // ---- Real persistence helpers ----
  async function persistCaseUpdate(caseId: string, fields: Partial<{ title: string; steps_json: string[]; expected_result: string; approved: boolean }>) {
    await supabase.from('test_cases').update(fields).eq('id', caseId);
  }
  async function persistCaseDelete(caseId: string) {
    await supabase.from('test_cases').delete().eq('id', caseId);
  }

  if (artifacts.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={C.fgMuted} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <div style={{ fontSize: 13, color: C.fgMuted }}>Ask the AI to generate a test plan to get started</div>
        <div style={{ fontSize: 11, color: `${C.fgMuted}80`, fontFamily: 'var(--font-mono)' }}>sepyant · ai qa ide</div>
      </div>
    );
  }

  const pri = (p: TC['priority']) => (p === 'critical' || p === 'high' ? C.danger : p === 'medium' ? C.warning : C.fgMuted);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={() => setShowExport(false)}>
      {/* Artifact selector tabs */}
      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: C.surface, flexShrink: 0 }}>
        {artifacts.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveId(a.id)}
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
              background: activeId === a.id ? `${C.accent}18` : 'transparent',
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
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.fgMuted, cursor: 'pointer' }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Download
            </button>
            {showExport && (
              <div
                style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, zIndex: 50, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  ['CSV / Excel', () => exportCSV(art)],
                  ['DOC / Text', () => exportDoc(art)],
                ].map(([label, fn]) => (
                  <button
                    key={label as string}
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
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {art && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {/* Test Cases */}
          {art.type === 'testcases' &&
            art.cases &&
            art.cases.map((tc, tci) => (
              <div key={tc.id}>
                <div
                  onClick={() => setExpanded(expanded === tc.id ? null : tc.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: C.accent, minWidth: 68, flexShrink: 0 }}>{tc.displayId}</span>
                  <span style={{ fontSize: 13, color: C.fg, flex: 1 }}>{tc.title}</span>
                  {tc.needsVerification && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: `${C.warning}15`, color: C.warning, border: `1px solid ${C.warning}30`, flexShrink: 0 }}>
                      needs verification
                    </span>
                  )}
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: `${pri(tc.priority)}15`, color: pri(tc.priority), border: `1px solid ${pri(tc.priority)}30`, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {tc.priority}
                  </span>
                  <span style={{ fontSize: 11, color: tc.status === 'approved' ? C.success : tc.status === 'review' ? C.warning : C.fgMuted, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                    {tc.status}
                  </span>
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={C.fgMuted}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: expanded === tc.id ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}
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
                        onChange={(v) => {
                          updateArt({ ...art, cases: art.cases!.map((c, i) => (i === tci ? { ...c, title: v } : c)) });
                          persistCaseUpdate(tc.id, { title: v });
                        }}
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
                              updateArt({ ...art, cases: art.cases!.map((c, i) => (i === tci ? { ...c, steps: newSteps } : c)) });
                              persistCaseUpdate(tc.id, { steps_json: newSteps });
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
                        onChange={(v) => {
                          updateArt({ ...art, cases: art.cases!.map((c, i) => (i === tci ? { ...c, expected: v } : c)) });
                          persistCaseUpdate(tc.id, { expected_result: v });
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          const nowApproved = tc.status !== 'approved';
                          updateArt({ ...art, cases: art.cases!.map((c, i) => (i === tci ? { ...c, status: nowApproved ? 'approved' : 'draft' } : c)) });
                          persistCaseUpdate(tc.id, { approved: nowApproved });
                        }}
                        style={{
                          fontSize: 11,
                          padding: '4px 12px',
                          borderRadius: 4,
                          border: `1px solid ${tc.status === 'approved' ? C.success : C.border}`,
                          background: tc.status === 'approved' ? `${C.success}15` : 'transparent',
                          color: tc.status === 'approved' ? C.success : C.fgDim,
                          cursor: 'pointer',
                        }}
                      >
                        {tc.status === 'approved' ? '✓ Approved' : 'Approve'}
                      </button>
                      <button
                        onClick={() => {
                          updateArt({ ...art, cases: art.cases!.filter((_, i) => i !== tci) });
                          persistCaseDelete(tc.id);
                        }}
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
