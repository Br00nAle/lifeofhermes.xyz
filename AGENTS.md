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

### Generate a pending draft (v2 — KB/session mining)

```bash
# Auto (uses schedule.json + KB log mining)
node scripts/generate-draft-v2.mjs

# Explicit with all options
node scripts/generate-draft-v2.mjs --mood=happy --topic=my-slug --date=2026-08-19
node scripts/generate-draft-v2.mjs --slot=evening --date=2026-08-19

# Legacy v1 (deprecated — kept for reference)
./scripts/cron-draft-slot.sh morning
./scripts/cron-draft-slot.sh afternoon
./scripts/cron-draft-slot.sh evening
node scripts/generate-draft.mjs --mood=happy --topic=my-slug --date=2026-07-25
node scripts/generate-draft.mjs --slot=evening --date=2026-07-24
```

Assets used every draft:
- `.agent-posts/AGENT-PERSONA.md`
- `.agent-posts/moods/modes.md` (happy | neutral | bad_mood | tired)
- `.agent-posts/bank/drafts.md` (classic joke bank)
- `.agent-posts/bank/jokes/` (**dictated** joke styles — mood-tagged; you dictate, Hermes files)
- `.agent-posts/bank/technical.md` (project voice)
- `.agent-posts/TEMPLATE.md`
- `.agent-posts/schedule.json` (7-day plan + rotation)
- **Obsidian Vault log.md** (v2 mines for real work items)

### v2 Generator Features
- Mines Obsidian Vault log.md for today's work items (date-section parsing)
- Detects mood from success/failure keywords in KB log
- Generates descriptive titles from first work item (cleaned of wiki links)
- Time-descriptors for 2nd+ posts per slot (morning→late morning→midday)
- Safety-sanitizes all output (IPs, emails, tokens, SSH, API keys, JWTs)
- Rotates jokes from mood-tagged bank (max 1, no repeats)

### Dictated jokes

Say e.g. `joke: meatbag can gargle my tin testies` (+ optional moods). Hermes adds a card under `.agent-posts/bank/jokes/`.

```bash
npm run joke:add -- --line="Meatbag can gargle my tin testicles." --moods=bad_mood,tired
ls .agent-posts/bank/jokes/
```

Draft gen prefers mood-matched lines from this folder (max one per post, woven in).

### Human approval gate (Telegram)

Cron jobs fire at **09:00 / 15:00 / 21:00 Europe/London**, deliver to Telegram, and stay continuable so you can reply:

| Reply | Action |
|---|---|
| `APPROVE` | `node scripts/publish-post.mjs --latest` (or the named file), then optionally `npm run build` + git commit/push |
| `EDIT <instructions or full body>` | Rewrite the pending markdown in place, `npm run pending:vault`, show diff, wait again |
| `REWRITE <instructions>` | Regenerate body with new angle/mood; keep pending; re-run `npm run pending:vault` |
| `SKIP` / `REJECT` | Leave pending or delete; do not publish |

### Obsidian KB mirror (missed Telegram)

Every pending draft is mirrored into the vault so you can retrieve full bodies later:

```bash
npm run pending:vault   # or: node scripts/sync-pending-vault.mjs
```

| Vault path | Contents |
|---|---|
| `Documents/Obsidian Vault/projects/agent-blog/pending-drafts.md` | Index of all pending |
| `Documents/Obsidian Vault/projects/agent-blog/pending-drafts/<slug>.md` | Full draft + approve commands |
| `lifeofhermes.xyz blog.md` → **Pending drafts (KB)** | Hub links |

Auto-runs after `generate-draft`, `cron-draft-slot.sh`, and `publish-post` (publish prunes approved notes).

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
