'use client';

import { useRef, useEffect, useState } from 'react';
import { C, alpha } from '@/lib/theme';

export function Divider({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const last = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    last.current = e.clientX;
    document.body.style.cssText += 'cursor:col-resize;user-select:none';
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      onDrag(e.clientX - last.current);
      last.current = e.clientX;
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [onDrag]);

  return (
    <div
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel (drag)"
      style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.accent + '50')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    />
  );
}

export function EditableText({
  value,
  onChange,
  multiline = false,
  style = {},
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (editing) {
    const common = {
      value: draft,
      onChange: (e: React.ChangeEvent<any>) => setDraft(e.target.value),
      onBlur: commit,
      autoFocus: true,
      style: {
        width: '100%',
        background: C.surface2,
        border: `1px solid ${C.accent}`,
        borderRadius: 5,
        padding: '5px 8px',
        outline: 'none',
        fontFamily: 'inherit',
        ...style,
      },
    };
    return multiline ? (
      <textarea
        {...common}
        rows={3}
        ref={ref as any}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) commit();
        }}
      />
    ) : (
      <input
        {...common}
        ref={ref as any}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Click to edit: ${value}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        // [FRONTEND-FIRST FIX] keyboard access for the click-to-edit pattern
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      onFocus={(e) => (e.currentTarget.style.background = C.surface2)}
      onBlur={(e) => (e.currentTarget.style.background = 'transparent')}
      style={{ cursor: 'text', padding: '5px 8px', borderRadius: 5, whiteSpace: 'pre-wrap', ...style }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {value}
    </div>
  );
}

export function IBtn({
  children,
  title,
  onClick,
  active,
  activeColor,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? alpha(activeColor || C.accent, 8) : 'none',
        border: active ? `1px solid ${alpha(activeColor || C.accent, 27)}` : '1px solid transparent',
        color: disabled ? C.muted : active ? activeColor : C.fgMuted,
        borderRadius: 5,
        width: 26,
        height: 26,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 120ms',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.color = C.fgDim;
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) e.currentTarget.style.color = C.fgMuted;
      }}
    >
      {children}
    </button>
  );
}
