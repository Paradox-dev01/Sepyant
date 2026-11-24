'use client';

// ============================================================================
// [SEPYANT 2.0] Conversation thread — continues previous conversations with
// their full context (Phase 2). Messages render with a light markdown-style
// treatment (**bold**, paragraphs); the composer simulates assistant replies
// that are aware of the conversation's category and history. Demo-honest:
// replies are labeled as simulated.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveRestore, Bookmark, ChevronLeft, FileText, Link2, Pin, SendHorizontal, Sparkles, Trash2, User } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppShell from '@/components/shell/AppShell';
import { Button, Chip, EmptyState, IconBtn, Menu, Modal, Field, inputStyle } from '@/components/shell/bits';
import { toast } from '@/components/shell/Toast';
import { fmtDateTime, relTime, uid, useMockStore } from '@/lib/mock-store';
import { CATEGORY_META, CONVERSATIONS_KEY, CONVERSATIONS_SEED, mockReply, type Conversation } from '@/lib/qa-mock/conversations';
import { RESOURCES_KEY, RESOURCES_SEED, resourcesSeedFor, type ComposerAttachment, type ProjectResource } from '@/lib/qa-mock/resources';
import ResourceBar, { createAttachmentsFromFiles } from '@/components/workspace/composer/ResourceBar';

/** Render **bold** spans inside a line. */
function boldSpans(line: string, keyPrefix: string) {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`${keyPrefix}-${i}`} style={{ fontWeight: 650, color: C.fg }}>
        {part}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

function MessageContent({ content }: { content: string }) {
  const blocks = content.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((line, i) =>
        line.trim() === '' ? null : (
          <p key={i} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.fgDim, whiteSpace: 'pre-wrap' }}>
            {boldSpans(line, `l${i}`)}
          </p>
        )
      )}
    </div>
  );
}

