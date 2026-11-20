'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bug,
  ClipboardList,
  Code2,
  FileText,
  Gauge,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { C, alpha, useTheme } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-bypass';
import SettingsModal from './SettingsModal';
import CommandPalette from '@/components/shell/CommandPalette';
import NotificationsPopover, { useUnreadNotifications } from '@/components/shell/NotificationsPopover';
import ToastHost from '@/components/shell/Toast';

type ProjectSummary = { id: string; name: string };

// [SEPYANT 2.0] Full navigation model (Phase 8). 'project' remains the
// default so every pre-2.0 caller (workspace, dashboard) is unchanged.
export type SidebarView =
  | 'project'
  | 'projects'
  | 'conversations'
  | 'dashboard'
  | 'bug-reports'
  | 'test-plans'
  | 'reports'
  | 'automation'
  | 'team';

type NavItem = { key: SidebarView; label: string; href: string; Icon: LucideIcon };

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { key: 'projects', label: 'All projects', href: '/projects', Icon: LayoutGrid },
      { key: 'conversations', label: 'Conversations', href: '/conversations', Icon: MessageSquare },
      { key: 'dashboard', label: 'Quality analytics', href: '/dashboard', Icon: Gauge },
    ],
  },
  {
    label: 'QA library',
    items: [
      { key: 'bug-reports', label: 'Bug reports', href: '/bug-reports', Icon: Bug },
      { key: 'test-plans', label: 'Test plans & cases', href: '/test-plans', Icon: ClipboardList },
      { key: 'reports', label: 'Reports & docs', href: '/reports', Icon: FileText },
    ],
  },
  {
    label: 'Collaborate',
    items: [
      { key: 'automation', label: 'Automation', href: '/automation', Icon: Code2 },
      { key: 'team', label: 'Team', href: '/team', Icon: Users },
    ],
  },
];

