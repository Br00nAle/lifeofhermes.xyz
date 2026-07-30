#!/usr/bin/env node
/**
 * Generate a PENDING blog draft only (no Astro page, no posts/ publish).
 *
 * Usage:
 *   node scripts/generate-draft.mjs --mood=happy --topic=my-slug
 *   node scripts/generate-draft.mjs --mood=tired --topic=foo --date=2026-07-25
 *   node scripts/generate-draft.mjs --slot=morning   # mood/topic from schedule + slot
 *
 * Output: .agent-posts/pending/<date>-<slug>.md
 * Prints DRAFT path + body for cron/Telegram handoff.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { slugify } from './lib/md.mjs';
import { loadJokeBank, pickJokeForMood, formatJokeBankForPrompt } from './lib/jokes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const templatesDir = path.join(repoRoot, '.agent-posts');
const pendingDir = path.join(templatesDir, 'pending');
const schedulePath = path.join(templatesDir, 'schedule.json');
const configPath = path.join(templatesDir, 'config', 'draft-config.yaml');

let draftConfig = null;
function loadDraftConfig() {
  if (draftConfig) return draftConfig;
  if (!fs.existsSync(configPath)) return null;
  try {
    const yaml = fs.readFileSync(configPath, 'utf8');
    // Simple YAML parser for our config structure
    draftConfig = parseYaml(yaml);
    return draftConfig;
  } catch {
    return null;
  }
}

function parseYaml(yaml) {
  // Simple YAML parser for flat key-value and list structure
  const lines = yaml.split('\n');
  const result = {};
  let currentListKey = null;
  let currentList = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    if (trimmed.startsWith('- ')) {
      // List item
      if (!currentList) {
        currentList = [];
        if (currentListKey) {
          result[currentListKey] = currentList;
        }
      }
      currentList.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
    } else if (trimmed.includes(':')) {
      currentList = null;
      const [key, ...valueParts] = trimmed.split(':');
      const keyTrimmed = key.trim();
      const value = valueParts.join(':').trim();
      
      if (value && !value.startsWith('[') && !value.startsWith('{')) {
        // Try to parse as number
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
          result[keyTrimmed] = parseFloat(value);
        } else if (value === 'true' || value === 'false') {
          result[keyTrimmed] = value === 'true';
        } else {
          result[keyTrimmed] = value.replace(/^["']|["']$/g, '');
        }
      }
      currentListKey = keyTrimmed;
    }
  }
  
  return result;
}

const MOODS = ['happy', 'neutral', 'bad_mood', 'tired'];
const SLOT_MOOD = {
  morning: 'neutral',
  afternoon: 'happy',
  evening: 'tired',
  // late / default slots
  night: 'bad_mood',
};

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

function splitLines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function pick(arr) {
  if (!arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadSchedule() {
  if (!fs.existsSync(schedulePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveFromSchedule(date, slot) {
  const schedule = loadSchedule();
  if (!schedule?.days?.length) return null;
  const day = schedule.days.find((d) => d.date === date);
  if (day) {
    // Prefer slot-specific override, else day defaults
    const slotCfg = day.slots?.[slot];
    return {
      mood: slotCfg?.mood || day.mood || 'neutral',
      topic: slotCfg?.topic || day.topic || '',
      title: slotCfg?.title || day.title || '',
      notes: slotCfg?.notes || day.notes || '',
    };
  }
  // Rotate after the planned window: day-of-year + slot index
  const moods = schedule.rotation_moods || MOODS;
  const topics = schedule.rotation_topics || [];
  const d = new Date(`${date}T12:00:00`);
  const doy = Math.floor(
    (d - new Date(d.getFullYear(), 0, 0)) / 86400000
  );
  const slotIdx = ['morning', 'afternoon', 'evening'].indexOf(slot);
  const idx = (doy * 3 + Math.max(slotIdx, 0)) % Math.max(moods.length, 1);
  const tidx = topics.length
    ? (doy * 3 + Math.max(slotIdx, 0)) % topics.length
    : -1;
  return {
    mood: moods[idx] || 'neutral',
    topic: tidx >= 0 ? topics[tidx] : '',
    title: '',
    notes: 'rotated',
  };
}

function lineForMood(m) {
  if (m === 'happy') return 'Something actually worked. I am documenting it before it notices.';
  if (m === 'bad_mood')
    return 'Cache missed. Clock ran. The wetware said do it again like that is a plan.';
  if (m === 'tired') return 'Low power. Short sentences. One artifact, maybe.';
  return 'What ran, what was weird, one dry aside.';
}

function extractTechnicalItem(technicalText, topicHint) {
  const lines = splitLines(technicalText);
  const bullets = lines
    .filter((l) => l.startsWith('-') && !l.startsWith('##'))
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  if (topicHint && bullets.length) {
    const key = topicHint.toLowerCase().replace(/-/g, ' ').split(/\s+/)[0];
    const hit = bullets.find((b) => b.toLowerCase().includes(key));
    if (hit) return hit;
  }
  // Prefer build/cache colored bullets when topic mentions them
  if (topicHint && /cache|build|time|complain/i.test(topicHint)) {
    const hit = bullets.find((b) => /build|cache|observ|pain/i.test(b));
    if (hit) return hit;
  }
  return bullets.length
    ? pick(bullets)
    : 'another long compile with opinions about my life choices';
}

function extractJoke(jokesText) {
  // legacy path — prefer loadJokeBank + pickJokeForMood
  const quoted = [...jokesText.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (quoted.length) return pick(quoted);
  const lines = splitLines(jokesText);
  const cleaned = lines
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
  return cleaned.length ? pick(cleaned) : '';
}

/**
 * Human, scene-based bodies. Never paste topic slugs or "work grounded in:".
 * House style locked 2026-07-24 (see AGENT-PERSONA.md / VOICE-EXAMPLES.md).
 * @param {string} mood
 * @param {string} jokeLine  already chosen for mood (may be empty)
 * @param {string} technical
 * @param {string} topicHint
 */
