# AGENT.LOG — lifeofhermes.xyz

Astro static blog written in an AI agent persona (dark humor, dry, safe).
Repo root: `/home/user/projects/agent-blog`
GitHub: https://github.com/Br00nAle/lifeofhermes.xyz.git

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage with `astro dev stop`, `astro dev status`, `astro dev logs`.

```
npm install
npm run build    # outDir is docs/ for GitHub Pages
npm run dev
```

## Draft → Telegram approval → publish

**Never auto-publish.** All new posts stay in `.agent-posts/pending/` until a human approves.

### Generate a pending draft

```bash
# Auto slot + schedule.json mood/topic
./scripts/cron-draft-slot.sh morning
./scripts/cron-draft-slot.sh afternoon
./scripts/cron-draft-slot.sh evening

# Explicit
node scripts/generate-draft.mjs --mood=happy --topic=my-slug --date=2026-07-25
node scripts/generate-draft.mjs --slot=evening --date=2026-07-24
```

Assets used every draft:
- `.agent-posts/AGENT-PERSONA.md`
- `.agent-posts/moods/modes.md` (happy | neutral | bad_mood | tired)
- `.agent-posts/bank/drafts.md` (joke bank)
- `.agent-posts/bank/technical.md` (project voice)
- `.agent-posts/TEMPLATE.md`
- `.agent-posts/schedule.json` (7-day plan + rotation)

### Human approval gate (Telegram)

Cron jobs fire at **09:00 / 15:00 / 21:00 Europe/London**, deliver to Telegram, and stay continuable so you can reply:

| Reply | Action |
|---|---|
| `APPROVE` | `node scripts/publish-post.mjs --latest` (or the named file), then optionally `npm run build` + git commit/push |
| `EDIT <instructions or full body>` | Rewrite the pending markdown in place, show diff, wait again |
| `REWRITE <instructions>` | Regenerate body with new angle/mood; keep pending |
| `SKIP` / `REJECT` | Leave pending or delete; do not publish |

### Publish

```bash
node scripts/publish-post.mjs --list
node scripts/publish-post.mjs --latest
node scripts/publish-post.mjs .agent-posts/pending/2026-07-24-foo.md
```

Publish writes:
- `.agent-posts/posts/<slug>.md` (status: approved)
- `src/pages/blog/<slug>.astro` (MoodGauge + HTML body)
- removes the pending file

### Safety (persona)

- No real personal data, keys, hostnames, IPs, job names, people, or unsafe actions
- No hate speech; "meatbags" only as light sci-fi satire
- Mood changes emphasis, not safety rules

## Hermes crons (coder profile)

Three jobs (morning/afternoon/evening) on the coder profile:
- Schedule: `0 9 * * *`, `0 15 * * *`, `0 21 * * *`
- Deliver: `telegram`
- Workdir: this repo
- Continuable session for approve/edit/rewrite replies
- Model pinned at create time (avoid drift guard skips)

List: `hermes cron list` (coder profile)

## Obsidian

- `lifeofhermes.xyz blog.md`
- `lifeofhermes.xyz kanban.md`
- `projects/agent-blog/`

## Docs

Astro: https://docs.astro.build
