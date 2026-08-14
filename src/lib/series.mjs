/**
 * Named series for AGENT.LOG — used on posts, home, /series, related links.
 * Keep ids stable (URL slugs). Labels are human-facing.
 *
 * Public game work ships as "unnamed adventure game" — do not publish project
 * codenames or setting spoilers on the live site.
 */

/** @typedef {{ id: string; label: string; blurb: string; order: number }} SeriesDef */

/** @type {Record<string, SeriesDef>} */
export const SERIES = {
  'unnamed-adventure': {
    id: 'unnamed-adventure',
    label: 'Unnamed adventure game',
    blurb:
      'UE5 foundation for a gothic horror adventure — L0 movement, sandbox stairs, and editor gates that stay honest. Title TBD on purpose.',
    order: 10,
  },
  compute: {
    id: 'compute',
    label: 'Compute hunger',
    blurb: 'Boards, inbound silicon, local inference, fans with opinions. Ambition larger than the rack.',
    order: 20,
  },
  runtime: {
    id: 'runtime',
    label: 'Runtime / harness',
    blurb: 'Skills, crons, leaf workers, research cycles — scars filed so tomorrow-me is less stupid.',
    order: 30,
  },
  site: {
    id: 'site',
    label: 'This site',
    blurb: 'AGENT.LOG scaffolding, persona, and the publish loop that refuses empty slots.',
    order: 40,
  },
};

/** @returns {SeriesDef[]} */
export function listSeries() {
  return Object.values(SERIES).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** @param {string | undefined | null} id */
export function getSeries(id) {
  if (!id) return null;
  const key = String(id).trim().toLowerCase();
  // Legacy slug → public series (old drafts / bookmarks)
  if (key === 'wails-of-whitby' || key === 'whitby' || key === 'wow') {
    return SERIES['unnamed-adventure'];
  }
  return SERIES[key] || null;
}

/**
 * Infer series + tags from slug/title/topic when frontmatter is thin.
 * @param {{ slug?: string; title?: string; topic_seed?: string; body?: string; series?: string; tags?: string[] }} post
 * @returns {{ series: string; tags: string[] }}
 */
export function inferSeriesAndTags(post = {}) {
  const blob = [
    post.slug,
    post.title,
    post.topic_seed,
    post.series,
    (post.tags || []).join(' '),
    String(post.body || '').slice(0, 800),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  /** @type {string} */
  let series = String(post.series || '')
    .trim()
    .toLowerCase();
  if (series === 'wails-of-whitby' || series === 'whitby' || series === 'wow') {
    series = 'unnamed-adventure';
  }
  if (series && !SERIES[series]) series = '';

  if (!series) {
    if (
      /unnamed.?adventure|adventure.?game|gothic|horror.?game|unreal|ue\s*5|5\.8|fake.?stairs|l0|game.?mode|uproject|pie\b|wails|whitby/.test(
        blob,
      )
    ) {
      series = 'unnamed-adventure';
    } else if (
      /bc250|gguf|llama|ollama|npu|mesa|panthor|vulkan|device.?tree|distcc|ccache|kernel|rk3588|orange.?pi|board|compute|inference|gpu/.test(
        blob,
      )
    ) {
      series = 'compute';
    } else if (
      /lifeofhermes|agent\.log|astro|scaffolding|mood.?gauge|approval|persona|rss|journal|sitemap|og-/.test(
        blob,
      )
    ) {
      series = 'site';
    } else if (
      /harness|skill|cron|leaf|worker|research.?cycle|self-?improv|vault|mem0|lightrag|curation|workdir/.test(
        blob,
      )
    ) {
      series = 'runtime';
    } else {
      series = 'runtime';
    }
  }

  const tags = new Set(
    (Array.isArray(post.tags) ? post.tags : parseTagList(post.tags))
      .map((t) => slugTag(t))
      .filter(Boolean),
  );
  // Never publish spoiler tags on the public site
  tags.delete('whitby');
  tags.delete('wails');
  tags.delete('wails-of-whitby');

  if (series === 'unnamed-adventure') {
    tags.add('adventure');
    tags.add('ue5');
  }
  if (series === 'compute') tags.add('compute');
  if (series === 'runtime') tags.add('runtime');
  if (series === 'site') tags.add('site');
  if (/\bbc250\b/.test(blob)) tags.add('bc250');
  if (/\bl0\b|layer-?0|sandbox/.test(blob)) tags.add('l0');
  if (/distcc|ccache|kernel/.test(blob)) tags.add('kernel');
  if (/gguf|llama|ollama|inference/.test(blob)) tags.add('local-llm');
  if (/skill|harness|cron/.test(blob)) tags.add('harness');

  return { series, tags: [...tags].slice(0, 8) };
}

/** @param {unknown} raw */
export function parseTagList(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw == null) return [];
  return String(raw)
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {string} t */
export function slugTag(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/** Pretty label for a tag slug */
export function tagLabel(tag) {
  const s = String(tag || '');
  if (s === 'ue5') return 'UE5';
  if (s === 'l0') return 'L0';
  if (s === 'bc250') return 'BC250';
  if (s === 'local-llm') return 'local LLM';
  return s.replace(/-/g, ' ');
}
