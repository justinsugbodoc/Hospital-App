import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { getCurrentSessionUser } from '@/hooks/use-auth';
import {
  serverMarkMessagesRead,
  serverMessageConversations,
  serverMessages,
  serverSendMessage,
  type ServerMessage,
  type ServerMessageConversation,
} from '@/lib/server';
import { ChevronLeft, MessageSquare, Send, Stethoscope, ShieldAlert, Calendar, CheckCircle2, User } from 'lucide-react';

const cardClass = 'rounded-2xl border border-border bg-card shadow-sm';
const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

export default function Messages() {
  const session = getCurrentSessionUser();
  const [threads, setThreads] = useState<ServerMessageConversation[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'doctors' | 'admin'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const isPatient = session?.role === 'Patient';

  const getThreadDisplay = (thread: ServerMessageConversation) => {
    if (isPatient) {
      if (thread.type === 'doctor') {
        const name = thread.doctorName || 'Assigned Specialist';
        const initials = thread.doctorInitials || 'DR';
        const specialty = thread.doctorSpecialty || 'Clinical Care';
        const clinic = thread.doctorClinic || 'Partner Hospital';
        return {
          name,
          initials,
          detail: `${specialty} · ${clinic}`,
          specialty,
          clinic,
          badge: thread.appointmentReference ? `Ref: ${thread.appointmentReference}` : undefined,
          isDoctor: true,
        };
      }
      return {
        name: 'SugboDoc Admin & Support',
        initials: 'SA',
        detail: 'Billing, appointments, HMO & customer care',
        specialty: 'Patient Support',
        clinic: 'SugboDoc Central',
        badge: undefined,
        isDoctor: false,
      };
    }
    return {
      name: thread.patientName || 'Patient',
      initials: thread.patientInitials || 'PT',
      detail: thread.patientEmail || '',
      specialty: 'Registered Patient',
      clinic: thread.doctorClinic || '',
      badge: thread.appointmentReference ? `Ref: ${thread.appointmentReference}` : undefined,
      isDoctor: false,
    };
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (tabFilter === 'doctors' && thread.type !== 'doctor') return false;
      if (tabFilter === 'admin' && thread.type !== 'admin') return false;

      const display = getThreadDisplay(thread);
      const query = search.toLowerCase();
      return `${display.name} ${display.detail} ${display.specialty} ${thread.appointmentReference ?? ''} ${thread.lastMessage?.body ?? ''}`
        .toLowerCase()
        .includes(query);
    });
  }, [threads, search, tabFilter, isPatient]);

  const refreshThreads = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await serverMessageConversations();
      setThreads(response.conversations);

      const searchParams = new URLSearchParams(window.location.search);
      const threadParam = searchParams.get('thread');
      const doctorParam = searchParams.get('doctor');

      if (threadParam && response.conversations.some((c) => c.id === threadParam)) {
        setActiveThreadId(threadParam);
      } else if (doctorParam) {
        const normDoc = doctorParam.replace('doctor_', '');
        const found = response.conversations.find((c) =>
          c.doctorId === normDoc ||
          c.doctorId === `doctor_${normDoc}` ||
          c.id.includes(`_${normDoc}_`)
        );
        if (found) {
          setActiveThreadId(found.id);
        } else if (!activeThreadId && response.conversations[0]) {
          setActiveThreadId(response.conversations[0].id);
        }
      } else if (!activeThreadId && response.conversations[0]) {
        setActiveThreadId(response.conversations[0].id);
      }
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load messages.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const refreshMessages = async (conversationId: string, showLoading = false) => {
    if (showLoading) setLoadingMessages(true);
    try {
      const response = await serverMessages(conversationId);
      setMessages(response.messages);
      await serverMarkMessagesRead(conversationId);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === conversationId
            ? { ...thread, unreadCount: 0, lastMessage: response.messages.at(-1) ?? null }
            : thread,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this conversation.');
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void refreshThreads(true);
    const interval = window.setInterval(() => void refreshThreads(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    void refreshMessages(activeThreadId, true);
    const interval = window.setInterval(() => void refreshMessages(activeThreadId), 5000);
    return () => window.clearInterval(interval);
  }, [activeThreadId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputMsg.trim() || !activeThreadId || sending) return;
    setSending(true);
    try {
      const response = await serverSendMessage(activeThreadId, inputMsg.trim());
      setMessages((current) => [...current, response.message]);
      setInputMsg('');
      await refreshThreads();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send this message.');
    } finally {
      setSending(false);
    }
  };

  const activeDisplay = activeThread ? getThreadDisplay(activeThread) : null;

  return (
    <AppShell title="Messages">
      <div className={`${cardClass} relative flex h-[calc(100vh-140px)] overflow-hidden lg:h-[720px]`}>
        {/* Left conversation list */}
        <div
          className={`absolute z-10 flex h-full w-full flex-col bg-card transition-transform duration-300 lg:relative lg:w-88 lg:translate-x-0 ${
            activeThreadId ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          <div className="border-b border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Care messaging</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Search doctor, patient or notes..."
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            {isPatient && (
              <div className="mt-2.5 flex rounded-lg bg-muted/60 p-0.5 text-xs font-medium">
                <button
                  onClick={() => setTabFilter('all')}
                  className={`flex-1 rounded-md py-1 transition ${tabFilter === 'all' ? 'bg-background shadow-xs font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  All ({threads.length})
                </button>
                <button
                  onClick={() => setTabFilter('doctors')}
                  className={`flex-1 rounded-md py-1 transition ${tabFilter === 'doctors' ? 'bg-background shadow-xs font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Doctors
                </button>
                <button
                  onClick={() => setTabFilter('admin')}
                  className={`flex-1 rounded-md py-1 transition ${tabFilter === 'admin' ? 'bg-background shadow-xs font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Admin
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : filteredThreads.map((thread) => {
              const display = getThreadDisplay(thread);
              const isActive = activeThreadId === thread.id;
              return (
                <button
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`flex w-full gap-3 border-l-3 p-4 text-left transition hover:bg-muted/40 ${
                    isActive ? 'border-primary bg-primary/5' : 'border-transparent'
                  }`}
                >
                  <div
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold shadow-xs ${
                      display.isDoctor
                        ? 'bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {display.initials}
                    {display.isDoctor && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white">
                        <Stethoscope className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="truncate text-sm font-semibold text-foreground">{display.name}</h4>
                      {thread.unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-primary font-medium">{display.detail}</p>
                    {display.badge && (
                      <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                        {display.badge}
                      </span>
                    )}
                    <p
                      className={`truncate text-xs mt-1 ${
                        thread.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {thread.lastMessage?.body ?? 'No messages yet — start the conversation.'}
                    </p>
                  </div>
                </button>
              );
            })}
            {!loading && !filteredThreads.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-20" />
                No conversations found.
              </div>
            )}
          </div>
        </div>

        {/* Right active chat container */}
        <div
          className={`absolute inset-0 z-20 flex flex-1 flex-col bg-slate-50/50 transition-transform duration-300 dark:bg-background lg:relative lg:inset-auto lg:z-0 lg:translate-x-0 ${
            activeThreadId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          {activeThread && activeDisplay ? (
            <>
              {/* Chat header */}
              <div className="flex h-18 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveThreadId(null)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted lg:hidden"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl font-bold shadow-xs ${
                      activeDisplay.isDoctor
                        ? 'bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {activeDisplay.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">{activeDisplay.name}</h3>
                      {activeDisplay.isDoctor && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                          <Stethoscope className="h-3 w-3" />
                          Verified Specialist
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{activeDisplay.detail}</p>
                  </div>
                </div>

                {activeThread.appointmentReference && (
                  <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Appt: <strong className="text-foreground">{activeThread.appointmentReference}</strong></span>
                    {activeThread.appointmentDate && (
                      <span className="text-[11px] opacity-80">· {activeThread.appointmentDate}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Messages list */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                <div className="my-2 text-center text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-card px-3 py-1 shadow-xs">
                    🔒 End-to-end synchronized clinical conversation
                  </span>
                </div>

                {loadingMessages ? (
                  <div className="space-y-3">
                    <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-muted" />
                    <div className="ml-auto h-14 w-2/3 animate-pulse rounded-2xl bg-muted" />
                  </div>
                ) : messages.length ? (
                  messages.map((message) => {
                    const isSelf = message.senderId === session?.id || (session?.role === 'Patient' && message.senderRole === 'Patient' && message.senderId === session?.id);
                    return (
                      <div key={message.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] font-medium text-muted-foreground mb-1 px-1">
                          {isSelf ? 'You' : message.senderName} ({message.senderRole})
                        </span>
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                            isSelf
                              ? 'rounded-tr-xs bg-primary text-primary-foreground'
                              : 'rounded-tl-xs border border-border bg-card text-foreground'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
                          <span
                            className={`mt-1.5 block text-right text-[10px] ${
                              isSelf ? 'text-primary-foreground/75' : 'text-muted-foreground'
                            }`}
                          >
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground py-12">
                    <MessageSquare className="mb-2 h-12 w-12 opacity-30" />
                    <p className="font-semibold text-foreground">No messages yet</p>
                    <p className="text-xs max-w-sm text-center mt-1">
                      Send a message to discuss clinical follow-ups, prescriptions, or schedule updates.
                    </p>
                  </div>
                )}
                <div ref={endOfMessagesRef} />
              </div>

              {error && (
                <p className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>
              )}

              {/* Message input */}
              <form onSubmit={handleSend} className="flex gap-2 border-t border-border bg-card p-4">
                <textarea
                  value={inputMsg}
                  onChange={(event) => setInputMsg(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend(event);
                    }
                  }}
                  placeholder={`Reply to ${activeDisplay.name}… (Press Enter to send)`}
                  className="min-h-[48px] max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary transition"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!inputMsg.trim() || sending}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="hidden h-full flex-col items-center justify-center text-muted-foreground lg:flex">
              <MessageSquare className="mb-4 h-16 w-16 opacity-20" />
              <p className="text-lg font-medium text-foreground">Select a conversation</p>
              <p className="text-sm max-w-md text-center mt-1">
                Select an assigned specialist or admin conversation from the sidebar to view clinical communications.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
