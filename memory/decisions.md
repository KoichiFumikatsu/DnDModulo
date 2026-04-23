# Decisiones técnicas y de producto

Decisiones durables que afectan el proyecto. Registrar el *por qué*,
no solo el *qué*. Actualizar cuando se toma una decisión nueva o se
revierte una vieja.

## Arquitectura
- Next.js 16 App Router + Supabase (Auth, Postgres, Realtime, RLS).
- Tokens y efectos de sala viven en `campaign_map_state` (una fila por campaña, JSONB).
- Efectos persisten hasta que el caster o DM los retira.
- Distancia en el grid: Manhattan (estilo Dofus). Diagonal cuesta 2.

## Unidades
- Velocidad de personaje y rangos se almacenan en metros.
- `characters.speed` es int, significa metros (migración 008).

## Notas libres
<!-- `YYYY-MM-DD — decisión. **Por qué:** … **Impacto:** …` -->
