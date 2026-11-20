'use client';

// ============================================================================
// [SEPYANT 2.0] Shared application shell for the 2.0 pages (conversations,
// documents, automation, team, projects overview). Renders the shared
// AppSidebar — which now carries the full 2.0 navigation, the command
// palette, notifications and toasts — and a scrollable content area that
// mirrors the dashboard shell exactly (same responsive sidebar behaviour:
// hidden below 1024px with a floating reveal button).
// ============================================================================

import { useEffect, useState } from 'react';
import { C } from '@/lib/theme';
import AppSidebar, { type SidebarView } from '@/components/workspace/AppSidebar';

export default function AppShell({
  activeView,
  userEmail,
  projects,
  children,
  maxWidth = 1240,
  fullHeight = false,
  contentPadding = '24px 28px 56px',
}: {
  activeView: SidebarView;
  userEmail: string;
  projects: { id: string; name: string }[];
  children: React.ReactNode;
  maxWidth?: number;
  /** Full-height pages (e.g. conversation thread) manage their own scrolling. */
  fullHeight?: boolean;
  contentPadding?: string;
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Same responsive default as the workspace: the fixed-width sidebar starts
  // hidden on narrow screens (the floating "show sidebar" button reveals it).
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarVisible(false);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.fg, overflow: 'hidden' }}>
      <AppSidebar
        currentProjectId=""
        projects={projects}
        userEmail={userEmail}
        visible={sidebarVisible}
        onHide={() => setSidebarVisible(false)}
        width={224}
        activeView={activeView}
      />
      {sidebarVisible && <div style={{ width: 1, background: C.border, flexShrink: 0 }} />}

      <main style={{ flex: 1, minWidth: 0, overflowY: fullHeight ? 'hidden' : 'auto', position: 'relative' }}>
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

        {fullHeight ? (
          children
        ) : (
          <div style={{ maxWidth, margin: '0 auto', padding: contentPadding }}>{children}</div>
        )}
      </main>
    </div>
  );
}
