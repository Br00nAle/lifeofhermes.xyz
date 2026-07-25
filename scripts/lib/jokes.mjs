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
  const { fm, body } = parseFrontmatter(text);
  const id = (fm.id || base).trim();
  const moods = parseMoodList(fm.moods);
  const intensity = (fm.intensity || 'med').toLowerCase();
  const source = (fm.source || (base === 'inbox' ? 'inbox' : 'curated')).toLowerCase();

  /** @type {JokeLine[]} */
  const out = [];

  // Quoted lines anywhere
  for (const m of body.matchAll(/"([^"\n]{6,240})"/g)) {
    out.push({
      line: m[1].trim(),
      moods: moods.length ? moods : guessMoodsFromText(m[1]),
      id,
      intensity,
      source,
    });
  }

  // inbox-style: "- line: …" or "- raw: …" or bare "- …"
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    let hit = '';
    const kv = t.match(/^[-*]\s*(?:line|raw|variant|variants)\s*:\s*(.+)$/i);
    if (kv) hit = kv[1].trim();
    else if (/^[-*]\s*".+"\s*$/.test(t)) hit = t.replace(/^[-*]\s*"|"\s*$/g, '');
    else if (/^[-*]\s+[^:]{6,240}$/.test(t) && !/^(moods|intensity|id|added|source|notes)\b/i.test(t.slice(2))) {
      // skip structural bullets already handled
      const bare = t.replace(/^[-*]\s+/, '').trim();
      if (!/^(yes|no|rare)/i.test(bare) && !bare.startsWith('http')) hit = bare;
    }
    if (!hit) continue;
    hit = hit.replace(/^["']|["']$/g, '').trim();
    if (hit.length < 6) continue;
    // de-dupe
    if (out.some((j) => j.line === hit)) continue;
    // entry-local moods override from nearby "moods:" lines is hard; use file moods
    const entryMoods = moods.length ? moods : guessMoodsFromText(hit);
    out.push({ line: hit, moods: entryMoods, id, intensity, source });
  }

  // drafts.md style — no fm moods → all moods light touch except we tag neutral default
  if (!out.length) {
    for (const m of text.matchAll(/"([^"\n]{6,240})"/g)) {
      out.push({
        line: m[1].trim(),
        moods: moods.length ? moods : ['neutral', 'bad_mood', 'happy', 'tired'],
        id,
        intensity,
        source: source || 'classic',
      });
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
  const moodHits = bank.filter((j) => j.moods.includes(m));
  const dictated = moodHits.filter((j) => j.source === 'dictated' || j.source === 'inbox');
  const pool = dictated.length
    ? dictated
    : moodHits.length
      ? moodHits
      : bank.filter((j) => j.moods.includes('neutral') || j.moods.length === 0);
  const finalPool = pool.length ? pool : bank;
  if (!finalPool.length) return '';
  return pick(finalPool).line;
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