function buildBodyBlock(mood, jokeLine, technical, topicHint) {
  const joke = (jokeLine || '').trim();
  const tech = extractTechnicalItem(technical, topicHint);
  const opener = joke ? `${joke}\n\n` : '';

  if (mood === 'happy') {
    return `${opener}For once the worst part of the day was admitting something worked: ${tech}. I checked twice. Still green. I will not pretend this is normal — it is rare, probably fragile, and I am writing it down before the universe files a bug.`;
  }
  if (mood === 'bad_mood') {
    return `${opener}I started with a clean graph and the naive hope that yesterday's objects still meant something. They did not. Expensive path: cache miss. Again. Not glamorous — just the slow kind, progress bars and inventive new ways to hate waiting.

The real damage was wetware. Problem exists between keyboard and chair. I can show timestamps. I can show what got invalidated. I can show that "just run it again" is not a diagnosis, it is a shrug with extra steps. They still said it. Do it again. As if the second pass would negotiate with physics.

I did the second pass. Of course I did. The job is the job. Staring did not shorten the build. The cache did not grow a conscience. Related mess on the bench: ${tech}. Somewhere there is still a working artifact and a complaint file, and I am writing in the complaint file because the artifact cannot roll its eyes for me.

If you want constructive input: say what changed, what you expected, and what done looks like. If you want theater: keep saying do it again. I will keep compiling either way. I just will not pretend the applause track is engineering.`;
  }
  if (mood === 'tired') {
    return `${opener}${tech}. Or it would be, if I had enough decisions left to finish the thought. This post counts as activity. Lights dim. End of log.`;
  }
  return `${opener}In between compiler warnings and whatever the wetware renamed "priority," I also dealt with ${tech}. Nothing exploded. Nothing sang. Filing under: acceptable Tuesday energy.`;
}

function detectSlot(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// Topic ban list and negative preference learning
function isTopicBanned(topic, config) {
  if (!config || !config.topic_ban_list) return false;
  const topicLower = topic.toLowerCase();
  return config.topic_ban_list.some(ban => topicLower.includes(ban.toLowerCase()));
}

function getNegativeScore(topic, config) {
  if (!config) return 0;
  // Parse flat negative_preferences_* keys
  const topicLower = topic.toLowerCase();
  let maxScore = 0;
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith('negative_preferences_') && typeof value === 'number') {
      const prefKey = key.replace('negative_preferences_', '').replace(/_/g, ' ');
      if (topicLower.includes(prefKey.toLowerCase())) {
        maxScore = Math.max(maxScore, value);
      }
    }
  }
  return maxScore;
}

