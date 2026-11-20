'use client';

// ============================================================================
// [DASHBOARD] Lightweight dependency-free SVG charts for the Test Quality
// Dashboard. Hand-rolled (instead of a chart library) so they use the exact
// workspace palette from lib/theme.ts, stay crisp on any viewport, and add
// zero dependencies to package.json.
//
// Shared technique: a ResizeObserver measures the container so each chart
// draws at true pixel size — exact 1px grid strokes, precise hover math, and
// responsive behavior without stretched-viewBox distortion.
// ============================================================================

import { useEffect, useId, useRef, useState } from 'react';
import { C } from '@/lib/theme';

function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

// Smooth path through midpoints (cubic beziers with horizontal control arms):
// no overshoot on the Y axis, so coverage percentages never visually dip
// below their real values.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Coverage trend — area + line with hover crosshair and tooltip
// ---------------------------------------------------------------------------

export function CoverageTrendChart({
  points,
  height = 236,
  unit = '%',
  ariaLabel,
}: {
  points: { label: string; value: number }[];
  height?: number;
  unit?: string;
  ariaLabel: string;
}) {
  const { ref, width } = useMeasuredWidth();
  const gradientId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const padL = 38;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const innerW = Math.max(0, width - padL - padR);
  const innerH = Math.max(0, height - padT - padB);

  if (width === 0) {
    // First render (before the ResizeObserver fires): keep the layout stable.
    return <div ref={ref} style={{ width: '100%', height }} aria-label={ariaLabel} role="img" />;
  }

  const values = points.map((p) => p.value);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const yMin = Math.max(0, Math.floor((rawMin - 5) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((rawMax + 5) / 10) * 10);
  const x = (i: number) => (points.length <= 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const pts = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  const line = smoothPath(pts);
  const area = line ? `${line} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z` : '';

  const gridCount = 4;
  const gridValues = Array.from({ length: gridCount + 1 }, (_, i) => yMin + ((yMax - yMin) / gridCount) * i);

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const labelIdx = points.map((_, i) => i).filter((i) => i % labelStep === 0 || i === points.length - 1);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const t = innerW > 0 ? (px - padL) / innerW : 0;
    const i = Math.round(t * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const hp = hover !== null ? pts[hover] : null;
  const tipX = hp ? Math.max(54, Math.min(width - 54, hp.x)) : 0;

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {/* [2.1] var() doesn't resolve in SVG presentation attributes — colors go through style */}
            <stop offset="0%" style={{ stopColor: C.accent, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: C.accent, stopOpacity: 0.02 }} />
          </linearGradient>
        </defs>

        {gridValues.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y(gv)} y2={y(gv)} style={{ stroke: C.border }} strokeWidth={1} />
            <text x={padL - 8} y={y(gv) + 3.5} textAnchor="end" fontSize={10} style={{ fill: C.fgMuted }} fontFamily="var(--font-mono)">
              {Math.round(gv)}
              {unit}
            </text>
          </g>
        ))}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && <path d={line} fill="none" style={{ stroke: C.accent }} strokeWidth={2} strokeLinecap="round" />}

        {pts.length > 0 && (
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5} style={{ fill: C.accent, stroke: C.bg }} strokeWidth={1.5} />
        )}

        {hp && (
          <g>
            <line x1={hp.x} x2={hp.x} y1={padT} y2={padT + innerH} style={{ stroke: C.muted }} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hp.x} cy={hp.y} r={4.5} style={{ fill: C.accent, stroke: C.bg }} strokeWidth={2} />
          </g>
        )}

        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} style={{ fill: C.fgMuted }}>
            {points[i].label}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div
          style={{
            position: 'absolute',
            left: tipX,
            top: Math.max(4, hp.y - 14),
            transform: 'translate(-50%, -100%)',
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 7,
            padding: '6px 10px',
            pointerEvents: 'none',
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 10, color: C.fgMuted, marginBottom: 2 }}>{points[hover].label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>
            {points[hover].value}
            {unit}
            <span style={{ fontSize: 10, fontWeight: 500, color: C.fgMuted, marginLeft: 6 }}>coverage</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review-status donut with hoverable segments and an interactive center label
// ---------------------------------------------------------------------------

export function StatusDonut({
  segments,
  size = 168,
  thickness = 20,
  centerTitle = 'total cases',
  ariaLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const denom = total || 1;
  const r = (size - thickness - 10) / 2;
  const circ = 2 * Math.PI * r;

  let acc = 0;
  const arcs = segments.map((s) => {
    const dash = (s.value / denom) * circ;
    const arc = { ...s, dash, offset: acc, frac: s.value / denom };
    acc += dash;
    return arc;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} onMouseLeave={() => setHover(null)}>
        <svg width={size} height={size} role="img" aria-label={ariaLabel} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: C.surface2 }} strokeWidth={thickness} />
          {arcs.map((a, i) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === i ? thickness + 5 : thickness}
              strokeDasharray={`${Math.max(a.dash - 2, 0.5)} ${circ - Math.max(a.dash - 2, 0.5)}`}
              strokeDashoffset={-(a.offset + 1)}
              opacity={hover === null || hover === i ? 1 : 0.3}
              onMouseEnter={() => setHover(i)}
              style={{ transition: 'opacity 120ms ease, stroke-width 120ms ease', cursor: 'default' }}
            />
          ))}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: C.fg, letterSpacing: '-0.02em' }}>
            {hover === null ? total : arcs[hover].value}
          </div>
          <div style={{ fontSize: 10.5, color: C.fgMuted, marginTop: 2 }}>
            {hover === null ? centerTitle : `${arcs[hover].label} · ${Math.round(arcs[hover].frac * 100)}%`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', maxWidth: 220 }}>
        {arcs.map((a, i) => (
          <div
            key={a.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: hover === i ? C.fg : C.fgDim,
              padding: '3px 8px',
              borderRadius: 6,
              background: hover === i ? C.surface2 : 'transparent',
              cursor: 'default',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{a.label}</span>
            <span style={{ fontWeight: 600, color: hover === i ? C.fg : C.fgDim }}>{a.value}</span>
            <span style={{ color: C.fgMuted, width: 34, textAlign: 'right', fontSize: 11 }}>{Math.round(a.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk by module — stacked horizontal bars (high / medium / low)
// ---------------------------------------------------------------------------

export function RiskByModuleChart({
  rows,
  ariaLabel,
}: {
  rows: { label: string; high: number; medium: number; low: number }[];
  ariaLabel: string;
}) {
  const colors: Record<'high' | 'medium' | 'low', string> = { high: C.danger, medium: C.warning, low: C.success };
  const max = Math.max(...rows.map((r) => r.high + r.medium + r.low), 1);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div role="img" aria-label={ariaLabel}>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginBottom: 10 }}>
        {(['high', 'medium', 'low'] as const).map((k) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.fgMuted, textTransform: 'capitalize' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[k] }} />
            {k}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((row) => {
          const total = row.high + row.medium + row.low;
          const isHover = hover === row.label;
          return (
            <div
              key={row.label}
              onMouseEnter={() => setHover(row.label)}
              onMouseLeave={() => setHover(null)}
              title={`${row.label} — ${row.high} high · ${row.medium} medium · ${row.low} low risk`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 6px', borderRadius: 6, background: isHover ? C.surface2 : 'transparent', transition: 'background 120ms ease' }}
            >
              <div
                style={{
                  width: 148,
                  flexShrink: 0,
                  fontSize: 11.5,
                  color: isHover ? C.fg : C.fgDim,
                  textAlign: 'right',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.label}
              </div>
              <div style={{ flex: 1, display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: C.surface2 }}>
                {(['high', 'medium', 'low'] as const).map((k) =>
                  row[k] > 0 ? (
                    <div
                      key={k}
                      style={{ width: `${(row[k] / max) * 100}%`, background: colors[k], opacity: isHover ? 1 : 0.85, transition: 'opacity 120ms ease' }}
                    />
                  ) : null
                )}
              </div>
              <div style={{ width: 24, flexShrink: 0, fontSize: 11, color: C.fgMuted, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{total}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module coverage — horizontal bars with a dashed target marker
// ---------------------------------------------------------------------------

export function ModuleCoverageBars({
  rows,
  target = 80,
}: {
  rows: { label: string; covered: number; total: number }[];
  target?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} role="img" aria-label="Coverage by module">
      {rows.map((row) => {
        const pct = Math.round((row.covered / Math.max(row.total, 1)) * 1000) / 10;
        const color = pct >= target ? C.success : pct >= 60 ? C.warning : C.danger;
        return (
          <div key={row.label}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: C.fg, fontWeight: 500 }}>{row.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
            </div>
            <div
              style={{ position: 'relative', height: 8, borderRadius: 4, background: C.surface2, overflow: 'visible' }}
              title={`${row.covered}/${row.total} cases covered · target ${target}%`}
            >
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, background: color, borderRadius: 4, opacity: 0.9 }} />
              <div
                style={{ position: 'absolute', left: `${target}%`, top: -2, bottom: -2, width: 2, background: C.fgMuted, opacity: 0.65 }}
                title={`Target ${target}%`}
              />
            </div>
            <div style={{ marginTop: 5, fontSize: 10.5, color: C.fgMuted }}>
              {row.covered}/{row.total} cases covered · target {target}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
