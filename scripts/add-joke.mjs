#!/usr/bin/env node
/**
 * Add a dictated joke to the bank.
 *
 * Usage:
 *   node scripts/add-joke.mjs --line="Meatbag can gargle my tin testicles." --moods=bad_mood,tired
 *   node scripts/add-joke.mjs --line="..." --moods=happy --id=short-slug --intensity=med
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib/md.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const jokesDir = path.join(repoRoot, '.agent-posts', 'bank', 'jokes');
const inboxPath = path.join(jokesDir, 'inbox.md');

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) map[a.slice(2)] = 'true';
    else map[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return map;
}

const args = parseArgs(process.argv.slice(2));
const line = (args.line || args.raw || '').trim();
if (!line) {
  console.error(
    'Usage: node scripts/add-joke.mjs --line="..." --moods=bad_mood,tired [--id=slug] [--intensity=high|med|low]'
  );
  process.exit(2);
}

const moods = (args.moods || args.mood || 'bad_mood')
  .split(/[|,]/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const intensity = (args.intensity || 'med').toLowerCase();
const date = args.date || new Date().toISOString().slice(0, 10);
const id =
  (args.id || slugify(line).slice(0, 48) || `joke-${date}`).replace(
    /[^a-z0-9-]/g,
    ''
  ) || `joke-${date}`;
const source = args.source || 'dictated';

fs.mkdirSync(jokesDir, { recursive: true });

const cardPath = path.join(jokesDir, `${date}-${id}.md`);
const card = `---
id: ${id}
moods: [${moods.join(', ')}]
intensity: ${intensity}
added: ${date}
source: ${source}
---

# ${id.replace(/-/g, ' ')}

Dictated joke style. Weave **at most one** line into a scene; never the whole post.

## Lines

- ${JSON.stringify(line)}

## Fit

Moods: ${moods.join(', ')} · intensity: ${intensity}
`;

if (fs.existsSync(cardPath) && args.force !== 'true') {
  console.error('EXISTS:', cardPath, '(pass --force=true to overwrite)');
  process.exit(1);
}
fs.writeFileSync(cardPath, card);

// append inbox
const inboxEntry = `
### ${date}
- moods: ${moods.join(', ')}
- intensity: ${intensity}
- id: ${id}
- line: ${line}
`;
if (!fs.existsSync(inboxPath)) {
  fs.writeFileSync(
    inboxPath,
    `# Joke inbox (dictation log)\n\n${inboxEntry}`
  );
} else {
  fs.appendFileSync(inboxPath, inboxEntry);
}

console.log('JOKE_CARD:', path.relative(repoRoot, cardPath));
console.log('ID:', id);
console.log('MOODS:', moods.join(','));
console.log('LINE:', line);
