-- Launchory — Early Access schema for Supabase
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- It creates the table, prevents duplicate emails, validates fields, and locks
-- the table down so the public site can INSERT applications but cannot read them.

-- 1) Table --------------------------------------------------------------------
create table if not exists public.early_access (
  id            bigint generated always as identity primary key,
  role          text not null check (role in ('founder','creative')),
  name          text not null check (char_length(trim(name)) between 2 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  company       text,                       -- founder: company / idea (optional)
  industry      text,
  detail        text,                       -- founder: "what are you building?"
  profession    text,                       -- creative: profession
  portfolio     text,                       -- creative: portfolio (optional)
  social        text,                       -- creative: instagram / linkedin
  created_at    timestamptz not null default now()
);

-- 2) Prevent duplicate submissions (case-insensitive email) -------------------
create unique index if not exists early_access_email_unique
  on public.early_access (lower(email));

-- Helpful for the admin views / filtering
create index if not exists early_access_role_idx on public.early_access (role);
create index if not exists early_access_created_idx on public.early_access (created_at desc);

-- 3) Row Level Security -------------------------------------------------------
-- The site uses the public "anon" key. RLS makes that safe: anon may INSERT a
-- new application but may NOT select/update/delete. You read applicants from the
-- Supabase Table Editor or with the service_role key (never shipped to the browser).
alter table public.early_access enable row level security;

-- Allow anonymous inserts (the Early Access form). Validation above still applies.
drop policy if exists "anon can apply" on public.early_access;
create policy "anon can apply"
  on public.early_access
  for insert
  to anon
  with check (true);

-- (No select/update/delete policy for anon = those are denied by default.)

-- 4) Optional convenience views for the dashboard ----------------------------
-- Query these in the SQL editor or via the service_role key.
create or replace view public.founders as
  select id, name, email, company, industry, detail, created_at
  from public.early_access where role = 'founder' order by created_at desc;

create or replace view public.creatives as
  select id, name, email, profession, portfolio, social, industry, created_at
  from public.early_access where role = 'creative' order by created_at desc;

-- Done. Emails export (SQL editor):
--   select string_agg(email, e'\n') from public.early_access;                 -- everyone
--   select string_agg(email, e'\n') from public.early_access where role='founder';
