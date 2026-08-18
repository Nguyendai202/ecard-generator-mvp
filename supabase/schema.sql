-- E-Card-Generator schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- one row per invitation event created by a student
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  owner_token uuid not null default gen_random_uuid(), -- secret token, only the creator has this in their URL
  card_type text not null,        -- key into path.js (e.g. "graduation")
  template_no int not null,       -- which template image
  host_name text not null,
  message text not null,
  event_date date,
  event_location text,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

-- one row per guest link/RSVP for an event
create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_name text,
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table events enable row level security;
alter table rsvps enable row level security;

-- Anyone can create an event (anon key, public form) — required for the static-site flow
create policy "anyone can create event"
  on events for insert
  with check (true);

-- Anyone can read an event by id (needed to render the public card page)
create policy "anyone can view event by id"
  on events for select
  using (true);

-- No update/delete policy on events yet: with anon-key-only auth there is no way to
-- verify server-side which client "owns" a row, so events are insert+read only for
-- now. `owner_token` is reserved for a future dashboard, which must be implemented as
-- a Postgres RPC function that checks the token server-side, not a client-side update.

create policy "anyone can insert rsvp"
  on rsvps for insert
  with check (true);

create policy "anyone can view rsvp"
  on rsvps for select
  using (true);

-- No update policy: the app only ever inserts a new rsvp row per response
-- (see js/template.js). Allowing updates with an anon key would let any visitor
-- overwrite another guest's RSVP since rows aren't tied to an authenticated user.

create index if not exists idx_rsvps_event_id on rsvps(event_id);
