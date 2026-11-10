# Agent notes

## Chat history
- Conversations are persisted in the database: `public.chat_sessions` (one row per conversation) and `public.chat_messages` (one row per message), both scoped to the signed-in user by query and RLS. The active conversation comes from the URL (`/chat/:sessionId`), never from component state alone. Why: reloading the page must restore the exact conversation, and opening one thread must never show another thread's messages.
- Anything that asks "does this user already have conversations?" must wait until the loaded list is confirmed to belong to the current user (`useChatHistory`'s `loadedFor`), not merely until a fetch has finished. Why: an empty result fetched before the user resolved made every visit to the chat page create a blank conversation.
