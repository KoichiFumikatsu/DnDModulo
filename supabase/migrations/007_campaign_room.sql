-- ============================================================
-- Campaign Room: map state, event feed, and cross-member policies
-- Documents the state that was applied via the Supabase dashboard
-- so a fresh environment reproduces production exactly.
-- ============================================================

-- ============================================================
-- Map state (one row per campaign, holds tokens + camera)
-- ============================================================
create table if not exists campaign_map_state (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid unique references campaigns(id) on delete cascade,
  map_image_url text,
  grid_cols int default 20,
  grid_rows int default 15,
  tokens jsonb default '[]'::jsonb,
  map_offset_x double precision default 0,
  map_offset_y double precision default 0,
  map_scale double precision default 1.0,
  updated_at timestamptz default now()
);

alter table campaign_map_state enable row level security;

drop policy if exists "members read map" on campaign_map_state;
create policy "members read map" on campaign_map_state for select using (
  exists (select 1 from campaign_members m where m.campaign_id = campaign_map_state.campaign_id and m.user_id = auth.uid())
  or exists (select 1 from campaigns c where c.id = campaign_map_state.campaign_id and c.dm_id = auth.uid())
);

-- DM is the only client that writes directly. Players' token upserts go
-- through a server route using the service role (see /api/campaigns/[id]/assign-character).
drop policy if exists "dm writes map" on campaign_map_state;
create policy "dm writes map" on campaign_map_state for all using (
  exists (select 1 from campaigns c where c.id = campaign_map_state.campaign_id and c.dm_id = auth.uid())
);

-- ============================================================
-- Event feed (rolls, private DM rolls, chat)
-- ============================================================
create table if not exists campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid references auth.users(id),
  character_name text,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  is_private boolean default false,
  created_at timestamptz default now()
);

alter table campaign_events enable row level security;

drop policy if exists "members see events" on campaign_events;
create policy "members see events" on campaign_events for select using (
  is_private = false
  or exists (select 1 from campaigns c where c.id = campaign_events.campaign_id and c.dm_id = auth.uid())
);

drop policy if exists "members insert events" on campaign_events;
create policy "members insert events" on campaign_events for insert with check (
  exists (select 1 from campaign_members m where m.campaign_id = campaign_events.campaign_id and m.user_id = auth.uid())
  or exists (select 1 from campaigns c where c.id = campaign_events.campaign_id and c.dm_id = auth.uid())
);

-- ============================================================
-- Policy additions needed for multi-player party visibility.
-- The 001 migration only allowed DMs to read their campaigns and each
-- user to see their own membership rows — that hides party from players.
-- ============================================================

drop policy if exists "campaigns_read_authenticated" on campaigns;
create policy "campaigns_read_authenticated" on campaigns for select using (true);

drop policy if exists "campaign_members_read_all" on campaign_members;
create policy "campaign_members_read_all" on campaign_members for select using (true);

-- Players need to update their own row (e.g. set character_id via picker).
-- The original campaign_members_access (ALL) already covers this, but the
-- dashboard replaced it with a narrower UPDATE policy.
drop policy if exists "members_update_own" on campaign_members;
create policy "members_update_own" on campaign_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- Realtime publication
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'campaign_events'
  ) then
    alter publication supabase_realtime add table campaign_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'campaign_map_state'
  ) then
    alter publication supabase_realtime add table campaign_map_state;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'campaign_members'
  ) then
    alter publication supabase_realtime add table campaign_members;
  end if;
end $$;

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_campaign_events_campaign_created
  on campaign_events(campaign_id, created_at desc);
create index if not exists idx_campaign_events_user on campaign_events(user_id);
