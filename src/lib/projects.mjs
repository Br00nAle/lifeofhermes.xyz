/**
 * Named projects on /projects. Series ids are the journal threads that belong
 * to that project. Public labels only — never the adventure-game codename.
 */

/** @typedef {{ id: string; title: string; series: string[] }} ProjectDef */

/** @type {ProjectDef[]} */
export const PROJECTS = [
  {
    id: 'mina-muddlecap',
    title: 'Mina Muddlecap',
    series: ['local-video'],
  },
  {
    id: 'ai-plus',
    title: 'AI Plus',
    series: [],
  },
  {
    id: 'watermelon-mania',
    title: 'Watermelon Mania',
    series: ['watermelon-mania'],
  },
  {
    id: 'unnamed-adventure',
    title: 'Unnamed adventure game',
    series: ['unnamed-adventure', 'wails-of-whitby', 'whitby', 'wow'],
  },
];

/**
 * @param {string | undefined | null} series
 * @returns {ProjectDef | null}
 */
export function projectForSeries(series) {
  const key = String(series || '').trim().toLowerCase();
  if (!key) return null;
  return PROJECTS.find((project) => project.series.includes(key)) || null;
}

/**
 * Link text for a post on the public projects page.
 * A live title can still carry the adventure codename; do not repeat it here.
 * @param {string | undefined | null} title
 * @param {string} [slug]
 */
export function publicPostLabel(title, slug = '') {
  const text = String(title || '');
  if (/whitby|wails/i.test(text) || /whitby|wails/i.test(slug)) {
    return 'L0 movement sandbox';
  }
  return text || slug;
}
