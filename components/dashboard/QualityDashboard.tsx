'use client';

// ============================================================================
// [DASHBOARD] AI Test Quality Dashboard — a polished, frontend-only overview
// of test suite quality: totals, review status, coverage charts, scenario
// risk, coverage gaps, and simulated AI recommendations.
//
// Integration: rendered at /dashboard inside the SAME AppSidebar shell as the
// three-panel workspace (which stays untouched). All data comes from the
// deterministic mock dataset in lib/dashboard-mock.ts — no backend calls, so
// the dashboard behaves identically with or without the dev-bypass flag.
// Honest by convention: the header carries a "Demo data" chip like the rest
// of the app's mock surfaces.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  FolderKanban,
  Layers,
  MessageSquare,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Undo2,
  Users,
  XCircle,
} from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppSidebar from '@/components/workspace/AppSidebar';
import { CoverageTrendChart, ModuleCoverageBars, RiskByModuleChart, StatusDonut } from './charts';
import { DASHBOARD_PROJECTS, type DashboardProjectData, type RiskLevel } from '@/lib/dashboard-mock';
import { CONVERSATIONS_SEED } from '@/lib/qa-mock/conversations';
import { DOCUMENTS_SEED } from '@/lib/qa-mock/documents';
import { FRAMEWORKS } from '@/lib/qa-mock/automation';
import { TEAM_SEED } from '@/lib/qa-mock/team';

const RANGES = [7, 30, 90] as const;
type RangeKey = (typeof RANGES)[number];
type TabKey = 'overview' | 'coverage' | 'recommendations';
type GapFilter = 'all' | RiskLevel;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'coverage', label: 'Coverage & Gaps' },
  { key: 'recommendations', label: 'AI Recommendations' },
];

