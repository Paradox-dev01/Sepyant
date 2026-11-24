'use client';

// ============================================================================
// [SEPYANT 2.0] Notifications popover for the AppSidebar bell (Phase 6).
// Mock team notifications; read/unread state persists via the mock store.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, Bell, CheckCheck, MessageSquare, ShieldCheck, UserPlus, Info } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import { useMockStore, relTime } from '@/lib/mock-store';
import { NOTIFICATIONS_KEY, NOTIFICATIONS_SEED, type MockNotification, type NotificationKind } from '@/lib/qa-mock/notifications';
import { Avatar } from './bits';

const KIND_ICON: Record<NotificationKind, { Icon: typeof Bell; color: string; label: string }> = {
  comment: { Icon: MessageSquare, color: C.accent, label: 'Comment' },
  mention: { Icon: AtSign, color: C.ai, label: 'Mention' },
  invite: { Icon: UserPlus, color: C.success, label: 'Invite' },
  approval: { Icon: ShieldCheck, color: C.success, label: 'Approval' },
  system: { Icon: Info, color: C.fgMuted, label: 'System' },
};

export function useUnreadNotifications(): { count: number; notifications: MockNotification[]; markAllRead: () => void } {
  const [notifications, setNotifications] = useMockStore<MockNotification[]>(NOTIFICATIONS_KEY, NOTIFICATIONS_SEED);
  const count = notifications.filter((n) => !n.read).length;
  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  return { count, notifications, markAllRead };
}

export default function NotificationsPopover({ onClose, anchorTop }: { onClose: () => void; anchorTop: number }) {
  const router = useRouter();
  const { notifications, markAllRead } = useUnreadNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const sorted = [...notifications].sort((a, b) => (a.read === b.read ? b.at.localeCompare(a.at) : a.read ? 1 : -1));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      style={{
        // Fixed overlay: escapes the sidebar's overflow:hidden clipping so the
        // panel can be wider than the 224px rail. Opens upward from the bell.
        position: 'fixed',
        bottom: `calc(100vh - ${anchorTop - 6}px)`,
        left: 10,
        width: 320,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: anchorTop - 70,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 95,
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.fgMuted, fontFamily: 'var(--font-mono)' }}>Notifications</span>
        <button
          onClick={markAllRead}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: C.accent, fontSize: 11, cursor: 'pointer', padding: 2 }}
        >
          <CheckCheck size={12} />
          Mark all read
        </button>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', flexShrink: 1, minHeight: 0 }}>
        {sorted.map((n) => {
          const { Icon, color, label } = KIND_ICON[n.kind];
          return (
            <button
              key={n.id}
              onClick={() => {
                onClose();
                if (n.href) router.push(n.href);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                gap: 9,
                padding: '10px 12px',
                borderBottom: `1px solid ${alpha(C.border, 50)}`,
                background: n.read ? 'transparent' : alpha(C.accent, 3),
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = alpha(C.surface, 87))}
              onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : alpha(C.accent, 3))}
            >
              <Avatar name={n.actor} size={24} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!n.read && <span aria-label="Unread" style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />}
                  <span style={{ fontSize: 11.5, fontWeight: n.read ? 500 : 600, color: C.fg, lineHeight: 1.4 }}>{n.title}</span>
                </span>
                <span style={{ fontSize: 11, color: C.fgMuted, lineHeight: 1.45, marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Icon size={11} color={color} />
                  <span style={{ fontSize: 10, color: C.fgMuted }}>{label}</span>
                  <span suppressHydrationWarning style={{ fontSize: 10, color: C.fgMuted }}>
                    · {relTime(n.at)}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
