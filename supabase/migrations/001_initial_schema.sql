-- ============================================================
-- DnD Character Manager — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- MODULE: USERS
-- ============================================================
create type user_role as enum ('player', 'dm', 'admin');

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null unique,
  avatar_url text,
  role user_role not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- MODULE: CHARACTERS
-- ============================================================
create table characters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,

  -- Basic info
  race text,
  subrace text,
  background text,
  alignment text,
  experience_points int not null default 0,
  speed int not null default 30,
  inspiration boolean not null default false,

  -- Ability scores
  str int not null default 10,
  dex int not null default 10,
  con int not null default 10,
  int int not null default 10,
  wis int not null default 10,
  cha int not null default 10,

  -- HP
  hp_max int not null default 1,
  hp_current int not null default 1,
  hp_temp int not null default 0,

  -- Combat
  ac int not null default 10,
  initiative_bonus int not null default 0,
  proficiency_bonus int not null default 2,
  hit_dice_total text,      -- e.g. "5d6+1d8"
  hit_dice_current text,    -- e.g. "3d6+1d8"

  -- Death saves
  death_saves_successes int not null default 0,
  death_saves_failures int not null default 0,

  -- Currency
  pp int not null default 0,
  gp int not null default 0,
  sp int not null default 0,
  cp int not null default 0,

  -- Physical appearance
  age text,
  height text,
  weight text,
  eyes text,
  skin text,
  hair text,

  -- Roleplay
  personality text,
  ideals text,
  bonds text,
  flaws text,
  backstory text,
  additional_equipment text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Classes (multiclass support)
-- ============================================================
create table character_classes (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  class_name text not null,
  subclass_name text,
  level int not null default 1,
  is_primary boolean not null default false,
  spellcasting_ability text,   -- 'cha', 'wis', 'int', etc.
  spell_save_dc int,
  spell_attack_mod int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Spell Slots (per class, per level)
-- ============================================================
create table character_spell_slots (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  class_id uuid not null references character_classes(id) on delete cascade,
  spell_level int not null check (spell_level between 0 and 9),
  slots_total int not null default 0,
  slots_used int not null default 0,
  unique(class_id, spell_level)
);

-- ============================================================
-- Spells
-- ============================================================
create table character_spells (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  class_id uuid not null references character_classes(id) on delete cascade,
  spell_level int not null check (spell_level between 0 and 9),
  name text not null,
  custom_notes text,            -- player's own notes like "1d8 + Wis"
  is_prepared boolean not null default false,
  is_always_prepared boolean not null default false,
  range text,
  damage text,
  components text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Weapons / Attacks
-- ============================================================
create table character_weapons (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  atk_bonus text,
  damage text,
  damage_type text,
  range text,
  weight text,
  notes text,
  sort_order int not null default 0
);

-- ============================================================
-- Equipment / Inventory
-- ============================================================
create table character_equipment (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  quantity int not null default 1,
  weight text,
  notes text,
  sort_order int not null default 0
);

-- ============================================================
-- Features & Traits
-- ============================================================
create table character_features (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  description text not null default '',
  source text,                  -- 'race', 'class', 'background', 'homebrew', etc.
  sort_order int not null default 0
);

-- ============================================================
-- Proficiencies (skills, weapons, tools, languages, saving throws)
-- ============================================================
create type proficiency_type as enum ('skill', 'weapon', 'armor', 'tool', 'language', 'saving_throw');
create type proficiency_level as enum ('none', 'proficient', 'expertise');

create table character_proficiencies (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  type proficiency_type not null,
  name text not null,
  proficiency_level proficiency_level not null default 'proficient',
  unique(character_id, type, name)
);

-- ============================================================
-- Class Resources (Sorcery Points, Ki, Superiority Dice, etc.)
-- ============================================================
create type reset_on as enum ('short_rest', 'long_rest', 'manual');

create table character_class_resources (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  current int not null default 0,
  maximum int not null default 0,
  reset_on reset_on not null default 'long_rest',
  sort_order int not null default 0
);

-- ============================================================
-- Custom / Homebrew Stats
-- ============================================================
create type custom_stat_type as enum ('counter', 'text', 'checkbox', 'tracker');

create table character_custom_stats (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  current_value int,
  max_value int,
  text_value text,
  bool_value boolean,
  stat_type custom_stat_type not null default 'counter',
  sort_order int not null default 0,
  notes text
);

-- ============================================================
-- MODULE: CAMPAIGNS (scaffold for future)
-- ============================================================
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  dm_id uuid not null references auth.users(id) on delete cascade,
  invite_code text unique not null default upper(substring(uuid_generate_v4()::text, 1, 8)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_members (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid references characters(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique(campaign_id, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

-- user_profiles: users see all profiles, edit only their own
alter table user_profiles enable row level security;
create policy "profiles_select" on user_profiles for select using (true);
create policy "profiles_update" on user_profiles for update using (auth.uid() = id);

-- characters: users manage only their own; DMs see members' characters
alter table characters enable row level security;
create policy "characters_owner" on characters
  using (auth.uid() = user_id);

-- All child tables: access via parent character ownership
alter table character_classes enable row level security;
create policy "classes_owner" on character_classes
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_spell_slots enable row level security;
create policy "spell_slots_owner" on character_spell_slots
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_spells enable row level security;
create policy "spells_owner" on character_spells
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_weapons enable row level security;
create policy "weapons_owner" on character_weapons
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_equipment enable row level security;
create policy "equipment_owner" on character_equipment
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_features enable row level security;
create policy "features_owner" on character_features
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_proficiencies enable row level security;
create policy "proficiencies_owner" on character_proficiencies
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_class_resources enable row level security;
create policy "resources_owner" on character_class_resources
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

alter table character_custom_stats enable row level security;
create policy "custom_stats_owner" on character_custom_stats
  using (exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid()));

-- campaigns
alter table campaigns enable row level security;
create policy "campaigns_dm" on campaigns using (auth.uid() = dm_id);

alter table campaign_members enable row level security;
create policy "campaign_members_access" on campaign_members
  using (
    auth.uid() = user_id or
    exists (select 1 from campaigns camp where camp.id = campaign_id and camp.dm_id = auth.uid())
  );

-- ============================================================
-- Indexes
-- ============================================================
create index idx_characters_user_id on characters(user_id);
create index idx_character_classes_character_id on character_classes(character_id);
create index idx_character_spells_character_id on character_spells(character_id);
create index idx_character_spell_slots_character_id on character_spell_slots(character_id);
create index idx_campaign_members_campaign_id on campaign_members(campaign_id);
create index idx_campaign_members_user_id on campaign_members(user_id);