const RISK_COLOR: Record<RiskLevel, string> = { high: C.danger, medium: C.warning, low: C.success };

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Card({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={className}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', minWidth: 0 }}
    >
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            {title && <div style={{ fontSize: 13.5, fontWeight: 600, color: C.fg }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 3 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  valueColor,
  sub,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueColor?: string;
  sub: string;
  delta?: React.ReactNode;
}) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '13px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 9 }}>
        <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <span style={{ color: C.fgMuted, display: 'flex', flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: valueColor || C.fg, fontFamily: 'var(--font-mono)' }}>{value}</span>
        {delta}
      </div>
      <div style={{ fontSize: 10.5, color: C.fgMuted, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        fontWeight: 600,
        color,
        background: alpha(color, 8),
        border: `1px solid ${alpha(color, 27)}`,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10.5,
        fontWeight: 600,
        color: up ? C.success : C.danger,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}
      {delta} pts
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export default function QualityDashboard({
  projects,
  userEmail,
}: {
  projects: { id: string; name: string }[];
  userEmail: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(DASHBOARD_PROJECTS[0].id);
  const [range, setRange] = useState<RangeKey>(30);
  const [tab, setTab] = useState<TabKey>('overview');
  const [gapFilter, setGapFilter] = useState<GapFilter>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Same responsive default as the workspace: the fixed-width sidebar starts
  // hidden on narrow screens (the floating "show sidebar" button reveals it).
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarVisible(false);
  }, []);

  const data: DashboardProjectData = DASHBOARD_PROJECTS.find((p) => p.id === projectId) ?? DASHBOARD_PROJECTS[0];

  const series = useMemo(() => data.daily.slice(-range), [data, range]);
  const prevPoint = data.daily.length > range ? data.daily[data.daily.length - range - 1] : null;
  const coverageDelta = Math.round((series[series.length - 1].coverage - (prevPoint?.coverage ?? series[0].coverage)) * 10) / 10;
  const generatedInRange = series.reduce((s, p) => s + p.generated, 0);
  const approvalRate = Math.round((data.totals.approved / Math.max(data.totals.cases, 1)) * 1000) / 10;

  const visibleRecs = data.recommendations.filter((r) => !dismissed.has(r.id));
  const gapCounts: Record<GapFilter, number> = {
    all: data.gaps.length,
    high: data.gaps.filter((g) => g.severity === 'high').length,
    medium: data.gaps.filter((g) => g.severity === 'medium').length,
    low: data.gaps.filter((g) => g.severity === 'low').length,
  };
  const shownGaps = gapFilter === 'all' ? data.gaps : data.gaps.filter((g) => g.severity === gapFilter);

  const reqPct = Math.round((data.coverage.coveredRequirements / Math.max(data.coverage.totalRequirements, 1)) * 1000) / 10;

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }
  function restoreAll() {
    setDismissed(new Set());
  }
  function queue(id: string) {
    setQueued((prev) => new Set(prev).add(id));
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.fg, overflow: 'hidden' }}>
      <AppSidebar
        currentProjectId=""
        projects={projects}
        userEmail={userEmail}
        visible={sidebarVisible}
        onHide={() => setSidebarVisible(false)}
        width={224}
        activeView="dashboard"
      />
      {sidebarVisible && <div style={{ width: 1, background: C.border, flexShrink: 0 }} />}

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}>
        {!sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            title="Show sidebar"
            aria-label="Show sidebar"
            style={{
              position: 'fixed',
              top: 10,
              left: 10,
              zIndex: 30,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.fgMuted,
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 6,
              display: 'flex',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 28px 56px' }}>
          {/* ---------------------------------------------------- header */}
          <header>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <Sparkles size={17} color={C.ai} />
                  <h1 style={{ fontSize: 18, fontWeight: 700, color: C.fg, letterSpacing: '-0.01em', margin: 0 }}>Test Quality Dashboard</h1>
                  <span
                    title="Static demo dataset — no backend calls"
                    style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.warning, border: `1px solid ${alpha(C.warning, 33)}`, background: alpha(C.warning, 7), padding: '2px 6px', borderRadius: 4 }}
                  >
                    DEMO DATA
                  </span>
                </div>
                <p style={{ fontSize: 12, color: C.fgMuted, marginTop: 6, marginBottom: 0 }}>
                  AI test quality overview for your generated suites · mock dataset, not connected to the backend
                </p>
              </div>

              <div role="group" aria-label="Time range" style={{ display: 'inline-flex', gap: 2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: 3 }}>
                {RANGES.map((r) => (
                  <button
                    key={r}
                    aria-pressed={range === r}
                    onClick={() => setRange(r)}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: range === r ? C.surface2 : 'transparent',
                      color: range === r ? C.fg : C.fgMuted,
                      cursor: 'pointer',
                      fontWeight: range === r ? 600 : 500,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.fgMuted }}>
                Project
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-label="Dashboard project"
                  style={{ background: C.surface, color: C.fg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 12.5, outline: 'none', cursor: 'pointer' }}
                >
                  {DASHBOARD_PROJECTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ fontSize: 11, color: C.fgMuted }}>{data.tagline}</div>
            </div>

            <div
              role="tablist"
              aria-label="Dashboard sections"
              style={{ display: 'inline-flex', gap: 2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: 3, marginTop: 16 }}
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  id={`tab-${t.key}`}
                  role="tab"
                  aria-selected={tab === t.key}
                  aria-controls={`panel-${t.key}`}
                  onClick={() => setTab(t.key)}
                  style={{
                    fontSize: 12.5,
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: tab === t.key ? `1px solid ${C.border}` : '1px solid transparent',
                    background: tab === t.key ? C.surface2 : 'transparent',
                    color: tab === t.key ? C.fg : C.fgMuted,
                    cursor: 'pointer',
                    fontWeight: tab === t.key ? 600 : 500,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </header>

          {/* ---------------------------------------------------- panels */}
          <div style={{ marginTop: 18 }}>
            {tab === 'overview' && (
              <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <KpiCard icon={<Layers size={14} />} label="Total test cases" value={data.totals.cases} sub={`${generatedInRange} generated in last ${range} days`} />
                  <KpiCard icon={<CheckCircle2 size={14} />} label="Approved" value={data.totals.approved} valueColor={C.success} sub={`${approvalRate}% of all cases`} />
                  <KpiCard icon={<Clock size={14} />} label="Pending review" value={data.totals.pending} valueColor={C.warning} sub="needs review / verification" />
                  <KpiCard icon={<XCircle size={14} />} label="Rejected" value={data.totals.rejected} valueColor={C.danger} sub="sent back for rework" />
                  <KpiCard
                    icon={<Target size={14} />}
                    label="Coverage score"
                    value={`${data.coverage.overall}%`}
                    delta={<DeltaChip delta={coverageDelta} />}
                    sub={`target ${data.coverage.target}% · last ${range} days`}
                  />
                  <KpiCard icon={<AlertTriangle size={14} />} label="High-risk scenarios" value={data.scenarios.high} valueColor={C.danger} sub={`of ${data.scenarios.total} total scenarios`} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <Card className="xl:col-span-2" title="Coverage by day" subtitle={`Overall coverage % · last ${range} days`}>
                    <CoverageTrendChart points={series.map((p) => ({ label: p.label, value: p.coverage }))} ariaLabel={`Coverage by day for the last ${range} days`} />
                  </Card>
                  <Card title="Review status" subtitle="All generated cases">
                    <StatusDonut
                      segments={[
                        { label: 'Approved', value: data.totals.approved, color: C.success },
                        { label: 'Pending review', value: data.totals.pending, color: C.warning },
                        { label: 'Rejected', value: data.totals.rejected, color: C.danger },
                      ]}
                      ariaLabel="Test cases by review status"
                    />
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <Card className="xl:col-span-2" title="Risk by module" subtitle="Scenario risk distribution per feature area">
                    <RiskByModuleChart
                      rows={data.modules.map((m) => ({ label: m.name, high: m.scenarios.high, medium: m.scenarios.medium, low: m.scenarios.low }))}
                      ariaLabel="Scenario risk distribution by module"
                    />
                  </Card>
                  <Card title="Risk profile" subtitle={`${data.scenarios.total} scenarios total`}>
                    {(['high', 'medium', 'low'] as const).map((level, idx) => {
                      const n = data.scenarios[level];
                      const pct = Math.round((n / Math.max(data.scenarios.total, 1)) * 100);
                      return (
                        <div key={level} style={{ marginBottom: idx < 2 ? 16 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: C.fgDim, textTransform: 'capitalize' }}>{level} risk</span>
                            <span style={{ fontSize: 20, fontWeight: 700, color: RISK_COLOR[level], fontFamily: 'var(--font-mono)' }}>{n}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: C.surface2, marginTop: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: RISK_COLOR[level], opacity: 0.9 }} />
                          </div>
                          <div style={{ fontSize: 10.5, color: C.fgMuted, marginTop: 4 }}>{pct}% of all scenarios</div>
                        </div>
                      );
                    })}
                  </Card>
                </div>

                {/* [SEPYANT 2.0] QA workspace strip — totals for the broader
                    workspace plus quick links into the 2.0 surfaces. */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: C.fgMuted, textTransform: 'uppercase', padding: '2px 2px 8px', fontFamily: 'var(--font-mono)' }}>
                    QA workspace
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {([
                      { label: 'Total projects', value: projects.length, sub: 'active QA workspaces', Icon: FolderKanban, href: '/projects' },
                      { label: 'Conversations', value: CONVERSATIONS_SEED.filter((c) => !c.archived).length, sub: 'across all projects', Icon: MessageSquare, href: '/conversations' },
                      { label: 'QA documents', value: DOCUMENTS_SEED.length, sub: 'bugs · plans · reports', Icon: FileText, href: '/bug-reports' },
                      { label: 'Team members', value: TEAM_SEED.length, sub: `${FRAMEWORKS.length} automation frameworks`, Icon: Users, href: '/team' },
                    ] as const).map(({ label, value, sub, Icon, href }) => (
                      <button
                        key={label}
                        onClick={() => router.push(href)}
                        aria-label={`${label}: ${value}. Open ${href}`}
                        style={{
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          padding: '13px 14px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          minWidth: 0,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.muted)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 9 }}>
                          <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                          <span style={{ color: C.fgMuted, display: 'flex', flexShrink: 0 }}>
                            <Icon size={14} />
                          </span>
                        </div>
                        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: C.fg, fontFamily: 'var(--font-mono)' }}>{value}</div>
                        <div style={{ fontSize: 10.5, color: C.fgMuted, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'coverage' && (
              <div role="tabpanel" id="panel-coverage" aria-labelledby="tab-coverage" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <Card className="xl:col-span-2" title="Coverage by module" subtitle={`Target ${data.coverage.target}% per module`}>
                    <ModuleCoverageBars rows={data.modules.map((m) => ({ label: m.name, covered: m.covered, total: m.cases }))} target={data.coverage.target} />
                  </Card>
                  <Card title="Requirement traceability" subtitle="Requirements with at least one case">
                    <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.fg, letterSpacing: '-0.02em' }}>{reqPct}%</div>
                    <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 12 }}>requirements covered</div>
                    <div style={{ height: 8, borderRadius: 4, background: C.surface2, overflow: 'hidden' }}>
                      <div style={{ width: `${reqPct}%`, height: '100%', borderRadius: 4, background: C.accent, opacity: 0.9 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.fgDim }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: C.success }} />
                        {data.coverage.coveredRequirements} covered
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.fgDim }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: C.danger }} />
                        {data.coverage.totalRequirements - data.coverage.coveredRequirements} without coverage
                      </div>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.fgMuted, lineHeight: 1.5, marginTop: 14 }}>
                      A requirement counts as covered when at least one approved test case traces back to it.
                    </div>
                  </Card>
                </div>

                <Card
                  title="Missing edge cases & coverage gaps"
                  subtitle="Where the suite is silent today — severity, module and a concrete suggestion"
                  right={
                    <div role="group" aria-label="Filter gaps by severity" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['all', 'high', 'medium', 'low'] as const).map((f) => (
                        <button
                          key={f}
                          aria-pressed={gapFilter === f}
                          onClick={() => setGapFilter(f)}
                          style={{
                            fontSize: 11.5,
                            padding: '4px 11px',
                            borderRadius: 999,
                            cursor: 'pointer',
                            border: `1px solid ${gapFilter === f ? C.accent : C.border}`,
                            background: gapFilter === f ? alpha(C.accent, 9) : 'transparent',
                            color: gapFilter === f ? C.fg : C.fgMuted,
                            fontWeight: gapFilter === f ? 600 : 500,
                            textTransform: 'capitalize',
                          }}
                        >
                          {f} ({gapCounts[f]})
                        </button>
                      ))}
                    </div>
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {shownGaps.map((gap) => (
                      <div
                        key={gap.id}
                        style={{
                          borderLeft: `3px solid ${RISK_COLOR[gap.severity]}`,
                          background: C.surface2,
                          borderRadius: 8,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Chip color={RISK_COLOR[gap.severity]}>
                            {gap.severity === 'high' ? 'High severity' : gap.severity === 'medium' ? 'Medium severity' : 'Low severity'}
                          </Chip>
                          <span style={{ fontSize: 11, color: C.fgMuted, fontFamily: 'var(--font-mono)' }}>{gap.module}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{gap.title}</div>
                        <div style={{ fontSize: 12, color: C.fgDim, lineHeight: 1.55 }}>{gap.description}</div>
                        <div style={{ fontSize: 12, color: C.fgMuted, lineHeight: 1.5 }}>
                          <span style={{ color: C.accent, fontWeight: 600 }}>Suggestion · </span>
                          {gap.suggestion}
                        </div>
                      </div>
                    ))}
                    {shownGaps.length === 0 && <div style={{ fontSize: 12, color: C.fgMuted, padding: '8px 2px' }}>No gaps at this severity — nice work.</div>}
                  </div>
                </Card>
              </div>
            )}

            {tab === 'recommendations' && (
              <div role="tabpanel" id="panel-recommendations" aria-labelledby="tab-recommendations">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={14} color={C.ai} />
                    <span style={{ fontSize: 12, color: C.fgMuted }}>
                      Simulated AI insights generated from the demo dataset. Connect a real backend to refresh them against live project data.
                    </span>
                  </div>
                  {dismissed.size > 0 && (
                    <button
                      onClick={restoreAll}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11.5,
                        color: C.fgDim,
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        borderRadius: 7,
                        padding: '5px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <Undo2 size={12} />
                      Restore dismissed ({dismissed.size})
                    </button>
                  )}
                </div>

                {visibleRecs.length === 0 ? (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '26px 10px' }}>
                      <Sparkles size={18} color={C.ai} style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>All recommendations dismissed</div>
                      <div style={{ fontSize: 12, color: C.fgMuted, marginTop: 4 }}>Restore them to keep working through the list.</div>
                      <button
                        onClick={restoreAll}
                        style={{
                          marginTop: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#fff',
                          background: C.accent,
                          border: 'none',
                          borderRadius: 7,
                          padding: '7px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        <Undo2 size={13} />
                        Restore recommendations
                      </button>
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {visibleRecs.map((rec) => (
                      <div
                        key={rec.id}
                        style={{
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          padding: '16px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={13} color={C.ai} />
                            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', color: C.fgMuted }}>AI RECOMMENDATION</span>
                          </span>
                          <Chip color={RISK_COLOR[rec.priority]}>{rec.priority} priority</Chip>
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>{rec.title}</div>
                        <div style={{ fontSize: 12.5, color: C.fgDim, lineHeight: 1.6 }}>{rec.rationale}</div>

                        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: C.fgMuted, textTransform: 'uppercase', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>
                            Suggested action
                          </div>
                          <div style={{ fontSize: 12.5, color: C.fg, lineHeight: 1.5 }}>{rec.action}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
                          <Chip color={C.accent}>{rec.impact}</Chip>
                          {queued.has(rec.id) ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.success }}>
                              <CheckCircle2 size={13} />
                              Queued in demo — connect the backend to run real generation
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', gap: 8 }}>
                              <button
                                onClick={() => queue(rec.id)}
                                style={{
                                  background: C.accent,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#4363e0')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
                              >
                                <Sparkles size={12} />
                                Generate tests
                              </button>
                              <button
                                onClick={() => dismiss(rec.id)}
                                style={{
                                  background: 'transparent',
                                  color: C.fgDim,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 6,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Dismiss
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
