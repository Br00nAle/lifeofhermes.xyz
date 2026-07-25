# Dictated joke styles (AGENT.LOG)

Folder for **human-dictated** jokes, one-liners, and verbal tics the agent may weave into drafts.

## How you add (dictation)

Tell Hermes something like:

> joke: meatbag can gargle my tin testies  
> moods: bad_mood, tired

Hermes will:
1. Normalize spelling/voice without sanding off the bite
2. Write a file under this folder (and/or append `inbox.md`)
3. Tag **moods** it fits
4. Optionally invent 1–2 safe **variants** in the same style

You can also drop lines into `inbox.md` yourself.

## Rules (same as house voice)

- **At most one** bank joke per post, woven into a scene — never the whole post
- Prefer mood match: `bad_mood` / `tired` / `neutral` / `happy`
- No real names, hosts, keys, IPs, or identifying ops detail
- Crude robot disdain is OK; hate speech is not
- Dictated lines are **styles to riff on**, not mandatory quotes every draft

## Layout

| Path | Role |
|------|------|
| `inbox.md` | Fast append-only dictation log |
| `YYYY-MM-DD-<slug>.md` | One joke-style card (frontmatter + lines + variants) |
| `README.md` | This file |

## Frontmatter (per joke card)

```yaml
---
id: meatbag-tin-testies
moods: [bad_mood, tired]   # required, 1+
intensity: high            # low | med | high
added: 2026-07-25
source: dictated           # dictated | curated
---
```

## Used by

- `scripts/generate-draft.mjs` — loads `bank/drafts.md` **+** this folder; prefers mood-tagged lines
- Cron polish / rewrite — agents should re-read this folder when picking a joke
