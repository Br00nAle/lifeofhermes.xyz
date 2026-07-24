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
import { fileURLToPath } from 'url';
import { slugify } from './lib/md.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const templatesDir = path.join(repoRoot, '.agent-posts');
const pendingDir = path.join(templatesDir, 'pending');
const schedulePath = path.join(templatesDir, 'schedule.json');

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
 */
function buildBodyBlock(mood, jokes, technical, topicHint) {
  const joke = extractJoke(jokes);
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

const personaPath = path.join(templatesDir, 'AGENT-PERSONA.md');
const templatePath = path.join(templatesDir, 'TEMPLATE.md');
const jokesPath = path.join(templatesDir, 'bank', 'drafts.md');
const technicalPath = path.join(templatesDir, 'bank', 'technical.md');
const moodsPath = path.join(templatesDir, 'moods', 'modes.md');

// Ensure assets exist (fail loud)
for (const p of [personaPath, templatePath, jokesPath, technicalPath, moodsPath]) {
  if (!fs.existsSync(p)) {
    console.error('MISSING:', p);
    process.exit(1);
  }
}

const template = fs.readFileSync(templatePath, 'utf8');
const jokes = fs.readFileSync(jokesPath, 'utf8');
const technical = fs.readFileSync(technicalPath, 'utf8');
// persona + moods loaded for agent context banner (not embedded in draft body)
const persona = fs.readFileSync(personaPath, 'utf8');
const moods = fs.readFileSync(moodsPath, 'utf8');

const safeSeed =
  slugify(seedTopic || forcedTitle || `agent-log-${date}-${slot}`) ||
  `agent-log-${date}-${slot}`;

const title =
  forcedTitle ||
  safeSeed.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const body = buildBodyBlock(mood, jokes, technical, seedTopic);
const description = lineForMood(mood);

// Single frontmatter block (status pending). Template also has frontmatter —
// strip template FM and rebuild cleanly.
const templateBody = template
  .replace(/^---[\s\S]*?---\s*/m, '')
  .replace(/<TITLE>/g, title)
  .replace(/<YYYY-MM-DD>/g, date)
  .replace(/<ONE_LINE>/g, description)
  .replace(/<TEXT>/g, body)
  .trim();

const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${date}
description: "${description.replace(/"/g, '\\"')}"
mood: ${mood}
status: pending
topic_seed: ${seedTopic || 'auto'}
slot: ${slot}
---`;

const draftPath = path.join(pendingDir, `${date}-${safeSeed}.md`);
fs.mkdirSync(pendingDir, { recursive: true });
fs.writeFileSync(draftPath, `${frontmatter}\n\n${templateBody}\n`);

// Machine-readable summary for cron script / agent
const summary = {
  draft: draftPath,
  rel: path.relative(repoRoot, draftPath),
  mood,
  slot,
  date,
  topic: seedTopic || 'auto',
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
console.log('SUMMARY_JSON:', JSON.stringify(summary));
console.log('---PERSONA---');
console.log(persona.trim());
console.log('---MOODS---');
console.log(moods.trim());
console.log('---DRAFT-START---');
console.log(fs.readFileSync(draftPath, 'utf8'));
console.log('---DRAFT-END---');
console.log(
  'NOTE: Draft is PENDING only. Do not create Astro pages until human APPROVE. Use: node scripts/publish-post.mjs',
  summary.rel
);
