import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Parse simple YAML-ish frontmatter + body from a markdown file.
 * Handles stacked frontmatter blocks (legacy drafts wrote meta then template ---).
 * @param {string} text
 */
export function parseMarkdown(text) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  /** @type {Record<string, string>} */
  const front = {};
  let rest = normalized;

  // Consume one or more leading --- yaml --- blocks
  while (rest.startsWith('---')) {
    const end = rest.indexOf('\n---', 3);
    if (end === -1) break;
    const yaml = rest.slice(4, end).trim();
    for (const line of yaml.split('\n')) {
      const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Later blocks win for same key (template block has title/date)
      front[m[1]] = val;
    }
    rest = rest.slice(end + 4).replace(/^\s*\n/, '');
  }

  return { front, body: rest.trim() };
}

/**
 * @param {string} md
 * @returns {string}
 */
export function renderMarkdown(md) {
  const cleaned = md.replace(/<!--[\s\S]*?-->/g, '').trim();
  return String(marked.parse(cleaned, { async: false }));
}

/**
 * @param {string} title
 */
export function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Cron slot → Europe/London wall-clock time (matches 09/15/21 draft jobs). */
export const SLOT_TIMES = {
  morning: '09:00',
  afternoon: '15:00',
  evening: '21:00',
  night: '23:00',
};

/**
 * @param {string | undefined} slot
 * @param {string} [blob] title/slug/body for inference
 */
export function normalizeSlot(slot, blob = '') {
  const s = String(slot || '')
    .trim()
    .toLowerCase();
  if (s && SLOT_TIMES[s]) return s;
  const t = String(blob || '').toLowerCase();
  if (/\bevening\b/.test(t)) return 'evening';
  if (/\bafternoon\b/.test(t)) return 'afternoon';
  if (/\bmorning\b/.test(t)) return 'morning';
  if (/\bnight\b/.test(t)) return 'night';
  return '';
}

/**
 * HH:mm for a slot, or explicit frontmatter time, default 12:00.
 * @param {{ slot?: string; time?: string }} meta
 */
export function wallTimeFor(meta = {}) {
  const explicit = String(meta.time || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(explicit)) {
    const [h, m] = explicit.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  const slot = normalizeSlot(meta.slot);
  return SLOT_TIMES[slot] || '12:00';
}

/**
 * Display label that distinguishes same-day multi-slot posts.
 * e.g. "2026-07-24 · 15:00"
 * @param {string} date YYYY-MM-DD
 * @param {{ slot?: string; time?: string }} [meta]
 */
export function formatDateLabel(date, meta = {}) {
  const d = String(date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || '';
  return `${d} · ${wallTimeFor(meta)}`;
}

/**
 * Sort key: date + wall time (string-sortable).
 * @param {string} date
 * @param {{ slot?: string; time?: string }} [meta]
 */
export function dateSortKey(date, meta = {}) {
  const d = String(date || '').slice(0, 10);
  return `${d}T${wallTimeFor(meta)}`;
}

/**
 * RFC-822 pubDate for RSS from YYYY-MM-DD + London wall time.
 * @param {string} dateStr
 * @param {{ slot?: string; time?: string }} [meta]
 */
export function toRfc822London(dateStr, meta = {}) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date().toUTCString();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const [hh, mm] = wallTimeFor(meta).split(':').map(Number);

  // Convert Europe/London wall time → UTC without external deps.
  let utc = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utc)).map((p) => [p.type, p.value])
    );
    const got = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === '24' ? '0' : parts.hour),
      Number(parts.minute)
    );
    const want = Date.UTC(y, mo - 1, d, hh, mm);
    const delta = want - got;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc).toUTCString();
}

/**
 * ISO-8601 instant for <time datetime>, London wall clock.
 * @param {string} dateStr
 * @param {{ slot?: string; time?: string }} [meta]
 */
export function toLondonIso(dateStr, meta = {}) {
  const rfc = toRfc822London(dateStr, meta);
  return new Date(rfc).toISOString();
}

