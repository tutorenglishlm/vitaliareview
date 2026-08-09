-- VITALIA Review Cards — CRM schema
-- Run this in the Supabase Dashboard → SQL Editor → New query → Run.

create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client     text not null default '',
  contact    text default '',
  status     text default 'En diseño',
  notes      text default '',
  config     jsonb not null default '{}'::jsonb,   -- full card design + logo (base64)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user only sees/edits their own rows.
alter table public.projects enable row level security;

drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_own on public.projects;
drop policy if exists projects_delete_own on public.projects;

create policy projects_select_own on public.projects for select using (auth.uid() = user_id);
create policy projects_insert_own on public.projects for insert with check (auth.uid() = user_id);
create policy projects_update_own on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_delete_own on public.projects for delete using (auth.uid() = user_id);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);