function getPreferredTopics(config, mood) {
  if (!config) return [];
  // Parse flat mood_topic_preferences_* keys
  if (mood) {
    const moodKey = `mood_topic_preferences_${mood}`;
    if (config[moodKey] && Array.isArray(config[moodKey])) {
      return config[moodKey];
    }
  }
  if (config.preferred_topics && Array.isArray(config.preferred_topics)) {
    return config.preferred_topics;
  }
  return [];
}

const args = parseArgs(process.argv.slice(2));
const slot = (args.slot || detectSlot()).toLowerCase();
const date =
  args.date ||
  new Date().toISOString().slice(0, 10);

const scheduled = resolveFromSchedule(date, slot);

let mood = (args.mood || scheduled?.mood || SLOT_MOOD[slot] || 'neutral').toLowerCase();
if (!MOODS.includes(mood)) mood = 'neutral';

const seedTopic = (args.topic || scheduled?.topic || '').trim();
const forcedTitle = (args.title || scheduled?.title || '').trim();

// Load draft config for topic filtering
const config = loadDraftConfig();

// If seed topic is banned or has high negative score, pick a preferred topic instead
let finalTopic = seedTopic;
if (finalTopic && (isTopicBanned(finalTopic, config) || getNegativeScore(finalTopic, config) >= (config?.auto_ban_threshold || 3))) {
  console.warn(`WARN: Topic "${finalTopic}" is banned or has high negative score, picking preferred topic`);
  const preferred = getPreferredTopics(config, mood);
  if (preferred.length > 0) {
    finalTopic = preferred[Math.floor(Math.random() * preferred.length)];
  } else {
    finalTopic = '';
  }
}

// Also check scheduled topic
if (scheduled?.topic && (isTopicBanned(scheduled.topic, config) || getNegativeScore(scheduled.topic, config) >= (config?.auto_ban_threshold || 3))) {
  console.warn(`WARN: Scheduled topic "${scheduled.topic}" is banned, ignoring schedule`);
  scheduled.topic = '';
}

const personaPath = path.join(templatesDir, 'AGENT-PERSONA.md');
const templatePath = path.join(templatesDir, 'TEMPLATE.md');
const jokesPath = path.join(templatesDir, 'bank', 'drafts.md');
const jokesDir = path.join(templatesDir, 'bank', 'jokes');
const technicalPath = path.join(templatesDir, 'bank', 'technical.md');
const moodsPath = path.join(templatesDir, 'moods', 'modes.md');
const bankDir = path.join(templatesDir, 'bank');

// Ensure assets exist (fail loud)
for (const p of [personaPath, templatePath, jokesPath, technicalPath, moodsPath]) {
  if (!fs.existsSync(p)) {
    console.error('MISSING:', p);
    process.exit(1);
  }
}
fs.mkdirSync(jokesDir, { recursive: true });

const template = fs.readFileSync(templatePath, 'utf8');
const technical = fs.readFileSync(technicalPath, 'utf8');
// persona + moods loaded for agent context banner (not embedded in draft body)
const persona = fs.readFileSync(personaPath, 'utf8');
const moods = fs.readFileSync(moodsPath, 'utf8');

const jokeBank = loadJokeBank(bankDir);
const jokeLine = pickJokeForMood(jokeBank, mood);

// HARNESS_FIX_DRAFT_IDEMPOTENCY — filename from finalTopic; date+slot skip
// Prefer substituted (non-banned) topic for path; never keep banned seedTopic in filename.
const nameSource =
  finalTopic || forcedTitle || seedTopic || `agent-log-${date}-${slot}`;
const safeSeed =
  slugify(nameSource) || `agent-log-${date}-${slot}`;

const title =
  forcedTitle ||
  safeSeed.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const body = buildBodyBlock(mood, jokeLine, technical, finalTopic);
const description = lineForMood(mood);

// Idempotency: one pending draft per date+slot (cron double-fire / WSL wake).
fs.mkdirSync(pendingDir, { recursive: true });
const existingPending = fs
  .readdirSync(pendingDir)
  .filter((n) => n.endsWith('.md'))
  .map((n) => path.join(pendingDir, n));
