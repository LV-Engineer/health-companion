import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ChatSessionRow {
  id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const SESSION_FIELDS = 'id, title, preview, created_at, updated_at';
const MESSAGE_FIELDS = 'id, role, content, created_at';
const DEFAULT_TITLE = 'New chat';

/**
 * Chat history lives in the database: one row per conversation in
 * `chat_sessions`, one row per message in `chat_messages`. Every read and
 * write is scoped to the signed-in user by both the query and RLS.
 */
export function useChatHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  // Which user the loaded list belongs to. Callers must not treat an empty
  // list as "no history" until this matches the signed-in user.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setLoadedFor(null);
      setLoadingSessions(false);
      return;
    }
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(SESSION_FIELDS)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load chat history:', error);
      setSessions([]);
    } else {
      setSessions((data ?? []) as ChatSessionRow[]);
    }
    setLoadedFor(user.id);
    setLoadingSessions(false);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(async (): Promise<ChatSessionRow | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id })
      .select(SESSION_FIELDS)
      .single();

    if (error) {
      console.error('Failed to start a new chat:', error);
      return null;
    }
    const session = data as ChatSessionRow;
    setSessions((prev) => [session, ...prev]);
    return session;
  }, [user]);

  /** Returns null when the load failed, so callers can tell "empty" from "broken". */
  const loadMessages = useCallback(
    async (sessionId: string): Promise<ChatMessageRow[] | null> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(MESSAGE_FIELDS)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        console.error('Failed to load messages:', error);
        return null;
      }
      return (data ?? []) as ChatMessageRow[];
    },
    [],
  );

  const appendMessage = useCallback(
    async (
      sessionId: string,
      role: 'user' | 'assistant',
      content: string,
    ): Promise<ChatMessageRow | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, user_id: user.id, role, content })
        .select(MESSAGE_FIELDS)
        .single();

      if (error) {
        console.error('Failed to save message:', error);
        return null;
      }
      const message = data as ChatMessageRow;

      const preview = content.slice(0, 60);
      const { error: previewError } = await supabase
        .from('chat_sessions')
        .update({ preview })
        .eq('id', sessionId);
      if (previewError) console.error('Failed to update chat preview:', previewError);

      let title = sessions.find((s) => s.id === sessionId)?.title ?? DEFAULT_TITLE;
      if (role === 'user' && title === DEFAULT_TITLE) {
        title = content.slice(0, 40);
        const { error: titleError } = await supabase
          .from('chat_sessions')
          .update({ title })
          .eq('id', sessionId)
          .eq('title', DEFAULT_TITLE);
        if (titleError) console.error('Failed to name chat:', titleError);
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, preview, title, updated_at: new Date().toISOString() }
            : s,
        ),
      );

      return message;
    },
    [user, sessions],
  );

  return {
    sessions,
    loadingSessions,
    loadedFor,
    loadSessions,
    createSession,
    loadMessages,
    appendMessage,
  };
}
