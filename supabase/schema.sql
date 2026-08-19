-- E-Card-Generator schema (v2)
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.

create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

-- one row per invitation event created by a student
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  owner_token uuid not null default gen_random_uuid(), -- secret token, only the creator has this in their URL
  card_type text not null,        -- key into path.js (e.g. "graduation")
  template_no int not null,       -- which template image
  host_name text not null,
  message text not null,
  event_date date,
  event_time text,                -- free-form "18:30" — avoids timezone handling for a v1
  event_time_end text,            -- free-form "21:00", optional
  event_location text,
  notes text,                     -- optional logistics notes for guests (parking, traffic, ...)
  afterparty_note text,           -- optional; non-null means an after-party/meal opt-in is offered
  music_url text,                 -- optional background-music mp3 link
  photo_url text,                 -- optional host-uploaded photo (Supabase Storage public URL)
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table events add column if not exists event_time text;
alter table events add column if not exists music_url text;
alter table events add column if not exists photo_url text;
alter table events add column if not exists event_time_end text;
alter table events add column if not exists notes text;
alter table events add column if not exists afterparty_note text;

-- one row per guest with a personalized invite link (event_id + guest.id form the link)
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_name text not null,
  relationship text,              -- optional, e.g. "bạn thân", "thầy cô" — used to pick a fitting tone
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  join_afterparty boolean not null default false,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table guests add column if not exists relationship text;
alter table guests add column if not exists join_afterparty boolean not null default false;

-- one row per guest response when no personalized guest list was made (shared link, guest types their own name)
create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_name text,
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  join_afterparty boolean not null default false,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table rsvps add column if not exists join_afterparty boolean not null default false;

