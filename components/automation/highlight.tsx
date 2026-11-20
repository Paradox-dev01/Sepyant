'use client';

// ============================================================================
// [SEPYANT 2.0] Dependency-free syntax highlighting for the generated
// automation scripts (Phase 4). One regex pass per language family; every
// token renders as a <span> colored from the C palette. No third-party
// highlighter and no manual HTML escaping — everything is plain React text
// nodes, so arbitrary generated code is safe to render.
// ============================================================================

import { C, alpha } from '@/lib/theme';

export type CodeLang = 'ts' | 'js' | 'java' | 'python' | 'json';

const COLOR = {
  keyword: C.accent,
  string: C.success,
  comment: C.fgMuted,
  number: C.warning,
  annotation: C.ai,
  plain: C.fgDim,
} as const;

// ---------------------------------------------------------------------------
// Tokenizers. Single alternation pass; group order matters — comments and
// strings must be tried before keywords/numbers so tokens inside them are
// never mis-colored. Sources are plain strings and a fresh RegExp is built per
// call (global regexes are stateful, so sharing one instance is unsafe).
//
// Groups (C-like / Python):
//   1 comments · 2 strings · 3 keywords · 4 annotations (@decorator) ·
//   5 bracket attributes ([Test], C-like only) · 6 numbers
// JSON: 1 strings · 2 true/false/null · 3 numbers
// ---------------------------------------------------------------------------

const C_LIKE_SOURCE = String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(import|from|const|let|var|async|await|function|return|new|class|interface|type|enum|export|default|extends|implements|public|private|protected|static|void|package|using|namespace|if|else|for|while|try|catch|finally|throw|throws|test|describe|it|expect|assert)\b|(@[A-Za-z_]\w*)|(\[[A-Za-z][^\]\n]{0,40}\])|\b(\d[\d_]*(?:\.\d+)?)\b`;

const PYTHON_SOURCE = String.raw`(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(import|from|def|class|return|assert|yield|if|elif|else|for|while|try|except|finally|with|as|pass|raise|lambda|not|and|or|in|is|None|True|False|async|await|self)\b|(@[A-Za-z_]\w*)|\b(\d[\d_]*(?:\.\d+)?)\b`;

const JSON_SOURCE = String.raw`("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)`;

/** Tokenize code into colored spans. Pure — safe for render. */
export function highlightCode(code: string, lang: CodeLang): React.ReactNode[] {
  const source = lang === 'python' ? PYTHON_SOURCE : lang === 'json' ? JSON_SOURCE : C_LIKE_SOURCE;
  const re = new RegExp(source, 'g');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(code)) !== null) {
    if (match.index > last) {
      nodes.push(
        <span key={key++} style={{ color: COLOR.plain }}>
          {code.slice(last, match.index)}
        </span>
      );
    }

    const [text, comment, str, keyword, annotation, attrOrNum, num] = match;
    let style: React.CSSProperties = { color: COLOR.plain };
    if (comment !== undefined) style = { color: COLOR.comment, fontStyle: 'italic' };
    else if (str !== undefined) style = { color: COLOR.string };
    else if (keyword !== undefined) style = { color: COLOR.keyword };
    else if (annotation !== undefined) style = { color: COLOR.annotation };
    else if (attrOrNum !== undefined) style = { color: lang === 'json' ? COLOR.number : COLOR.annotation };
    else if (num !== undefined) style = { color: COLOR.number };

    nodes.push(
      <span key={key++} style={style}>
        {text}
      </span>
    );
    last = match.index + text.length;
    if (text.length === 0) re.lastIndex += 1; // guard against zero-width loops
  }

  if (last < code.length) {
    nodes.push(
      <span key={key++} style={{ color: COLOR.plain }}>
        {code.slice(last)}
      </span>
    );
  }
  return nodes;
}

/**
 * Scrollable code viewer: a monospace line-number gutter (non-selectable,
 * sticky on horizontal scroll) next to highlighted content. When
 * `lineIdPrefix` is given, each gutter cell gets id `<prefix>-<line>` so the
 * mapping table can scroll a step into view; `focusLine` highlights one line.
 */
export function CodeBlock({
  code,
  lang,
  lineIdPrefix,
  focusLine,
  maxHeight,
}: {
  code: string;
  lang: CodeLang;
  lineIdPrefix?: string;
  focusLine?: number | null;
  maxHeight?: number | string;
}) {
  const lines = code.split('\n');
  const highlighted = highlightCode(code, lang);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '14px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.65,
        overflow: 'auto',
        maxHeight,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          position: 'sticky',
          left: 0,
          zIndex: 1,
          background: C.bg,
          padding: '0 10px 0 14px',
          textAlign: 'right',
          color: C.fgMuted,
          userSelect: 'none',
          borderRight: `1px solid ${C.border}`,
        }}
      >
        {lines.map((_, idx) => {
          const n = idx + 1;
          const focused = focusLine === n;
          return (
            <div
              key={n}
              id={lineIdPrefix ? `${lineIdPrefix}-${n}` : undefined}
              style={{
                minWidth: 26,
                borderRadius: 3,
                background: focused ? alpha(C.accent, 15) : undefined,
                color: focused ? C.accent : undefined,
              }}
            >
              {n}
            </div>
          );
        })}
      </div>
      <pre
        style={{
          margin: 0,
          padding: '0 18px',
          flexGrow: 1,
          flexShrink: 0,
          flexBasis: 'auto',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        }}
      >
        <code style={{ fontFamily: 'inherit' }}>{highlighted}</code>
      </pre>
    </div>
  );
}