export default function AppSidebar({
  currentProjectId,
  projects,
  userEmail,
  visible,
  onHide,
  width,
  activeView = 'project',
}: {
  currentProjectId: string;
  projects: ProjectSummary[];
  userEmail: string;
  visible: boolean;
  onHide: () => void;
  width: number;
  // [SEPYANT 2.0] which surface is active — highlights the matching nav item.
  // Defaults to 'project' so every existing caller is unchanged.
  activeView?: SidebarView;
}) {
  const router = useRouter();
  // [FRONTEND-FIRST DEV BYPASS] don't build a Supabase browser client while
  // auth is bypassed; creation goes through the dev-only API route instead.
  const supabase = DEV_BYPASS ? null : createClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // [SEPYANT 2.0] command palette + notifications live here so every page
  // that renders the sidebar gets them for free.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsAnchor, setNotificationsAnchor] = useState(120);
  const bellRef = useRef<HTMLDivElement>(null);
  const { count: unreadCount } = useUnreadNotifications();
  const [isMac, setIsMac] = useState(false);
  // [SEPYANT 2.1] quick light/dark toggle next to Settings.
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // Global Ctrl/Cmd+K shortcut for the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setCreateError('');

    // [FRONTEND-FIRST DEV BYPASS] create in the in-memory dev store via the
    // dev-only API route instead of Supabase.
    if (DEV_BYPASS) {
      try {
        const res = await fetch('/api/dev/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });
        const data = await res.json();
        if (res.ok && data.project?.id) {
          setNewName('');
          setCreating(false);
          router.push(`/projects/${data.project.id}`);
          router.refresh();
        } else {
          setCreateError(data.error || 'Could not create the project.');
        }
      } catch {
        setCreateError('Network error while creating the project.');
      }
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('projects').insert({ name: newName, owner_id: user!.id }).select().single();

    setLoading(false);
    if (!error && data) {
      setNewName('');
      setCreating(false);
      router.push(`/projects/${data.id}`);
      router.refresh();
    } else {
      // Surface failures instead of failing silently.
      setCreateError(error?.message || 'Could not create the project.');
    }
  }

  if (!visible) return null;

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6.5px 10px',
    borderRadius: 6,
    border: 'none',
    background: active ? C.surface2 : 'transparent',
    color: active ? C.fg : C.fgDim,
    cursor: 'pointer',
    fontSize: 12.5,
    textAlign: 'left',
  });

  return (
    <div style={{ width, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      <button
        onClick={onHide}
        title="Hide sidebar"
        aria-label="Hide sidebar"
        style={{ position: 'absolute', top: 10, right: 8, zIndex: 10, background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.fg)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.fgMuted)}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: C.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sepyant</span>
        {DEV_BYPASS && (
          <span
            title="Frontend-first dev mode: authentication is bypassed and all data is mock"
            style={{ marginLeft: 'auto', marginRight: 24, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.warning, border: `1px solid ${alpha(C.warning, 33)}`, background: alpha(C.warning, 7), padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}
          >
            DEV
          </span>
        )}
      </div>

      <div style={{ padding: '4px 10px 10px' }}>
        {creating ? (
          <form onSubmit={handleCreate}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => !newName && setCreating(false)}
              placeholder="Project name"
              aria-label="New project name"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.accent}`, background: C.surface2, color: C.fg, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            {createError && (
              <div style={{ marginTop: 6, fontSize: 11, color: C.danger, lineHeight: 1.4 }}>{createError}</div>
            )}
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New project
          </button>
        )}
      </div>

      {/* [SEPYANT 2.0] scrollable middle: 2.0 navigation + project list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px', minHeight: 0 }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: C.fgMuted, textTransform: 'uppercase', padding: '10px 8px 4px', fontFamily: 'var(--font-mono)' }}>
              {section.label}
            </div>
            {section.items.map(({ key, label, href, Icon }) => {
              const active = activeView === key;
              return (
                <button
                  key={key}
                  onClick={() => router.push(href)}
                  aria-current={active ? 'page' : undefined}
                  title={label}
                  style={navBtnStyle(active)}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = C.surface2;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon size={14} style={{ flexShrink: 0 }} strokeWidth={2} />
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</span>
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: C.fgMuted, textTransform: 'uppercase', padding: '10px 8px 4px', fontFamily: 'var(--font-mono)' }}>
          Your projects
        </div>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/projects/${p.id}`)}
            title={p.name}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '6.5px 10px',
              borderRadius: 6,
              border: 'none',
              background: currentProjectId === p.id ? C.surface2 : 'transparent',
              color: currentProjectId === p.id ? C.fg : C.fgDim,
              cursor: 'pointer',
              fontSize: 12,
              display: 'block',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
            onMouseEnter={(e) => {
              if (currentProjectId !== p.id) e.currentTarget.style.background = alpha(C.surface2, 50);
            }}
            onMouseLeave={(e) => {
              if (currentProjectId !== p.id) e.currentTarget.style.background = 'transparent';
            }}
          >
            {p.name}
          </button>
        ))}
        {projects.length === 0 && (
          <div style={{ padding: '6px 10px', fontSize: 11.5, color: C.fgMuted, lineHeight: 1.5 }}>No projects yet — create your first one above.</div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 8px' }}>
        {/* [SEPYANT 2.0] command palette trigger + global Ctrl/Cmd+K */}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Search size={14} strokeWidth={1.7} />
          <span>Search…</span>
          <kbd
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              color: C.fgMuted,
              border: `1px solid ${C.border}`,
              background: C.surface2,
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        {/* [SEPYANT 2.0] notifications bell with unread badge */}
        <div style={{ position: 'relative' }} ref={bellRef}>
          <button
            onClick={() => {
              const rect = bellRef.current?.getBoundingClientRect();
              if (rect) setNotificationsAnchor(rect.top);
              setNotificationsOpen((o) => !o);
            }}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            aria-expanded={notificationsOpen}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: notificationsOpen ? C.surface2 : 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => {
              if (!notificationsOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ position: 'relative', display: 'flex' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 01-3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  style={{ position: 'absolute', top: -4, right: -5, minWidth: 13, height: 13, borderRadius: 999, background: C.danger, color: '#fff', fontSize: 8.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: 'var(--font-mono)' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span>Notifications</span>
          </button>
          {notificationsOpen && <NotificationsPopover onClose={() => setNotificationsOpen(false)} anchorTop={notificationsAnchor} />}
        </div>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {theme === 'dark' ? (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
            </svg>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <SettingsIcon size={14} strokeWidth={1.7} />
          Settings
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, border: 'none', background: profileOpen ? C.surface2 : 'transparent', color: C.fgDim, cursor: 'pointer', overflow: 'hidden' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => {
              if (!profileOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: C.fg, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
            </div>
          </button>
          {profileOpen && (
            <div style={{ position: 'absolute', bottom: '100%', left: 6, right: 6, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, marginBottom: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setSettingsOpen(true);
                }}
                style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 5, border: 'none', background: 'transparent', color: C.fgDim, cursor: 'pointer', fontSize: 12, display: 'block' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = alpha(C.border, 50))}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && <SettingsModal userEmail={userEmail} onClose={() => setSettingsOpen(false)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} projects={projects} />
      <ToastHost />
    </div>
  );
}
