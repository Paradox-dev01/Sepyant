'use client';

// ============================================================================
// [SEPYANT 2.0] Minimal toast system — a tiny pub/sub so any 2.0 surface can
// raise feedback (copy succeeded, document saved, member invited…) without a
// state library. <ToastHost /> is mounted once inside AppSidebar, so toasts
// work on every page that shows the sidebar (workspace + dashboard included).
// ============================================================================

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { C } from '@/lib/theme';

export type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; kind: ToastKind };

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let seq = 1;

function emit() {
  const snapshot = items;
  listeners.forEach((l) => l(snapshot));
}

/** Raise a toast. Safe to call from anywhere client-side. */
export function toast(message: string, kind: ToastKind = 'info') {
  const item: ToastItem = { id: seq++, message, kind };
  items = [...items, item].slice(-4);
  emit();
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== item.id);
    emit();
  }, 3800);
}

const KIND_STYLE: Record<ToastKind, { color: string; Icon: typeof Info }> = {
  success: { color: C.success, Icon: CheckCircle2 },
  error: { color: C.danger, Icon: AlertCircle },
  info: { color: C.fgMuted, Icon: Info },
};

export default function ToastHost() {
  const [current, setCurrent] = useState<ToastItem[]>(items);

  useEffect(() => {
    const l: Listener = (next) => setCurrent(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (current.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(360px, calc(100vw - 32px))' }}
    >
      {current.map((t) => {
        const { color, Icon } = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 8,
              padding: '10px 12px',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
              fontSize: 12.5,
              color: C.fg,
              lineHeight: 1.45,
            }}
          >
            <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
            <button
              onClick={() => {
                items = items.filter((x) => x.id !== t.id);
                emit();
              }}
              aria-label="Dismiss notification"
              style={{ background: 'none', border: 'none', color: C.fgMuted, cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
