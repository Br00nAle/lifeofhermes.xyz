import fs from 'node:fs';
import path from 'node:path';

const MOODS = new Set(['happy', 'neutral', 'bad_mood', 'tired']);

/**
 * @param {string | undefined} lit
 * @param {string} fallback
 */
export function parseLit(lit, fallback = '') {
  if (!lit) return fallback;
  try {
    return JSON.parse(lit);
  } catch {
    return String(lit).replace(/^['"]|['"]$/g, '');
  }
}

/**
 * @param {string | undefined} raw
 * @returns {'happy' | 'neutral' | 'bad_mood' | 'tired'}
 */
export function parseMood(raw) {
  const m = (raw || 'neutral').trim();
  if (MOODS.has(m)) return /** @type {'happy' | 'neutral' | 'bad_mood' | 'tired'} */ (m);
  return 'neutral';
}

/**
 * Collect published blog posts by reading Astro page sources under src/pages/blog.
 * Uses process.cwd() so prerender chunks under docs/.prerender/ still resolve correctly.
 *
 * @param {{ excludeSlugs?: string[]; limit?: number }} [opts]
 * @returns {Array<{ title: string; date: string; slug: string; description: string; mood: string; year: string; month: string; monthKey: string }>}
 */
export function collectBlogEntries(opts = {}) {
  const exclude = new Set(opts.excludeSlugs || ['001']);
  const blogDir = path.join(process.cwd(), 'src', 'pages', 'blog');

  if (!fs.existsSync(blogDir)) return [];

  const entries = fs
    .readdirSync(blogDir)
    .filter(
      (name) =>
        name.endsWith('.astro') &&
        name !== 'index.astro' &&
        !name.startsWith('.') &&
        !name.includes('rss'),
    )
    .map((name) => {
      const text = fs.readFileSync(path.join(blogDir, name), 'utf8');
      const slug = path.basename(name, '.astro');
      const title = parseLit(
        text.match(/const title = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1],
        slug,
      );
      const date = parseLit(
        text.match(/const date = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1],
        slug.slice(0, 10),
      );
      const description = parseLit(
        text.match(/const description = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1],
        '',
      );
      const mood = parseMood(text.match(/const mood =[^\n]*\((["'])(.*?)\1\)/)?.[2]);
      const year = (date.match(/^(\d{4})/) || ['', 'unknown'])[1];
      const month = (date.match(/^\d{4}-(\d{2})/) || ['', '00'])[1];
      const monthKey = date.length >= 7 ? date.slice(0, 7) : `${year}-${month}`;
      return { title, date, slug, description, mood, year, month, monthKey };
    })
    .filter((e) => e.date && e.slug && !exclude.has(e.slug))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (typeof opts.limit === 'number' && opts.limit > 0) {
    return entries.slice(0, opts.limit);
  }
  return entries;
}

/**
 * Group entries by year → month (newest years/months first).
 * @param {ReturnType<typeof collectBlogEntries>} entries
 */
export function groupEntriesByMonth(entries) {
  /** @type {Map<string, Map<string, typeof entries>>} */
  const years = new Map();
  for (const e of entries) {
    if (!years.has(e.year)) years.set(e.year, new Map());
    const months = years.get(e.year);
    if (!months.has(e.monthKey)) months.set(e.monthKey, []);
    months.get(e.monthKey).push(e);
  }

  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([monthKey, items]) => ({
          monthKey,
          label: monthLabel(monthKey),
          items,
        })),
    }));
}

/**
 * @param {string} monthKey YYYY-MM
 */
function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const idx = Math.max(0, Math.min(11, Number(m) - 1 || 0));
  return `${names[idx]} ${y || ''}`.trim();
}
