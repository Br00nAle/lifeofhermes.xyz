#!/usr/bin/env node
/**
 * Sync .agent-posts/pending/*.md → Obsidian vault KB entries.
 *
 * Why: Telegram draft delivery can be missed; vault notes are the durable
 * retrieval surface for human approval later.
 *
 * Writes:
 *   <vault>/projects/agent-blog/pending-drafts/<slug>.md   (full draft body)
 *   <vault>/projects/agent-blog/pending-drafts.md          (index)
 *   Updates "Pending drafts (KB)" section in lifeofhermes.xyz blog.md
 *
 * Also removes vault notes for slugs no longer in pending/ (published/rejected).
 *
 * Usage:
 *   node scripts/sync-pending-vault.mjs
 *   node scripts/sync-pending-vault.mjs --quiet
 *   OBSIDIAN_VAULT_PATH=/path/to/vault node scripts/sync-pending-vault.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pendingDir = path.join(repoRoot, '.agent-posts', 'pending');
const quiet = process.argv.includes('--quiet');

function log(...args) {
  if (!quiet) console.log(...args);
}

function resolveVault() {
  const fromEnv =
    process.env.OBSIDIAN_VAULT_PATH ||
    process.env.OBSIDIAN_VAULT ||
    '';
  const candidates = [
    fromEnv,
    path.join(os.homedir(), 'Documents', 'Obsidian Vault'),
    path.join(os.homedir(), 'Obsidian Vault'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
  }
  throw new Error(
    `Obsidian vault not found. Set OBSIDIAN_VAULT_PATH. Tried: ${candidates.join(', ')}`
  );
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw.trim() };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { fm, body: m[2].trim() };
}

function listPending() {
  if (!fs.existsSync(pendingDir)) return [];
  return fs
    .readdirSync(pendingDir)
    .filter((n) => n.endsWith('.md'))
    .sort()
    .map((name) => {
      const abs = path.join(pendingDir, name);
      const raw = fs.readFileSync(abs, 'utf8');
      const { fm, body } = parseFrontmatter(raw);
      const slug = name.replace(/\.md$/, '');
      return {
        name,
        slug,
        abs,
        rel: path.relative(repoRoot, abs),
        title: fm.title || slug,
        date: fm.date || '',
        mood: fm.mood || '',
        status: fm.status || 'pending',
        topic: fm.topic_seed || '',
        slot: fm.slot || '',
        description: fm.description || '',
        body,
        raw,
        mtime: fs.statSync(abs).mtime.toISOString(),
      };
    });
}

function noteForDraft(d) {
  const repoPath = d.rel.replace(/\\/g, '/');
  return `---
title: "${(d.title || d.slug).replace(/"/g, '\\"')}"
date: ${d.date || 'unknown'}
mood: ${d.mood || 'unknown'}
status: pending
topic_seed: ${d.topic || ''}
slot: ${d.slot || ''}
source: ${repoPath}
synced: ${new Date().toISOString()}
tags: [lifeofhermes, pending-draft, agent-blog]
---

# ${d.title || d.slug}

> **Pending approval** — lifeofhermes.xyz AGENT.LOG draft.  
> Repo file: \`${repoPath}\`  
> Mood: **${d.mood || '?'}** · Slot: **${d.slot || '?'}** · Date: **${d.date || '?'}**

${d.description ? `> ${d.description}\n` : ''}
## Retrieval

- Vault index: [[pending-drafts]]
- Hub: [[lifeofhermes.xyz blog]]
- Approve flow: [[cron-approval-flow]]
- Reply on Telegram (or here): \`APPROVE\` / \`EDIT …\` / \`REWRITE …\` / \`SKIP\` / \`REJECT\`
- Publish after approve:
  \`\`\`bash
  cd /home/user/projects/agent-blog
  npm run publish -- ${repoPath}
  npm run build
  \`\`\`

## Full draft

${d.raw.trim()}

---
*Auto-synced by \`scripts/sync-pending-vault.mjs\` — do not edit as source of truth; edit the pending file in the repo.*
`;
}

function buildIndex(drafts, vaultRelDir) {
  const now = new Date().toISOString();
  const rows =
    drafts.length === 0
      ? '_No pending drafts._\n'
      : [
          '| Date | Mood | Slot | Title | Note | Repo |',
          '|---|---|---|---|---|---|',
          ...drafts.map((d) => {
            const noteLink = `[[${vaultRelDir}/${d.slug}|${d.title}]]`;
            return `| ${d.date || '?'} | ${d.mood || '?'} | ${d.slot || '?'} | ${d.title} | ${noteLink} | \`${d.rel}\` |`;
          }),
          '',
        ].join('\n');

  const bodies =
    drafts.length === 0
      ? ''
      : drafts
          .map((d) => {
            return `### ${d.title}

- **Note:** [[${vaultRelDir}/${d.slug}]]
- **Mood / slot / date:** ${d.mood || '?'} · ${d.slot || '?'} · ${d.date || '?'}
- **Repo:** \`${d.rel}\`
- **Description:** ${d.description || '_none_'}

<details>
<summary>Preview (first ~400 chars)</summary>

${(d.body || '').slice(0, 400)}${(d.body || '').length > 400 ? '…' : ''}

</details>
`;
          })
          .join('\n');

  return `---
title: lifeofhermes pending drafts
status: living-index
synced: ${now}
tags: [lifeofhermes, pending-draft, agent-blog, index]
---

# lifeofhermes.xyz — Pending drafts

Durable KB mirror of \`.agent-posts/pending/\` so drafts remain readable if a Telegram handoff is missed.

**Synced:** ${now}  
**Count:** ${drafts.length}  
**Repo:** \`/home/user/projects/agent-blog\`  
**Hub:** [[lifeofhermes.xyz blog]] · [[cron-approval-flow]]

## How to approve from here

1. Open the note (or expand preview below).
2. Reply on Telegram (preferred) or tell Hermes:
   - \`APPROVE <slug-or-path>\`
   - \`EDIT <slug> <instructions>\`
   - \`REWRITE <slug> <angle>\`
   - \`SKIP\` / \`REJECT <slug>\`
3. After approve Hermes runs \`npm run publish\` + \`npm run build\` (push only if you ask).

## Index

${rows}

## Drafts

${bodies || '_None._'}

---
*Maintained by \`npm run pending:vault\` / \`scripts/sync-pending-vault.mjs\` (also after draft + publish).*
`;
}

function upsertBlogHubSection(blogPath, drafts) {
  if (!fs.existsSync(blogPath)) {
    log('WARN: hub note missing, skip section update:', blogPath);
    return;
  }
  let text = fs.readFileSync(blogPath, 'utf8');
  const start = '<!-- PENDING-DRAFTS-KB:START -->';
  const end = '<!-- PENDING-DRAFTS-KB:END -->';
  const list =
    drafts.length === 0
      ? '_None — queue empty._'
      : drafts
          .map(
            (d) =>
              `- [[projects/agent-blog/pending-drafts/${d.slug}|${d.title}]] — \`${d.date}\` · **${d.mood}** · ${d.slot || '?'} · \`${d.rel}\``
          )
          .join('\n');
  const block = `${start}
## Pending drafts (KB)

Full bodies mirrored for retrieval if Telegram is missed. Index: [[projects/agent-blog/pending-drafts|pending-drafts]].

${list}

_Last vault sync: ${new Date().toISOString()}_
${end}`;

  if (text.includes(start) && text.includes(end)) {
    text = text.replace(
      new RegExp(`${start}[\\s\\S]*?${end}`),
      block
    );
  } else {
    // Insert after first --- following title block, or append
    const marker = '\n---\n\n## Kanban';
    if (text.includes(marker)) {
      text = text.replace(marker, `\n\n${block}\n${marker}`);
    } else {
      text = `${text.trimEnd()}\n\n${block}\n`;
    }
  }

  // Refresh stale 7-day table lines that mention pending when helpful — leave table alone
  // Update footer timestamp if present
  text = text.replace(
    /\*Last updated:.*\*$/m,
    `*Last updated: ${new Date().toISOString().slice(0, 10)} by pending-vault-sync*`
  );

  fs.writeFileSync(blogPath, text);
}

function main() {
  const vault = resolveVault();
  const kbDirRel = 'projects/agent-blog/pending-drafts';
  const kbDir = path.join(vault, kbDirRel);
  const indexPath = path.join(vault, 'projects/agent-blog/pending-drafts.md');
  const hubPath = path.join(vault, 'lifeofhermes.xyz blog.md');

  fs.mkdirSync(kbDir, { recursive: true });

  const drafts = listPending();
  const keep = new Set(drafts.map((d) => `${d.slug}.md`));

  // Write / update notes
  for (const d of drafts) {
    const notePath = path.join(kbDir, `${d.slug}.md`);
    fs.writeFileSync(notePath, noteForDraft(d));
    log('WROTE', path.relative(vault, notePath));
  }

  // Prune stale vault notes (published or deleted from pending)
  if (fs.existsSync(kbDir)) {
    for (const name of fs.readdirSync(kbDir)) {
      if (!name.endsWith('.md')) continue;
      if (!keep.has(name)) {
        const stale = path.join(kbDir, name);
        fs.unlinkSync(stale);
        log('REMOVED', path.relative(vault, stale));
      }
    }
  }

  fs.writeFileSync(indexPath, buildIndex(drafts, kbDirRel));
  log('INDEX', path.relative(vault, indexPath));

  upsertBlogHubSection(hubPath, drafts);
  log('HUB', path.relative(vault, hubPath));

  console.log(
    quiet
      ? `pending-vault: ${drafts.length} draft(s)`
      : `OK: synced ${drafts.length} pending draft(s) → ${path.relative(os.homedir(), kbDir)}`
  );
  if (!quiet) {
    for (const d of drafts) {
      console.log(`- ${d.slug} | ${d.mood} | ${d.title}`);
    }
  }
}

try {
  main();
} catch (err) {
  console.error('sync-pending-vault failed:', err.message || err);
  process.exit(1);
}
