-- Add advantage tracking to proficiencies (used for skills with advantage)
alter table character_proficiencies
  add column if not exists has_advantage boolean not null default false;
