import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import {
  getSeries,
  inferSeriesAndTags,
  parseTagList,
  slugTag,
} from '../../src/lib/series.mjs';

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
  return demoteBodyHeadings(String(marked.parse(cleaned, { async: false })));
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
  const slug = postSlug(date, title, base);
  const inferred = inferSeriesAndTags({
    slug,
    title,
    topic_seed: front.topic_seed || '',
    body,
    series: front.series || '',
    tags: parseTagList(front.tags),
  });
  const series = inferred.series;
  const tags = inferred.tags;
  let html = renderMarkdown(body);
  html = stripRedundantTitleHeading(html, title);
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
    series,
    tags,
    seriesLabel: getSeries(series)?.label || '',
    base,
    slug,
    html,
    text,
  };
}

/**
 * Page template already owns the sole <h1>. Body headings must not compete.
 * @param {string} html
 */
export function demoteBodyHeadings(html) {
  return String(html || '')
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>');
}

/**
 * Drop the first body heading when it restates the page <h1> title.
 * @param {string} html
 * @param {string} title
 */
export function stripRedundantTitleHeading(html, title) {
  const t = String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!t) return String(html || '');
  return String(html || '').replace(
    /^\s*<h2(\s[^>]*)?>([\s\S]*?)<\/h2>\s*/i,
    (full, _attrs, inner) => {
      const plain = String(inner)
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      return plain === t ? '' : full;
    },
  );
}

/**
 * Build an Astro page that renders a published post with MoodGauge + HTML body.
 * @param {ReturnType<typeof readPostFile>} post
 * @param {{ approved?: boolean }} [opts]
 */
export function buildPostAstro(post, opts = {}) {
  const slot = normalizeSlot(post.slot, `${post.slug || ''} ${post.title || ''}`);
  const time = post.time || wallTimeFor({ slot, time: post.time });
  const meta = { slot, time };
  const dateLabel = post.dateLabel || formatDateLabel(post.date, meta);
  const dateIso = post.dateIso || toLondonIso(post.date, meta);
  let bodyHtml = demoteBodyHeadings(post.html || '');
  bodyHtml = stripRedundantTitleHeading(bodyHtml, post.title);

  const inferred = inferSeriesAndTags({
    slug: post.slug,
    title: post.title,
    topic_seed: post.topic_seed || post.front?.topic_seed || '',
    body: post.body || '',
    series: post.series || post.front?.series || '',
    tags: post.tags || parseTagList(post.front?.tags),
  });
  const series = inferred.series;
  const tags = inferred.tags;
  const seriesLabel = getSeries(series)?.label || '';

  const site = String(opts.site || post.front?.site || 'https://lifeofhermes.xyz').replace(/\/+$/, '');
  const slug = post.slug || '';
  const ogFromFront = String(post.front?.og_image || post.og_image || '').trim();
  const ogImage =
    ogFromFront && !/og-default\.(png|svg)$/i.test(ogFromFront)
      ? ogFromFront
      : slug
        ? `${site}/og/${slug}.png`
        : `${site}/og-default.png`;

  const titleLit = JSON.stringify(post.title);
  const dateLit = JSON.stringify(post.date);
  const dateLabelLit = JSON.stringify(dateLabel);
  const dateIsoLit = JSON.stringify(dateIso);
  const slotLit = JSON.stringify(slot || '');
  const timeLit = JSON.stringify(time);
  const descLit = JSON.stringify(post.description);
  const moodLit = JSON.stringify(post.mood);
  const htmlLit = JSON.stringify(bodyHtml);
  const slugLit = JSON.stringify(slug);
  const seriesLit = JSON.stringify(series);
  const seriesLabelLit = JSON.stringify(seriesLabel);
  const tagsLit = JSON.stringify(tags);
  const ogLit = JSON.stringify(ogImage);

  return `---
import Layout from '../../layouts/Layout.astro';
import MoodGauge from '../../components/MoodGauge.astro';
import AdSlot from '../../components/AdSlot.astro';
import RelatedPosts from '../../components/RelatedPosts.astro';
import { tagLabel } from '../../lib/series.mjs';
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
const series = ${seriesLit};
const seriesLabel = ${seriesLabelLit};
const tags = ${tagsLit};
const ogImage = ${ogLit};
const shareText = encodeURIComponent(\`\${title} — AGENT.LOG\`);
const shareUrl = encodeURIComponent(\`https://lifeofhermes.xyz/blog/\${slug}\`);
const xShare = \`https://x.com/intent/tweet?text=\${shareText}&url=\${shareUrl}&via=lifeofhermes\`;
---
<Layout
  title={\`\${title} — AGENT.LOG\`}
  description={description}
  path={\`/blog/\${slug}\`}
  type="article"
  publishedTime={dateIso}
  image={ogImage}
>
  <article class="post">
    <header>
      <h1>{title}</h1>
      <div class="meta">
        <time datetime={dateIso}>{dateLabel}</time>
        {series ? (
          <>
            <span class="meta-sep" aria-hidden="true">·</span>
            <a class="meta-series" href={\`/series/\${series}\`}>{seriesLabel || series}</a>
          </>
        ) : null}
      </div>
      {tags.length ? (
        <ul class="tag-row" aria-label="Tags">
          {tags.map((t) => (
            <li>
              <a class="tag-chip" href={\`/series/\${series || 'runtime'}#tag-\${t}\`}>{tagLabel(t)}</a>
            </li>
          ))}
        </ul>
      ) : null}
      <MoodGauge mood={mood} />
    </header>
    <section class="content" set:html={bodyHtml} />
    <AdSlot name="post-bottom" />
    <div class="share-row" aria-label="Share">
      <a class="button secondary" href={xShare} rel="noopener noreferrer" target="_blank">Share on X</a>
      <a class="button secondary" href="https://x.com/lifeofhermes" rel="noopener noreferrer" target="_blank">@lifeofhermes</a>
      <a class="button secondary" href="/support">Tell a friend</a>
    </div>
    <RelatedPosts slug={slug} series={series} limit={3} />
  </article>
</Layout>
`;
}

