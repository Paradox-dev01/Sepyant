'use client';

import { useState, useRef, useEffect } from 'react';
import { C } from '@/lib/theme';
import { IBtn } from './primitives';
import type { Msg } from './types';

const QUICK_PROMPTS = ['Generate test cases for...', 'Create a test plan for...', 'Negative cases for...', 'What needs more coverage?'];

export default function ChatPanel({
  messages,
  streaming,
  onSend,
}: {
  messages: Msg[];
  streaming: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  function send() {
    if (!input.trim() || streaming) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.sidebar }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: C.ai, fontSize: 13 }}>✦</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>Sepyant AI</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: C.fgMuted, lineHeight: 1.6, padding: '8px 2px' }}>
            Describe a requirement or feature, and I'll generate a test plan and test cases for it. Ask general
            questions too — I have context on this project.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'ai' && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: C.ai }}>✦</span>
                <span style={{ fontSize: 11, color: C.fgMuted }}>AI</span>
              </div>
            )}
            <div
              style={{
                maxWidth: '90%',
                fontSize: 13,
                lineHeight: 1.6,
                padding: '9px 12px',
                borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '3px 10px 10px 10px',
                background: msg.role === 'user' ? C.accent : C.surface2,
                color: msg.role === 'user' ? '#fff' : C.fg,
                border: msg.role === 'ai' ? `1px solid ${C.border}` : 'none',
              }}
            >
              {msg.content.split('\n').map((line, li) => (
                <span key={li} style={{ display: 'block' }}>
                  {line.split(/(\*\*[^*]+\*\*)/).map((part, pi) =>
                    part.startsWith('**') && part.endsWith('**') ? <strong key={pi}>{part.slice(2, -2)}</strong> : <span key={pi}>{part}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
        {streaming && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <span style={{ fontSize: 10, color: C.ai }}>✦</span>
              <span style={{ fontSize: 11, color: C.fgMuted }}>AI</span>
            </div>
            <div style={{ padding: '9px 14px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '3px 10px 10px 10px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="animate-pulse-dot"
                  style={{ width: 5, height: 5, borderRadius: '50%', background: C.ai, display: 'inline-block', animationDelay: `${d * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '6px 14px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {QUICK_PROMPTS.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface2, color: C.fgDim, cursor: 'pointer' }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 14px 14px' }}>
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Sepyant AI…"
            rows={3}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.fg, fontSize: 13, resize: 'none', lineHeight: 1.5, padding: '10px 12px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px', gap: 2 }}>
            <IBtn title="Attach requirement doc (coming soon)" onClick={() => {}} disabled>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </IBtn>
            <IBtn title="Upload screenshot (coming soon)" onClick={() => {}} disabled>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </IBtn>
            <div style={{ flex: 1 }} />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              style={{
                background: input.trim() && !streaming ? C.accent : C.surface,
                border: `1px solid ${input.trim() && !streaming ? C.accent : C.border}`,
                color: input.trim() && !streaming ? '#fff' : C.fgMuted,
                borderRadius: 7,
                width: 28,
                height: 28,
                cursor: input.trim() && !streaming ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 120ms',
                flexShrink: 0,
              }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
