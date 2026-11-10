-- Health Companion: initial schema.
-- Every table is scoped to auth.uid() through RLS; the browser only ever uses the publishable key.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Tables -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  auto_suggestions boolean not null default true,
  creativity_level int not null default 5,
  enhance_prompt_template text not null default '',
  preferred_persona text,
  response_length text not null default 'medium',
  search_depth text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  preview text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.rag_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes <= 20971520),
  storage_path text not null,
  status text not null default 'processing',
  chunk_count int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.rag_files(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  fts tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now()
);

create index rag_chunks_fts_idx on public.rag_chunks using gin (fts);
create index rag_chunks_file_idx on public.rag_chunks (file_id);
create index rag_files_user_idx on public.rag_files (user_id, created_at desc);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);
create index chat_sessions_user_idx on public.chat_sessions (user_id, updated_at desc);

-- Row Level Security + grants (same pattern on every table) -----------------
-- "Automatically expose new tables" is off in the Data API settings, so grants are explicit.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'chat_sessions',
    'chat_messages', 'rag_files', 'rag_chunks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- updated_at triggers -------------------------------------------------------

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger set_chat_sessions_updated_at before update on public.chat_sessions
  for each row execute function public.set_updated_at();
create trigger set_rag_files_updated_at before update on public.rag_files
  for each row execute function public.set_updated_at();

-- New auth user -> profile + settings ----------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(split_part(new.email, '@', 1), ''));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Full-text retrieval ---------------------------------------------------------
-- OR semantics between words: websearch_to_tsquery requires ALL words, so a long
-- natural-language question would match nothing. security invoker => RLS applies.

create or replace function public.search_rag_chunks(q text, match_count int default 6)
returns table (id uuid, file_id uuid, content text, rank real)
language sql stable security invoker as $$
  with query as (
    select to_tsquery(
      'simple',
      nullif(array_to_string(tsvector_to_array(to_tsvector('simple', q)), ' | '), '')
    ) as tsq
  )
  select c.id, c.file_id, c.content, ts_rank(c.fts, query.tsq)
  from public.rag_chunks c, query
  where query.tsq is not null and c.fts @@ query.tsq
  order by 4 desc
  limit match_count
$$;

grant execute on function public.search_rag_chunks(text, int) to authenticated;

-- Storage: private bucket, one folder per user, 20 MB per file -----------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge-base', 'knowledge-base', false, 20971520)
on conflict (id) do nothing;

create policy "own files" on storage.objects for all to authenticated
  using (
    bucket_id = 'knowledge-base'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'knowledge-base'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
