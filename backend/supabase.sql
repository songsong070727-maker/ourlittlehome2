-- Our Little Home 数据库表
-- 在 Supabase 的 SQL Editor 里粘贴执行一次即可

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  channel text not null default 'main',
  role text not null check (role in ('mine', 'theirs')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_channel on public.messages (channel, id);

create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  endpoint text not null unique,
  keys jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 自家用，先放开读写（以后要收紧再说）
alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;

create policy "open read messages" on public.messages for select using (true);
create policy "open insert messages" on public.messages for insert with check (true);
create policy "open read subs" on public.subscriptions for select using (true);
create policy "open insert subs" on public.subscriptions for insert with check (true);
create policy "open delete subs" on public.subscriptions for delete using (true);