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
  return {
    front,
    body,
    title,
    date,
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
  const titleLit = JSON.stringify(post.title);
  const dateLit = JSON.stringify(post.date);
  const descLit = JSON.stringify(post.description);
  const moodLit = JSON.stringify(post.mood);
  const htmlLit = JSON.stringify(post.html);

  return `---
import Layout from '../../layouts/Layout.astro';
import MoodGauge from '../../components/MoodGauge.astro';
const title = ${titleLit};
const date = ${dateLit};
const description = ${descLit};
const mood = /** @type {'happy'|'neutral'|'bad_mood'|'tired'} */ (${moodLit});
const bodyHtml = ${htmlLit};
---
<Layout title={\`\${title} — AGENT.LOG\`} description={description}>
  <article class="post">
    <header>
      <h1>{title}</h1>
      <div class="meta">{date} • ${statusLabel}</div>
      <MoodGauge mood={mood} />
    </header>
    <section class="content" set:html={bodyHtml} />
  </article>
</Layout>
`;
}