-- guestbook: public wishes/messages left by guests, shown to everyone viewing
-- that event's card ("sổ lưu bút") — unlike events/guests, this is meant to
-- be listable, but only scoped to one event_id via the RPC below, never the
-- whole table.
create table if not exists wishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_guests_event_id on guests(event_id);
create index if not exists idx_rsvps_event_id on rsvps(event_id);
create index if not exists idx_wishes_event_id on wishes(event_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Design: rows are addressed by an unguessable uuid (the "capability" is
-- knowing the id). We must NOT allow blanket `select using (true)` policies,
-- because that lets anyone dump every event/guest row with one anon-key
-- request, defeating the "unguessable link" model entirely. Instead, all
-- reads go through SECURITY DEFINER functions below that always filter by
-- an exact id parameter, so a client can only ever fetch the one row whose
-- id they already know — never list/enumerate others.
--
-- Consequence: since there is no SELECT policy, INSERT ... RETURNING (what
-- supabase-js's `.select()` after `.insert()` generates) will fail RLS,
-- because Postgres needs a SELECT policy to allow returning the new row.
-- The client must generate the row's id itself (crypto.randomUUID()) and
-- insert without `.select()` — see js/creator.js.

alter table events enable row level security;
alter table guests enable row level security;
alter table rsvps enable row level security;
alter table wishes enable row level security;

drop policy if exists "anyone can create event" on events;
create policy "anyone can create event"
  on events for insert
  with check (true);

-- no select/update/delete policy on events: reads only via get_event(), and
-- there is no update/delete path yet (owner_token is reserved for a future
-- dashboard implemented the same way, as a token-checked RPC).
drop policy if exists "anyone can view event by id" on events;

drop policy if exists "anyone can create guests" on guests;
create policy "anyone can create guests"
  on guests for insert
  with check (true);

-- no select/update policy on guests: reads via get_guest(), RSVP writes via
-- submit_guest_rsvp() only.

drop policy if exists "anyone can insert rsvp" on rsvps;
create policy "anyone can insert rsvp"
  on rsvps for insert
  with check (true);

-- no select policy on rsvps either (nothing in the app reads it back yet).

drop policy if exists "anyone can add a wish" on wishes;
create policy "anyone can add a wish"
  on wishes for insert
  with check (true);

-- no select policy on wishes: even though a guestbook is meant to be public,
-- it must stay scoped to ONE event — a blanket select policy would let
-- anyone dump every wish written on every event ever created. Reads go
-- through get_wishes(event_id) below instead.

-- ============================================================
-- RPC functions (SECURITY DEFINER, always filtered by an exact id)
-- ============================================================

drop function if exists get_event(uuid);
create or replace function get_event(p_event_id uuid)
returns table (
  card_type text,
  template_no int,
  host_name text,
  message text,
  event_date date,
  event_time text,
  event_time_end text,
  event_location text,
  notes text,
  afterparty_note text,
  music_url text,
  photo_url text
)
language sql
security definer
set search_path = public
as $$
  select card_type, template_no, host_name, message, event_date, event_time, event_time_end,
         event_location, notes, afterparty_note, music_url, photo_url
  from events
  where id = p_event_id;
$$;

drop function if exists get_guest(uuid);
create or replace function get_guest(p_guest_id uuid)
returns table (
  event_id uuid,
  guest_name text,
  relationship text,
  status text,
  join_afterparty boolean
)
language sql
security definer
set search_path = public
as $$
  select event_id, guest_name, relationship, status, join_afterparty
  from guests
  where id = p_guest_id;
$$;

drop function if exists submit_guest_rsvp(uuid, text);
create or replace function submit_guest_rsvp(p_guest_id uuid, p_status text, p_join_afterparty boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('yes', 'no') then
    raise exception 'invalid status';
  end if;

  update guests
  set status = p_status, join_afterparty = p_join_afterparty, responded_at = now()
  where id = p_guest_id;
end;
$$;

create or replace function get_wishes(p_event_id uuid)
returns table (
  guest_name text,
  message text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select guest_name, message, created_at
  from wishes
  where event_id = p_event_id
  order by created_at desc
  limit 100;
$$;

revoke all on function get_event(uuid) from public;
revoke all on function get_guest(uuid) from public;
revoke all on function submit_guest_rsvp(uuid, text, boolean) from public;
revoke all on function get_wishes(uuid) from public;

grant execute on function get_event(uuid) to anon, authenticated;
grant execute on function get_guest(uuid) to anon, authenticated;
grant execute on function submit_guest_rsvp(uuid, text, boolean) to anon, authenticated;
grant execute on function get_wishes(uuid) to anon, authenticated;

-- ============================================================
-- Storage: public bucket for host-uploaded photos
-- ============================================================
-- Enforced server-side (not just client-side) via file_size_limit and
-- allowed_mime_types on the bucket itself, since this is an open,
-- unauthenticated upload endpoint (anon key, no login).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-photos', 'card-photos', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

drop policy if exists "anyone can upload card photos" on storage.objects;
create policy "anyone can upload card photos"
  on storage.objects for insert
  with check (bucket_id = 'card-photos');

drop policy if exists "anyone can read card photos" on storage.objects;
create policy "anyone can read card photos"
  on storage.objects for select
  using (bucket_id = 'card-photos');

-- ============================================================
-- Storage: public bucket for host-uploaded background music
-- ============================================================
-- Holds the client-trimmed WAV clip (trimmed in-browser via Web Audio API,
-- see js/creator.js), not the original uploaded file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-music', 'card-music', true, 20971520, array['audio/wav','audio/mpeg','audio/mp4','video/mp4'])
on conflict (id) do update set
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = array['audio/wav','audio/mpeg','audio/mp4','video/mp4'];

drop policy if exists "anyone can upload card music" on storage.objects;
create policy "anyone can upload card music"
  on storage.objects for insert
  with check (bucket_id = 'card-music');

drop policy if exists "anyone can read card music" on storage.objects;
create policy "anyone can read card music"
  on storage.objects for select
  using (bucket_id = 'card-music');
