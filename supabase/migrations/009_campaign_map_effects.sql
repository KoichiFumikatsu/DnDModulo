-- ============================================================
-- Persistent area effects on the campaign map (spells, auras).
-- Stored on the same row as tokens/camera so a full session
-- snapshot survives reconnects. Effects persist until a member
-- explicitly removes them.
-- ============================================================

alter table campaign_map_state
  add column if not exists active_effects jsonb not null default '[]'::jsonb;
