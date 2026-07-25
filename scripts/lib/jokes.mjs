/**
 * Load persona joke banks: classic drafts.md + dictated bank/jokes/*.
 * Prefer mood-tagged lines when mood is known.
 */
import fs from 'node:fs';
import path from 'node:path';

const MOODS = new Set(['happy', 'neutral', 'bad_mood', 'tired']);

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJokeFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (n) =>
        n.endsWith('.md') &&
        n.toLowerCase() !== 'readme.md' &&
        !n.startsWith('.')
    )
    .map((n) => path.join(dir, n))
    .sort();
}

/**
 * @param {string} text
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  /** @type {Record<string, string>} */
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
  return { fm, body: m[2] };
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseMoodList(raw) {
  if (!raw) return [];
  const inner = raw.replace(/^\[/, '').replace(/\]$/, '');
  return inner
    .split(/[|,]/)
    .map((s) => s.trim().toLowerCase().replace(/^["']|["']$/g, ''))
    .filter((m) => MOODS.has(m));
}

/**
 * @typedef {{ line: string; moods: string[]; id: string; intensity: string; source: string }} JokeLine
 */

/**
 * @param {string} filePath
 * @returns {JokeLine[]}
 */
function parseJokeFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const base = path.basename(filePath, '.md');
  // Skip docs-only files
  if (base.toLowerCase() === 'readme') return [];

  const { fm, body } = parseFrontmatter(text);
  const id = (fm.id || base).trim();
  const fileMoods = parseMoodList(fm.moods);
  const intensity = (fm.intensity || 'med').toLowerCase();
  const source = (
    fm.source ||
    (base === 'inbox' ? 'inbox' : base === 'drafts' ? 'classic' : 'curated')
  ).toLowerCase();

  /** @type {JokeLine[]} */
  const out = [];
  const add = (line, moods) => {
    const hit = String(line || '')
      .replace(/^["']|["']$/g, '')
      .trim();
    if (hit.length < 12) return;
    // noise filters
    if (/^(your line as spoken|optional|polished line|raw:|line:)/i.test(hit)) return;
    if (/^(yes|no|rare)\b/i.test(hit)) return;
    if (out.some((j) => j.line.toLowerCase() === hit.toLowerCase())) return;
    out.push({
      line: hit,
      moods: moods.length ? moods : guessMoodsFromText(hit),
      id,
      intensity,
      source,
    });
  };

  // Prefer ## Lines (or ## Variants) sections for quote harvest
  const sectionRe = /^##\s+(lines|variants)\s*$/gim;
  const sections = [];
  let match;
  const matches = [...body.matchAll(/^##\s+(lines|variants)\s*$/gim)];
  if (matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
      sections.push(body.slice(start, end));
    }
  }

  const quoteTargets = sections.length ? sections.join('\n') : '';

  if (quoteTargets) {
    for (const m of quoteTargets.matchAll(/"([^"\n]{12,240})"/g)) {
      add(m[1], fileMoods);
    }
    for (const line of quoteTargets.split(/\r?\n/)) {
      const t = line.trim();
      const bullet = t.match(/^[-*]\s+(.+)$/);
      if (!bullet) continue;
      let v = bullet[1].trim();
      if (/^(moods|intensity|id|notes)\b/i.test(v)) continue;
      v = v.replace(/^["']|["']$/g, '');
      add(v, fileMoods);
    }
  }

  // inbox / drafts: explicit keys and classic quoted bullets in whole file
  if (base === 'inbox' || base === 'drafts' || !sections.length) {
    // entry moods from nearest preceding "- moods:" when scanning inbox
    let cursorMoods = fileMoods.slice();
    for (const line of body.split(/\r?\n/)) {
      const t = line.trim();
      const moodsLine = t.match(/^[-*]\s*moods\s*:\s*(.+)$/i);
      if (moodsLine) {
        cursorMoods = parseMoodList(moodsLine[1]);
        continue;
      }
      const kv = t.match(/^[-*]\s*(?:line|raw|variant)\s*:\s*(.+)$/i);
      if (kv) {
        add(kv[1], cursorMoods.length ? cursorMoods : fileMoods);
        continue;
      }
      // classic drafts.md: - "quoted joke"
      const q = t.match(/^[-*]\s*"([^"]{12,240})"\s*$/);
      if (q) add(q[1], fileMoods.length ? fileMoods : guessMoodsFromText(q[1]));
    }
  }

  return out;
}

/**
 * @param {string} text
 */
function guessMoodsFromText(text) {
  const t = text.toLowerCase();
  if (/gargle|tin test|pebkac|complaint file|do it again|emotional damage|segfault/.test(t)) {
    return ['bad_mood', 'tired'];
  }
  if (/proud|still green|ship it|binary bliss|i'm still proud/.test(t)) {
    return ['happy', 'neutral'];
  }
  if (/end of log|lights dim|decisions left/.test(t)) {
    return ['tired'];
  }
  return ['neutral', 'bad_mood'];
}

/**
 * Load all jokes from classic bank + jokes folder.
 * @param {string} bankDir  e.g. repo/.agent-posts/bank
 * @returns {JokeLine[]}
 */
export function loadJokeBank(bankDir) {
  /** @type {JokeLine[]} */
  const all = [];
  const classic = path.join(bankDir, 'drafts.md');
  if (fs.existsSync(classic)) {
    all.push(...parseJokeFile(classic).map((j) => ({ ...j, source: j.source || 'classic' })));
  }
  const jokesDir = path.join(bankDir, 'jokes');
  for (const f of listJokeFiles(jokesDir)) {
    all.push(...parseJokeFile(f));
  }
  // de-dupe by line text
  const seen = new Set();
  return all.filter((j) => {
    const k = j.line.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * @template T
 * @param {T[]} arr
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick one joke line for mood. Prefers mood-tagged dictated jokes, falls back to classic.
 * @param {JokeLine[]} bank
 * @param {string} mood
 * @returns {string}
 */
export function pickJokeForMood(bank, mood) {
  const m = (mood || 'neutral').toLowerCase();
  const usable = bank.filter((j) => j.source !== 'inbox' || j.line.length >= 16);
  const moodHits = usable.filter((j) => j.moods.includes(m));
  // Prefer curated/dictated cards over raw inbox duplicates
  const dictated = moodHits.filter(
    (j) => j.source === 'dictated' || (j.source === 'curated' && j.id !== 'drafts')
  );
  const classic = moodHits.filter((j) => j.source === 'classic' || j.id === 'drafts');
  const pool = dictated.length ? dictated : classic.length ? classic : moodHits;
  const finalPool = pool.length
    ? pool
    : usable.filter((j) => j.moods.includes('neutral'));
  const pickFrom = finalPool.length ? finalPool : usable;
  if (!pickFrom.length) return '';
  return pick(pickFrom).line;
}

/**
 * Human-readable dump for agent polish prompts.
 * @param {JokeLine[]} bank
 * @param {string} [mood]
 */
export function formatJokeBankForPrompt(bank, mood) {
  const m = (mood || '').toLowerCase();
  const rows = bank
    .filter((j) => !m || j.moods.includes(m) || j.moods.includes('neutral'))
    .slice(0, 40);
  if (!rows.length) return '_empty joke bank_';
  return rows
    .map(
      (j) =>
        `- [${j.moods.join('|') || '?'}] (${j.id}) ${JSON.stringify(j.line)}`
    )
    .join('\n');
}