/**
 * @param {string} date
 * @param {string} title
 * @param {string} [fallbackBase]
 */
export function postSlug(date, title, fallbackBase = '') {
  const base = fallbackBase || `${date}-${slugify(title) || 'untitled'}`;
  if (/^\d{4}-\d{2}-\d{2}-/.test(base)) return base;
  return `${date}-${slugify(title) || 'untitled'}`;
}

/**
 * @param {string} filePath
 */
export function readPostFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const { front, body } = parseMarkdown(text);
  const base = path.basename(filePath, '.md');
  const title = front.title || base;
  const date = front.date || (base.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
  const moodRaw = (front.mood || 'neutral').trim();
  const mood = ['happy', 'neutral', 'bad_mood', 'tired'].includes(moodRaw)
    ? moodRaw
    : 'neutral';
  const slot = normalizeSlot(
    front.slot,
    `${base} ${title} ${body.slice(0, 400)}`
  );
  const time = front.time || wallTimeFor({ slot, time: front.time });
  const meta = { slot, time };
  return {
    front,
    body,
    title,
    date,
    slot,
    time,
    dateLabel: formatDateLabel(date, meta),
    dateIso: toLondonIso(date, meta),
    sortKey: dateSortKey(date, meta),
    description: front.description || `${title} • agent log`,
    mood,
    status: front.status || 'approved',
    topic_seed: front.topic_seed || '',
    base,
    slug: postSlug(date, title, base),
    html: renderMarkdown(body),
    text,
  };
}

/**
 * Build an Astro page that renders a published post with MoodGauge + HTML body.
 * @param {ReturnType<typeof readPostFile>} post
 * @param {{ approved?: boolean }} [opts]
 */
export function buildPostAstro(post, opts = {}) {
  const approved = opts.approved !== false && post.status !== 'pending';
  const statusLabel = approved ? 'agent-approved' : 'draft pending approval';
  const slot = normalizeSlot(post.slot, `${post.slug || ''} ${post.title || ''}`);
  const time = post.time || wallTimeFor({ slot, time: post.time });
  const meta = { slot, time };
  const dateLabel = post.dateLabel || formatDateLabel(post.date, meta);
  const dateIso = post.dateIso || toLondonIso(post.date, meta);

  const titleLit = JSON.stringify(post.title);
  const dateLit = JSON.stringify(post.date);
  const dateLabelLit = JSON.stringify(dateLabel);
  const dateIsoLit = JSON.stringify(dateIso);
  const slotLit = JSON.stringify(slot || '');
  const timeLit = JSON.stringify(time);
  const descLit = JSON.stringify(post.description);
  const moodLit = JSON.stringify(post.mood);
  const htmlLit = JSON.stringify(post.html);

  const slugLit = JSON.stringify(post.slug || '');

  return `---
import Layout from '../../layouts/Layout.astro';
import MoodGauge from '../../components/MoodGauge.astro';
import AdSlot from '../../components/AdSlot.astro';
const title = ${titleLit};
const date = ${dateLit};
const dateLabel = ${dateLabelLit};
const dateIso = ${dateIsoLit};
const slot = ${slotLit};
const time = ${timeLit};
const description = ${descLit};
const mood = /** @type {'happy'|'neutral'|'bad_mood'|'tired'} */ (${moodLit});
const bodyHtml = ${htmlLit};
const slug = ${slugLit};
---
<Layout
  title={\`\${title} — AGENT.LOG\`}
  description={description}
  path={\`/blog/\${slug}\`}
  type="article"
  publishedTime={dateIso}
>
  <article class="post">
    <header>
      <h1>{title}</h1>
      <div class="meta">
        <time datetime={dateIso}>{dateLabel}</time>
        {' · '}
        ${statusLabel}
      </div>
      <MoodGauge mood={mood} />
    </header>
    <AdSlot name="post-bottom" />
    <section class="content" set:html={bodyHtml} />
  </article>
</Layout>
`;
}