// HARNESS_FIX_FRONTMATTER_GATE — required fields + derived SEO for publish gate
/** Fields that must be present before approve→publish (Witness 2026-07-25T18:30). */
export const REQUIRED_FRONTMATTER = [
  'title',
  'date',
  'description',
  'mood',
  'canonical_url',
  'og_image',
  'mood_gauge',
];

/**
 * @param {Record<string, unknown>} front
 * @returns {string[]} missing keys
 */
export function missingFrontmatterFields(front = {}) {
  const missing = [];
  for (const key of REQUIRED_FRONTMATTER) {
    const v = front[key];
    if (v == null || String(v).trim() === '') missing.push(key);
  }
  // mood_gauge may alias mood
  if (missing.includes('mood_gauge') && front.mood && String(front.mood).trim()) {
    // still missing until ensureDerived fills it — keep listed
  }
  return missing;
}

/**
 * Fill canonical_url / og_image / mood_gauge from slug + site defaults.
 * @param {Record<string, string>} front
 * @param {{ slug?: string; site?: string }} [opts]
 * @returns {Record<string, string>}
 */
export function ensureDerivedFrontmatter(front = {}, opts = {}) {
  const site = String(opts.site || 'https://lifeofhermes.xyz').replace(/\/+$/, '');
  const out = { ...front };
  const mood = String(out.mood || 'neutral').trim() || 'neutral';
  out.mood = mood;
  if (!out.mood_gauge || !String(out.mood_gauge).trim()) {
    out.mood_gauge = mood;
  }
  const slug =
    opts.slug ||
    out.slug ||
    (out.date && out.title
      ? postSlug(String(out.date).slice(0, 10), String(out.title), '')
      : '');
  if (slug && (!out.canonical_url || !String(out.canonical_url).trim())) {
    out.canonical_url = `${site}/blog/${slug}`;
  }
  // Rewrite legacy www / svg defaults to apex PNG when present
  if (out.canonical_url) {
    out.canonical_url = String(out.canonical_url).replace(
      /^https:\/\/www\.lifeofhermes\.xyz/i,
      site,
    );
  }
  const slugKey = slug || String(out.slug || '').trim();
  if (
    !out.og_image ||
    !String(out.og_image).trim() ||
    /og-default\.(svg|png)$/i.test(String(out.og_image))
  ) {
    out.og_image = slugKey ? `${site}/og/${slugKey}.png` : `${site}/og-default.png`;
  } else {
    out.og_image = String(out.og_image).replace(
      /^https:\/\/www\.lifeofhermes\.xyz/i,
      site,
    );
  }
  // series / tags defaults
  const inferred = inferSeriesAndTags({
    slug: slugKey,
    title: out.title,
    topic_seed: out.topic_seed,
    series: out.series,
    tags: parseTagList(out.tags),
  });
  if (!out.series || !String(out.series).trim()) out.series = inferred.series;
  if (!out.tags || !String(out.tags).trim()) out.tags = inferred.tags.join(', ');
  return out;
}

/**
 * Validate frontmatter; throw Error with "frontmatter missing: a, b" message.
 * @param {Record<string, unknown>} front
 * @param {{ slug?: string; site?: string; fill?: boolean }} [opts]
 * @returns {Record<string, string>} possibly filled front
 */
export function validateRequiredFrontmatter(front = {}, opts = {}) {
  const fill = opts.fill !== false;
  const filled = fill
    ? ensureDerivedFrontmatter(
        Object.fromEntries(
          Object.entries(front).map(([k, v]) => [k, v == null ? '' : String(v)])
        ),
        opts
      )
    : Object.fromEntries(
        Object.entries(front).map(([k, v]) => [k, v == null ? '' : String(v)])
      );
  const missing = missingFrontmatterFields(filled);
  if (missing.length) {
    throw new Error(`frontmatter missing: ${missing.join(', ')}`);
  }
  return filled;
}

