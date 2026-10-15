'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import SearchInput from '../../components/ui/SearchInput';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { MessageIcon } from '../../components/ui/Icons';
import { ListSkeleton } from '../../components/ui/Skeletons';
import { api, getToken } from '../../lib/api';
import { getSocket } from '../../lib/socket';

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientParam = searchParams.get('patient') || '';

  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const bottomRef = useRef(null);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadThreads = useCallback(async () => {
    const list = await api.get('/api/chat/threads');
    setThreads(Array.isArray(list) ? list : []);
    return list;
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await loadThreads();
        if (cancelled) return;

        if (patientParam) {
          const existing = (list || []).find(
            (t) => String(t.patientId?._id || t.patientId) === String(patientParam),
          );
          if (existing) setActiveId(existing._id);
          else {
            const created = await api.post('/api/chat/threads', { patientId: patientParam });
            await loadThreads();
            setActiveId(created._id);
          }
        }

        const sock = getSocket();
        sock?.on('thread:updated', () => {
          loadThreads().catch(() => {});
        });
        sock?.on('message:new', (payload) => {
          if (String(payload?.threadId) !== String(activeIdRef.current)) {
            loadThreads().catch(() => {});
            return;
          }
          const m = payload.message;
          if (!m?._id) return;
          setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
          api.patch(`/api/chat/threads/${payload.threadId}/read`).catch(() => {});
          loadThreads().catch(() => {});
        });
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      const sock = getSocket();
      sock?.off('message:new');
      sock?.off('thread:updated');
    };
  }, [router, patientParam, loadThreads]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMsgs(true);
    (async () => {
      try {
        const msgs = await api.get(`/api/chat/threads/${activeId}/messages`);
        if (cancelled) return;
        setMessages(Array.isArray(msgs) ? msgs : []);
        await api.patch(`/api/chat/threads/${activeId}/read`);
        const sock = getSocket();
        sock?.emit('thread:join', activeId);
        await loadThreads();
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => {
      cancelled = true;
      getSocket()?.emit('thread:leave', activeId);
    };
  }, [activeId, loadThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const name = t.patientId?.name || t.patientId?.firstName || '';
      return name.toLowerCase().includes(q) || (t.lastMessagePreview || '').toLowerCase().includes(q);
    });
  }, [threads, search]);

  const active = threads.find((t) => t._id === activeId) || null;
  const patientName = active?.patientId?.name || active?.patientId?.firstName || 'Patient';

  async function send() {
    const body = text.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setText('');
    try {
      const sock = getSocket();
      await new Promise((resolve, reject) => {
        if (!sock) return reject(new Error('Socket offline'));
        sock.emit('message:send', { threadId: activeId, body }, (ack) => {
          if (ack?.ok) resolve(ack.message);
          else reject(new Error(ack?.message || 'Send failed'));
        });
      });
    } catch {
      try {
        const saved = await api.post(`/api/chat/threads/${activeId}/messages`, { body });
        setMessages((prev) => (prev.some((m) => m._id === saved._id) ? prev : [...prev, saved]));
      } catch (e) {
        setText(body);
        setError(e.message);
      }
    } finally {
      setSending(false);
      loadThreads().catch(() => {});
    }
  }

  const unreadTotal = threads.reduce((n, t) => n + (t.unread || 0), 0);

  return (
    <AppShell>
      <PageHeader
        title="Messages"
        subtitle={
          loading
            ? 'Loading inbox'
            : `${threads.length} conversation${threads.length === 1 ? '' : 's'}${
                unreadTotal ? ` · ${unreadTotal} unread` : ''
              }`
        }
      />

      <div className="split messages-split">
        <GlassCard className="patient-list-card rise">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search conversations…"
            label="Search conversations"
          />
          {loading ? (
            <ListSkeleton rows={5} />
          ) : error && !threads.length ? (
            <ErrorState message={error} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<MessageIcon />} title="No conversations yet">
              When a patient messages you from the app, threads appear here. You can also start from
              Patients.
            </EmptyState>
          ) : (
            <div className="mt-3 flex flex-col gap-1" role="listbox" aria-label="Conversations">
              {filtered.map((t) => {
                const selected = t._id === activeId;
                const name = t.patientId?.name || t.patientId?.firstName || 'Patient';
                return (
                  <button
                    key={t._id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="patient-item"
                    onClick={() => setActiveId(t._id)}
                  >
                    <Avatar name={name} />
                    <span className="patient-meta">
                      <strong>{name}</strong>
                      <span>{t.lastMessagePreview || 'No messages yet'}</span>
                    </span>
                    {(t.unread || 0) > 0 ? (
                      <span className="chat-unread">{t.unread}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard className="patient-profile-card rise chat-panel" style={{ animationDelay: '40ms' }}>
          {!activeId ? (
            <EmptyState icon={<MessageIcon />} title="Select a conversation">
              Choose a patient thread to read and reply in real time.
            </EmptyState>
          ) : (
            <div className="chat-shell">
              <div className="chat-head">
                <Avatar name={patientName} />
                <div>
                  <h2 className="chat-title">{patientName}</h2>
                  <p className="page-sub">Live chat · patient app</p>
                </div>
              </div>

              <div className="chat-stream">
                {loadingMsgs ? (
                  <ListSkeleton rows={4} />
                ) : messages.length === 0 ? (
                  <p className="chat-empty">No messages yet — say hello.</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderRole === 'physiologist';
                    return (
                      <div key={m._id} className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
                        <div className={`chat-bubble ${mine ? 'mine' : ''}`}>
                          <p>{m.body}</p>
                          <time>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="chat-composer">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a reply…"
                  rows={2}
                  maxLength={2000}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-primary chat-send"
                  disabled={!text.trim() || sending}
                  onClick={send}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<AppShell><PageHeader title="Messages" subtitle="Loading…" /></AppShell>}>
      <MessagesInner />
    </Suspense>
  );
}
