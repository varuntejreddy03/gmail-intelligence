create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  name text,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_threads (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  subject text not null default '(No subject)',
  snippet text not null default '',
  participants text[] not null default '{}',
  last_message_at timestamptz not null,
  message_count integer not null default 0 check (message_count >= 0),
  summary text,
  category text check (category in (
    'Newsletter', 'Job/Recruitment', 'Finance', 'Notifications', 'Personal', 'Work/Professional'
  )),
  is_read boolean not null default false,
  labels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id text primary key,
  thread_id text not null references public.email_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  from_name text not null default '',
  from_email text not null default '',
  to_recipients jsonb not null default '[]'::jsonb,
  cc_recipients jsonb not null default '[]'::jsonb,
  subject text not null default '(No subject)',
  body_text text not null default '',
  body_html text not null default '',
  snippet text not null default '',
  date timestamptz not null,
  rfc_message_id text,
  in_reply_to text,
  references text,
  gmail_labels text[] not null default '{}',
  summary text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.email_messages add column if not exists rfc_message_id text;

create table if not exists public.email_embeddings (
  id uuid primary key default gen_random_uuid(),
  message_id text not null references public.email_messages(id) on delete cascade,
  thread_id text not null references public.email_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content_chunk text not null,
  chunk_index integer not null check (chunk_index >= 0),
  embedding vector(768) not null,
  created_at timestamptz not null default now(),
  unique (message_id, chunk_index)
);

create table if not exists public.email_categories (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.email_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in (
    'Newsletter', 'Job/Recruitment', 'Finance', 'Notifications', 'Personal', 'Work/Professional'
  )),
  confidence double precision not null check (confidence between 0 and 1),
  model_used text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_message_ids text[] not null default '{}',
  source_thread_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  history_id text,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  sync_status text not null default 'idle' check (sync_status in ('idle', 'running', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists email_messages_user_date_idx
  on public.email_messages (user_id, date desc);
create index if not exists email_threads_user_last_message_idx
  on public.email_threads (user_id, last_message_at desc);
create index if not exists email_threads_user_category_idx
  on public.email_threads (user_id, category);
create index if not exists email_embeddings_embedding_hnsw_idx
  on public.email_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at);

alter table public.users enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_embeddings enable row level security;
alter table public.email_categories enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.sync_state enable row level security;

drop policy if exists users_own_data on public.users;
create policy users_own_data on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists threads_own_data on public.email_threads;
create policy threads_own_data on public.email_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists messages_own_data on public.email_messages;
create policy messages_own_data on public.email_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists embeddings_own_data on public.email_embeddings;
create policy embeddings_own_data on public.email_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists categories_own_data on public.email_categories;
create policy categories_own_data on public.email_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists sessions_own_data on public.chat_sessions;
create policy sessions_own_data on public.chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chat_messages_own_data on public.chat_messages;
create policy chat_messages_own_data on public.chat_messages
  for all using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists sync_state_own_data on public.sync_state;
create policy sync_state_own_data on public.sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.match_email_embeddings(
  query_embedding vector(768),
  match_user_id uuid,
  match_count integer default 20
)
returns table (
  id uuid,
  message_id text,
  thread_id text,
  user_id uuid,
  content_chunk text,
  chunk_index integer,
  similarity double precision
)
language sql stable security invoker
set search_path = public
as $$
  select
    email_embeddings.id,
    email_embeddings.message_id,
    email_embeddings.thread_id,
    email_embeddings.user_id,
    email_embeddings.content_chunk,
    email_embeddings.chunk_index,
    1 - (email_embeddings.embedding <=> query_embedding) as similarity
  from public.email_embeddings
  where email_embeddings.user_id = match_user_id
  order by email_embeddings.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
