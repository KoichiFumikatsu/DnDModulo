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

## Cast mode en la sala
- Hechizos y armas comparten el mismo flujo de cast: botón → highlight rango → click target → efecto persistente.
- Armas: rango en metros (prefiere parsear `m`, fallback a `ft`, melee/touch = 1 casilla).
- Broadcast obligatorio: cada cast (hechizo o arma) genera un evento en `campaign_events` para que aparezca en el feed del DM.
- Conos y líneas soportan 8 direcciones (NE/NW/SE/SW además de N/S/E/W). Diagonales se renderizan como cuadrante.
- Hechizos Self (Burning Hands, Thunderwave) muestran preview del AoE anclado en el caster desde el inicio, no solo al hover.

## Broadcast de tiradas
- `SpellsTab` (ficha) broadcastea ataques y daño a `campaign_events` si hay `activeCampaignId` en localStorage. Así las tiradas de la ficha aparecen en el feed de la sala activa.

## Notas libres
<!-- `YYYY-MM-DD — decisión. **Por qué:** … **Impacto:** …` -->
