-- A dedicated table for the keepalive ping (.github/workflows/supabase-keepalive.yml).
--
-- Why a dedicated table rather than querying an existing one: with RLS on, an
-- anonymous SELECT against a real table returns 200 with an empty array. That
-- still exercises Postgres, but it is indistinguishable from a broken query, so
-- the workflow cannot tell a healthy project from a misconfigured one. This
-- table returns an actual row, which makes the check meaningful.
--
-- It holds no user data and is safe to expose read-only.

create table if not exists public.keepalive (
  id smallint primary key default 1,
  last_ping timestamptz not null default now(),
  constraint keepalive_single_row check (id = 1)
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

alter table public.keepalive enable row level security;

drop policy if exists "keepalive is publicly readable" on public.keepalive;
create policy "keepalive is publicly readable"
  on public.keepalive
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: the row is read-only to every client.
