import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useChatHistory } from '@/hooks/useChatHistory';
import { UserDropdown } from '@/components/layout/UserDropdown';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { ChatHistorySidebar } from '@/components/chat/ChatHistorySidebar';
import { Send, Loader2, History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const GREETING =
  "Hi! Ask me anything. I'll answer in formatted markdown (with tables when useful). If you've uploaded files to your knowledge base in **Account → Profile**, I'll use them to ground my answers.";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const ChatView: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { sessions, loadedFor, createSession, loadMessages, appendMessage } =
    useChatHistory();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bootstrapped = useRef(false);

  const [inputValue, setInputValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Opening /chat with no conversation in the address: show the most recent
  // one, or start a fresh one. Waits until this user's list has actually
  // arrived, and is guarded so it only ever runs once.
  useEffect(() => {
    if (authLoading || !user || loadedFor !== user.id || sessionId || bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;

    if (sessions.length > 0) {
      navigate(`/chat/${sessions[0].id}`, { replace: true });
      return;
    }
    createSession().then((session) => {
      if (session) {
        navigate(`/chat/${session.id}`, { replace: true });
      } else {
        bootstrapped.current = false;
        toast.error('Could not start a new chat');
      }
    });
  }, [authLoading, user, loadedFor, sessionId, sessions, createSession, navigate]);

  // Load whichever conversation the address names.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    setLoadingMessages(true);
    setMessages([]);
    loadMessages(sessionId).then((rows) => {
      if (cancelled) return;
      if (rows === null) {
        toast.error('Could not load this chat. Try opening it again.');
      } else {
        setMessages(rows.map((r) => ({ id: r.id, role: r.role, content: r.content })));
      }
      setLoadingMessages(false);
      inputRef.current?.focus();
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId, loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !sessionId) return;

    setInputValue('');
    setIsLoading(true);

    // Show the question right away, then keep the saved row's id.
    const pendingId = `pending-${Date.now()}`;
    setMessages((prev) => [...prev, { id: pendingId, role: 'user', content: trimmed }]);

    const savedUser = await appendMessage(sessionId, 'user', trimmed);
    if (!savedUser) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setIsLoading(false);
      toast.error('Your message was not saved. Check your connection and try again.');
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === pendingId ? { ...m, id: savedUser.id } : m)),
    );

    const history: Message[] = [
      ...messages,
      { id: savedUser.id, role: 'user', content: trimmed },
    ];

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { messages: history.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const reply: string = data?.reply ?? '';
      const savedReply = await appendMessage(sessionId, 'assistant', reply);
      setMessages((prev) => [
        ...prev,
        { id: savedReply?.id ?? `unsaved-${Date.now()}`, role: 'assistant', content: reply },
      ]);
      if (!savedReply) {
        toast.error('This reply is shown but was not saved to your chat history.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to get a response');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNewChat = async () => {
    const session = await createSession();
    if (!session) {
      toast.error('Could not start a new chat');
      return;
    }
    navigate(`/chat/${session.id}`);
    inputRef.current?.focus();
  };

  const handleSelectSession = (id: string) => {
    if (id !== sessionId) navigate(`/chat/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-subtle">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-subtle">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sidebarSessions = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    date: formatDate(s.updated_at),
    preview: s.preview || 'No messages yet',
    isActive: s.id === sessionId,
  }));

  return (
    <AppShell
      title="AI Assistant"
      showBack
      onBack={() => navigate('/')}
      sidebar={
        <ChatHistorySidebar
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
          sessions={sidebarSessions}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          footer={<UserDropdown variant="sidebar" />}
        />
      }
      sidebarOpen={historyOpen}
      onToggleSidebar={() => setHistoryOpen(!historyOpen)}
    >
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-hidden">
        <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="h-7 w-7 flex-shrink-0"
            title={historyOpen ? 'Hide chat history' : 'Show chat history'}
          >
            <History className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {messages.length === 0 && (
                <ChatBubble role="assistant">
                  <MarkdownMessage content={GREETING} />
                </ChatBubble>
              )}
              {messages.map((message) => (
                <ChatBubble key={message.id} role={message.role}>
                  {message.role === 'assistant' ? (
                    <MarkdownMessage content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}
                </ChatBubble>
              ))}
            </>
          )}
          {isLoading && (
            <ChatBubble role="assistant">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Thinking…
              </div>
            </ChatBubble>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-border p-3">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              rows={1}
              className="resize-none min-h-[44px] max-h-40"
              disabled={isLoading || !sessionId}
            />
            <Button
              onClick={() => handleSendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim() || !sessionId}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            AI may be inaccurate. Verify important information independently.
          </p>
        </div>
      </div>
    </AppShell>
  );
};

export default ChatView;