export default function ConversationThread({
  id,
  userEmail,
  projects,
}: {
  id: string;
  userEmail: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useMockStore<Conversation[]>(CONVERSATIONS_KEY, CONVERSATIONS_SEED);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  // [SEPYANT 2.1] resource input for this conversation
  const [resourceMap, setResourceMap] = useMockStore<Record<string, ProjectResource[]>>(RESOURCES_KEY, RESOURCES_SEED);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const conversation = useMemo(() => conversations.find((c) => c.id === id) || null, [conversations, id]);
  const projectResources = useMemo<ProjectResource[]>(() => resourceMap[conversation?.projectId || ''] || resourcesSeedFor(conversation?.projectId || ''), [resourceMap, conversation?.projectId]);
  const uploading = attachments.some((a) => a.kind === 'file' && a.status === 'uploading');

  // Auto-scroll to the latest message (and when a simulated reply lands).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation?.messages.length, thinking]);

  // Cleanup the simulated-reply timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!conversation) {
    return (
      <AppShell activeView="conversations" userEmail={userEmail} projects={projects}>
        <EmptyState
          icon={<ChevronLeft size={26} />}
          title="Conversation not found"
          body="This conversation may have been deleted in the demo workspace."
          action={<Button onClick={() => router.push('/conversations')}>Back to conversations</Button>}
        />
      </AppShell>
    );
  }

  const color = CATEGORY_META[conversation.category].color;

  function send() {
    const text = draft.trim();
    if ((!text && !attachments.some((a) => a.status !== 'error') && selectedResourceIds.length === 0) || thinking || uploading) return;
    const nowIso = new Date().toISOString();
    const reusedNames = selectedResourceIds.map((id) => projectResources.find((r) => r.id === id)?.name).filter(Boolean) as string[];
    const attSnapshot = attachments.filter((a) => a.status !== 'error').map((a) => ({ name: a.name, kind: a.kind }));
    const userMsg = { id: uid('m'), role: 'user' as const, content: text || 'Generate from the attached context.', at: nowIso, attachments: attSnapshot.length ? attSnapshot : undefined, resourceNames: reusedNames.length ? reusedNames : undefined };
    setConversations((prev) => prev.map((c) => (c.id === conversation!.id ? { ...c, messages: [...c.messages, userMsg], updatedAt: nowIso } : c)));
    setDraft('');
    setAttachments([]);
    setSelectedResourceIds([]);
    setThinking(true);
    // Simulated assistant reply (demo-honest: labeled in the composer hint).
    timerRef.current = window.setTimeout(() => {
      const reply = mockReply(conversation!.category, conversation!.title, text, [...reusedNames, ...attSnapshot.map((a) => a.name)]);
      const at = new Date().toISOString();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversation!.id
            ? { ...c, messages: [...c.messages, { id: uid('m'), role: 'assistant' as const, content: reply.content, at, meta: reply.meta }], updatedAt: at }
            : c
        )
      );
      setThinking(false);
    }, 1100);
  }

  function rename() {
    const title = renameValue.trim();
    if (!title) return;
    setConversations((prev) => prev.map((c) => (c.id === conversation!.id ? { ...c, title } : c)));
    setRenaming(false);
    toast('Conversation renamed', 'success');
  }

  function remove() {
    setConversations((prev) => prev.filter((c) => c.id !== conversation!.id));
    setDeleting(false);
    toast('Conversation deleted', 'info');
    router.push('/conversations');
  }

  function restore() {
    setConversations((prev) => prev.map((c) => (c.id === conversation!.id ? { ...c, archived: false } : c)));
    toast('Restored from archive', 'success');
  }

  return (
    <AppShell activeView="conversations" userEmail={userEmail} projects={projects} fullHeight>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* ---------------------------------------------------------- header */}
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0, background: C.sidebar }}>
          <button
            onClick={() => router.push('/conversations')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: C.fgMuted, fontSize: 12, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.fg)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.fgMuted)}
          >
            <ChevronLeft size={14} /> All conversations
          </button>
          <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {conversation.pinned && <Pin size={12} color={C.warning} aria-label="Pinned" />}
            <h1 style={{ fontSize: 14.5, fontWeight: 650, color: C.fg, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 380 }}>{conversation.title}</h1>
            <Chip color={color}>{conversation.category}</Chip>
            <span style={{ fontSize: 11, color: C.fgMuted }}>{conversation.projectName}</span>
          </div>
          <span suppressHydrationWarning style={{ fontSize: 11, color: C.fgMuted, flexShrink: 0 }}>
            {conversation.messages.length} {conversation.messages.length === 1 ? 'message' : 'messages'} · updated {relTime(conversation.updatedAt)}
          </span>
          <div style={{ flexShrink: 0 }}>
            <Menu
              trigger={() => (
                <IconBtn label="Conversation actions">
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </IconBtn>
              )}
              items={[
                {
                  label: conversation.pinned ? 'Unpin' : 'Pin to top',
                  onSelect: () => {
                    setConversations((prev) => prev.map((c) => (c.id === conversation!.id ? { ...c, pinned: !c.pinned } : c)));
                    toast(conversation.pinned ? 'Unpinned' : 'Pinned to top', 'info');
                  },
                },
                conversation.archived
                  ? { label: 'Restore from archive', onSelect: restore }
                  : {
                      label: 'Archive',
                      onSelect: () => {
                        setConversations((prev) => prev.map((c) => (c.id === conversation!.id ? { ...c, archived: true } : c)));
                        toast('Moved to archive', 'info');
                        router.push('/conversations');
                      },
                    },
                {
                  label: 'Rename…',
                  onSelect: () => {
                    setRenameValue(conversation.title);
                    setRenaming(true);
                  },
                },
                { label: 'Delete…', danger: true, onSelect: () => setDeleting(true) },
              ]}
            />
          </div>
        </header>

        {/* -------------------------------------------------------- messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px' }}>
          <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {conversation.archived && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: alpha(C.warning, 6), border: `1px solid ${alpha(C.warning, 27)}`, borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, color: C.warning }}>This conversation is archived — it stays searchable but is hidden from the active list.</span>
                <Button small onClick={restore}>
                  <ArchiveRestore size={12} /> Restore
                </Button>
              </div>
            )}
            {conversation.messages.length === 0 && (
              <EmptyState
                icon={<Sparkles size={26} color={C.ai} />}
                title="Start the conversation"
                body={`Ask anything about ${conversation.category.toLowerCase()} for ${conversation.projectName} — the assistant keeps the full thread in context.`}
              />
            )}
            {conversation.messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <article key={msg.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isUser ? C.surface2 : alpha(C.ai, 9),
                      border: `1px solid ${isUser ? C.border : alpha(C.ai, 27)}`,
                      color: isUser ? C.fgDim : C.ai,
                    }}
                  >
                    {isUser ? <User size={13} /> : <Sparkles size={13} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, background: C.surface, border: `1px solid ${isUser ? C.border : alpha(C.ai, 20)}`, borderRadius: 10, padding: '10px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 650, color: isUser ? C.fg : C.ai }}>{isUser ? userEmail.split('@')[0] || 'You' : 'SEPYANT Assistant'}</span>
                      <span suppressHydrationWarning title={fmtDateTime(msg.at)} style={{ fontSize: 10, color: C.fgMuted }}>
                        {relTime(msg.at)}
                      </span>
                    </div>
                    <MessageContent content={msg.content} />
                    {((msg.attachments?.length || 0) > 0 || (msg.resourceNames?.length || 0) > 0) && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                        {(msg.resourceNames || []).map((n, k) => (
                          <span key={`r${k}`} title="Project resource reused as context" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 999, background: alpha(C.ai, 7), border: `1px solid ${alpha(C.ai, 27)}`, color: C.fgDim, maxWidth: 220 }}>
                            <Bookmark size={9} color={C.ai} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
                          </span>
                        ))}
                        {(msg.attachments || []).map((a, k) => (
                          <span key={`a${k}`} title={a.kind === 'url' ? 'URL context — not fetched in this demo' : 'File context — not analysed in this demo'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 999, background: C.surface2, border: `1px solid ${C.border}`, color: C.fgDim, maxWidth: 220 }}>
                            {a.kind === 'url' ? <Link2 size={9} /> : <FileText size={9} />} <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.meta && (
                      <div style={{ marginTop: 8 }}>
                        <Chip color={C.ai}>✦ {msg.meta}</Chip>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {thinking && (
              <div style={{ display: 'flex', gap: 11, alignItems: 'center', color: C.fgMuted, fontSize: 12 }}>
                <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(C.ai, 9), border: `1px solid ${alpha(C.ai, 27)}`, color: C.ai }}>
                  <Sparkles size={13} className="animate-pulse-dot" />
                </span>
                <span className="animate-pulse-dot">SEPYANT is composing a reply with the thread context…</span>
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------- composer */}
        <div
          style={{ borderTop: `1px solid ${C.border}`, padding: '12px 20px 14px', flexShrink: 0, background: C.sidebar, position: 'relative' }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer?.files?.length) {
              void createAttachmentsFromFiles(e.dataTransfer.files).then((created) => setAttachments((prev) => [...prev, ...created]));
            }
          }}
        >
          {dragOver && (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 30, border: `2px dashed ${C.accent}`, background: alpha(C.accent, 8), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600, color: C.accent, pointerEvents: 'none' }}>
              Drop files to attach
            </div>
          )}
          <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* [SEPYANT 2.1] resource input area: files, URLs, project resources */}
            <ResourceBar
              projectId={conversation.projectId}
              projectResources={projectResources}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              selectedResourceIds={selectedResourceIds}
              onToggleResource={(rid) => setSelectedResourceIds((prev) => (prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]))}
              onSaveAttachmentAsResource={(localId) => {
                const att = attachments.find((a) => a.localId === localId);
                if (att && att.kind === 'file') {
                  const resource: ProjectResource = {
                    id: uid('res'),
                    projectId: conversation.projectId,
                    kind: 'file',
                    name: att.name,
                    category: /require|prd/i.test(att.name) ? 'requirements' : /api/i.test(att.name) ? 'api-doc' : 'other',
                    addedAt: new Date().toISOString(),
                    addedBy: userEmail,
                    mime: att.mime,
                    size: att.size,
                    excerpt: 'Attached via the conversation composer (demo) — content extraction requires the backend integration.',
                  };
                  setResourceMap((prev) => ({ ...prev, [conversation.projectId]: [resource, ...(prev[conversation.projectId] || resourcesSeedFor(conversation.projectId))] }));
                  setAttachments((prev) => prev.map((a) => (a.localId === localId && a.kind === 'file' ? { ...a, savedAsResource: true } : a)));
                  toast(`“${att.name}” saved to ${conversation.projectName} resources`, 'success');
                }
              }}
              compact
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message about ${conversation.category.toLowerCase()}… (Enter to send, Shift+Enter for a new line)`}
                aria-label="Message draft"
                rows={2}
                style={{ ...inputStyle, resize: 'none', minHeight: 44, maxHeight: 140, lineHeight: 1.5 }}
              />
              <Button variant="primary" onClick={send} disabled={(!draft.trim() && !attachments.some((a) => a.status !== 'error') && selectedResourceIds.length === 0) || thinking || uploading} ariaLabel="Send message">
                {uploading ? <span className="animate-pulse-dot">…</span> : <SendHorizontal size={14} />} Send
              </Button>
            </div>
            <div style={{ fontSize: 10, color: C.fgMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={10} color={C.ai} />
              Demo mode — replies are simulated locally; files and URLs stay in your browser and their contents are never read.
            </div>
          </div>
        </div>
      </div>

      {/* rename modal */}
      {renaming && (
        <Modal title="Rename conversation" onClose={() => setRenaming(false)}>
          <Field label="Title">
            <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} aria-label="Conversation title" style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRenaming(false)}>Cancel</Button>
            <Button variant="primary" onClick={rename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </div>
        </Modal>
      )}

      {/* delete confirm */}
      {deleting && (
        <Modal title="Delete conversation?" onClose={() => setDeleting(false)} width={400}>
          <p style={{ fontSize: 12.5, color: C.fgDim, lineHeight: 1.55, margin: '0 0 16px' }}>
            “{conversation.title}” and its {conversation.messages.length} message{conversation.messages.length === 1 ? '' : 's'} will be removed from this demo workspace. This cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeleting(false)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={13} /> Delete
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
