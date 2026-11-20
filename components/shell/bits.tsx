'use client';

// ============================================================================
// [SEPYANT 2.0] Shared building blocks for the 2.0 surfaces (conversations,
// documents, automation, team, projects overview). Same design language as
// the existing workspace/dashboard: the C palette, inline styles, restrained
// borders, 10px-radius cards, honest "Demo data" labeling.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { C, alpha } from '@/lib/theme';

// ---------------------------------------------------------------- Chip
export function Chip({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
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

// ------------------------------------------------------------ DemoChip
export function DemoChip({ label = 'DEMO DATA' }: { label?: string }) {
  return (
    <span
      title="Frontend demo dataset — no backend calls"
      style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.warning, border: `1px solid ${alpha(C.warning, 33)}`, background: alpha(C.warning, 7), padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------- PageHeader
export function PageHeader({
  icon,
  title,
  description,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  right?: React.ReactNode;
}) {
  return (
    <header style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ color: C.accent, display: 'flex' }}>{icon}</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.fg, letterSpacing: '-0.01em', margin: 0 }}>{title}</h1>
            <DemoChip />
          </div>
          <p style={{ fontSize: 12.5, color: C.fgMuted, margin: '6px 0 0', lineHeight: 1.5, maxWidth: 640 }}>{description}</p>
        </div>
        {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{right}</div>}
      </div>
    </header>
  );
}

// ------------------------------------------------------------ Card
export function Card({ children, style, onClick, as = 'div', ariaLabel }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void; as?: 'div' | 'section'; ariaLabel?: string }) {
  const base: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '16px 18px',
    minWidth: 0,
    ...(onClick ? { cursor: 'pointer' } : {}),
    ...style,
  };
  if (as === 'section') {
    return (
      <section style={base} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </section>
    );
  }
  return (
    <div style={base} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </div>
  );
}

// ----------------------------------------------------------- EmptyState
export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.muted}`,
        borderRadius: 10,
        background: alpha(C.surface, 50),
        padding: '36px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 6,
      }}
    >
      <div style={{ color: C.fgMuted, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.fg }}>{title}</div>
      <div style={{ fontSize: 12, color: C.fgMuted, lineHeight: 1.55, maxWidth: 420 }}>{body}</div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

// --------------------------------------------------------------- Avatar
const AVATAR_COLORS = ['#4f6ef7', '#a78bfa', '#34c78a', '#f5a623', '#e8845d', '#5dc9e8', '#e85d9d', '#8bd450'];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function Avatar({ name, size = 26, color, title }: { name: string; size?: number; color?: string; title?: string }) {
  const bg = color || avatarColor(name);
  return (
    <span
      title={title || name}
      aria-hidden={false}
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${bg}, ${alpha(bg, 69)})`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

// --------------------------------------------------------------- Button
export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  title,
  ariaLabel,
  type = 'button',
  small,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  small?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const styles: React.CSSProperties =
    variant === 'primary'
      ? {
          background: hover ? '#607df8' : C.accent,
          border: 'none',
          color: '#fff',
        }
      : variant === 'danger'
        ? {
            background: hover ? alpha(C.danger, 13) : 'transparent',
            border: `1px solid ${hover ? C.danger : alpha(C.danger, 40)}`,
            color: C.danger,
          }
        : {
            background: hover ? C.surface2 : 'transparent',
            border: `1px solid ${C.border}`,
            color: C.fgDim,
          };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: small ? '4px 9px' : '7px 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: small ? 11.5 : 12.5,
        fontWeight: 500,
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease, border-color 120ms ease',
        ...styles,
      }}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------- IconBtn
export function IconBtn({
  children,
  onClick,
  label,
  danger,
  active,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  label: string;
  danger?: boolean;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover || active ? C.surface2 : 'transparent',
        border: 'none',
        borderRadius: 6,
        padding: 5,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: danger ? (hover ? C.danger : C.fgMuted) : hover || active ? C.fg : C.fgMuted,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------- SearchInput
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      style={{
        width: '100%',
        maxWidth: 280,
        padding: '7px 11px',
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: C.surface2,
        color: C.fg,
        fontSize: 12.5,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ----------------------------------------------------------------- Menu
/** Lightweight dropdown menu (click-outside aware, Escape closes). */
export function Menu({ trigger, items, align = 'right' }: { trigger: (open: boolean) => React.ReactNode; items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <div onClick={() => setOpen((o) => !o)} role="button" aria-haspopup="menu" aria-expanded={open} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(true)} style={{ display: 'inline-flex' }}>
        {trigger(open)}
      </div>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 60,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 4,
            minWidth: 168,
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                borderRadius: 5,
                border: 'none',
                background: 'transparent',
                color: it.danger ? C.danger : it.disabled ? C.muted : C.fgDim,
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                fontSize: 12.5,
                display: 'block',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!it.disabled) e.currentTarget.style.background = alpha(C.border, 50);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Modal
export function Modal({ title, onClose, children, width = 460 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(5,6,9,0.66)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.surface, zIndex: 1 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.fg }}>{title}</span>
          <IconBtn label="Close dialog" onClick={onClose}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </IconBtn>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Field
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.fgMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  color: C.fg,
  fontSize: 12.5,
  outline: 'none',
  boxSizing: 'border-box',
};

// ------------------------------------------------------- Select
export function Select({ value, onChange, options, ariaLabel, width }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; ariaLabel: string; width?: number | string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{
        padding: '7px 10px',
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: C.surface2,
        color: C.fg,
        fontSize: 12,
        cursor: 'pointer',
        outline: 'none',
        maxWidth: width || 200,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ------------------------------------------------- FilterChips
export function FilterChips({ value, onChange, options, ariaLabel }: { value: string; onChange: (v: string) => void; options: { value: string; label: string; count?: number }[]; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? alpha(C.accent, 11) : 'transparent',
              color: active ? C.fg : C.fgDim,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
            {o.count != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? C.accent : C.fgMuted }}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