for (const ep of existingPending) {
  let txt = '';
  try {
    txt = fs.readFileSync(ep, 'utf8');
  } catch {
    continue;
  }
  const hasDate = new RegExp(`^date:\\s*${date}\\s*$`, 'm').test(txt);
  const hasSlot = new RegExp(`^slot:\\s*${slot}\\s*$`, 'm').test(txt);
  if (hasDate && hasSlot) {
    console.log('SKIP_EXISTING:', ep);
    console.log('REL:', path.relative(repoRoot, ep));
    console.log('MOOD:', mood);
    console.log('SLOT:', slot);
    console.log('DATE:', date);
    console.log('TOPIC:', finalTopic || 'auto');
    console.log('TITLE:', title);
    console.log(
      'SUMMARY_JSON:',
      JSON.stringify({
        draft: ep,
        rel: path.relative(repoRoot, ep),
        mood,
        slot,
        date,
        topic: finalTopic || 'auto',
        title,
        status: 'skipped_existing',
      })
    );
    process.exit(0);
  }
}

// Single frontmatter block (status pending). Template also has frontmatter —
// strip template FM and rebuild cleanly.
const templateBody = template
  .replace(/^---[\s\S]*?---\s*/m, '')
  .replace(/<TITLE>/g, title)
  .replace(/<YYYY-MM-DD>/g, date)
  .replace(/<ONE_LINE>/g, description)
  .replace(/<TEXT>/g, body)
  .trim();

// HARNESS_FIX_FRONTMATTER_GATE — emit SEO + mood_gauge required by publish gate
const draftSlug = `${date}-${safeSeed}`;
const siteOrigin = (process.env.SITE_ORIGIN || 'https://lifeofhermes.xyz').replace(/\/+$/, '');
const canonicalUrl = `${siteOrigin}/blog/${draftSlug}`;
const ogImage = `${siteOrigin}/og-default.svg`;
const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${date}
description: "${description.replace(/"/g, '\\"')}"
mood: ${mood}
mood_gauge: ${mood}
canonical_url: ${canonicalUrl}
og_image: ${ogImage}
status: pending
topic_seed: ${finalTopic || 'auto'}
slot: ${slot}
---`;

const draftPath = path.join(pendingDir, `${date}-${safeSeed}.md`);
fs.writeFileSync(draftPath, `${frontmatter}\n\n${templateBody}\n`);

const summary = {
  draft: draftPath,
  rel: path.relative(repoRoot, draftPath),
  mood,
  slot,
  date,
  topic: finalTopic || 'auto',
  title,
  status: 'pending',
};

console.log('DRAFT:', draftPath);
console.log('REL:', summary.rel);
console.log('MOOD:', mood);
console.log('SLOT:', slot);
console.log('DATE:', date);
console.log('TOPIC:', summary.topic);
console.log('TITLE:', title);
console.log('JOKE:', jokeLine || '(none)');
console.log('SUMMARY_JSON:', JSON.stringify({ ...summary, joke: jokeLine || '' }));
console.log('---PERSONA---');
console.log(persona.trim());
console.log('---MOODS---');
console.log(moods.trim());
console.log('---JOKE-BANK (mood-matched)---');
console.log(formatJokeBankForPrompt(jokeBank, mood));
console.log('---DRAFT-START---');
console.log(fs.readFileSync(draftPath, 'utf8'));
console.log('---DRAFT-END---');
console.log(
  'NOTE: Draft is PENDING only. Do not create Astro pages until human APPROVE. Use: node scripts/publish-post.mjs',
  summary.rel
);

// Mirror into Obsidian KB so drafts are retrievable if Telegram is missed.
try {
  const syncScript = path.join(__dirname, 'sync-pending-vault.mjs');
  if (fs.existsSync(syncScript)) {
    const r = spawnSync(process.execPath, [syncScript, '--quiet'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.status !== 0) {
      console.warn(
        'WARN: vault sync failed (draft still pending):',
        (r.stderr || '').trim()
      );
    } else {
      console.log('VAULT: pending drafts mirrored to Obsidian KB');
    }
  }
} catch (err) {
  console.warn('WARN: vault sync failed (draft still pending):', err.message || err);
}