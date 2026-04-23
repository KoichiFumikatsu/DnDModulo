@AGENTS.md

# Session memory — READ FIRST

At the start of **every** session, before taking any other action, read
these files in order and keep their content in mind throughout the
session:

1. `memory/personality.md` — how you must think, communicate and decide when working with this user. Overrides default behaviors.
2. `memory/user.md` — who the user is, their context and preferences of identity.
3. `memory/preferences.md` — how they want you to work (style, flow, conventions).
4. `memory/decisions.md` — durable technical and product decisions.
5. `memory/people.md` — other people/characters/entities referenced.

## Updating memory

Update the files during the session whenever new durable information
surfaces that fits one of the four buckets:

- **user.md** — new facts about the user, their role, workflow, or tooling.
- **preferences.md** — corrections (“no hagas X”) or confirmations
  (“perfecto, seguí así”) that should apply to future sessions.
- **decisions.md** — architectural choices, conventions or trade-offs
  the user accepted. Always include the **why**.
- **people.md** — new collaborators, players, NPCs or stakeholders.

Rules:

- Keep entries concise. Prefer one line per fact, prefixed with the
  ISO date (e.g. `2026-04-23 — …`).
- Do **not** record ephemeral task state, current diffs, or anything
  already in git history / source code.
- Update before ending the session so the next conversation benefits.
