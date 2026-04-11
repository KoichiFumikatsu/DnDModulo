-- Add spell source type (spell slot, scroll, or charges-based)
alter table character_spells add column source_type text not null default 'spell'
  check (source_type in ('spell', 'scroll', 'charges'));
alter table character_spells add column charges_max int;
alter table character_spells add column charges_used int not null default 0;
