-- ============================================================
-- Switch characters.speed semantics from feet to meters.
-- Convention: 3 ft ≈ 1 m (30 ft → 10 m). Existing rows are
-- divided by 3 (rounded). The column type stays int.
-- Idempotent: guarded by a one-shot marker so re-running the
-- migration won't keep halving existing values.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_description d
    join pg_catalog.pg_class c on c.oid = d.objoid
    join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid
    where c.relname = 'characters' and a.attname = 'speed' and d.description = 'meters'
  ) then
    update characters set speed = greatest(1, round(speed::numeric / 3)::int);
    alter table characters alter column speed set default 10;
    comment on column characters.speed is 'meters';
  end if;
end $$;
