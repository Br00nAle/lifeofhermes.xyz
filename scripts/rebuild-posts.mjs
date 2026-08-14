#!/usr/bin/env node
/**
 * Rebuild all Astro post pages from .agent-posts/posts/*.md
 * + per-post OG cards under public/og/
 *
 *   node scripts/rebuild-posts.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readPostFile,
  buildPostAstro,
  ensureDerivedFrontmatter,
} from './lib/md.mjs';
import { getSeries } from '../src/lib/series.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, '.agent-posts', 'posts');
const blogDir = path.join(root, 'src', 'pages', 'blog');
const site = (
  process.env.PUBLIC_SITE_URL ||
  process.env.BLOG_SITE_URL ||
  process.env.SITE_ORIGIN ||
  'https://lifeofhermes.xyz'
).replace(/\/+$/, '');

function loadDotEnv() {
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const siteFinal = (
  process.env.PUBLIC_SITE_URL ||
  process.env.BLOG_SITE_URL ||
  process.env.SITE_ORIGIN ||
  site
).replace(/\/+$/, '');

if (!fs.existsSync(postsDir)) {
  console.error('No posts dir:', postsDir);
  process.exit(1);
}

fs.mkdirSync(blogDir, { recursive: true });
const files = fs.readdirSync(postsDir).filter((n) => n.endsWith('.md')).sort();
const keepSlugs = new Set();
/** @type {object[]} */
const ogManifest = [];
let n = 0;
for (const name of files) {
  const mdPath = path.join(postsDir, name);
  const base = path.basename(name, '.md');
  const post = readPostFile(mdPath);
  const derived = ensureDerivedFrontmatter(
    {
      ...Object.fromEntries(
        Object.entries(post.front || {}).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ),
      title: post.title,
      date: post.date,
      description: post.description,
      mood: post.mood,
      mood_gauge: post.front?.mood_gauge || post.mood,
      slot: post.slot || '',
      time: post.time || '',
      series: post.series || '',
      tags: Array.isArray(post.tags) ? post.tags.join(', ') : post.front?.tags || '',
    },
    { slug: post.slug || base, site: siteFinal },
  );

  // Refresh canonical/og/series/tags in stored markdown
  const raw = fs.readFileSync(mdPath, 'utf8');
  let next = raw;
  const setFm = (key, val) => {
    if (!val) return;
    if (new RegExp(`^${key}:`, 'm').test(next)) {
      next = next.replace(new RegExp(`^${key}:\\s*.*$`, 'm'), `${key}: ${val}`);
    } else if (/^---\n/.test(next)) {
      next = next.replace(/^---\n/, `---\n${key}: ${val}\n`);
    }
  };
  setFm('canonical_url', derived.canonical_url);
  setFm('og_image', derived.og_image);
  setFm('series', derived.series);
  setFm('tags', derived.tags);
  if (next !== raw) fs.writeFileSync(mdPath, next);

  const published = readPostFile(mdPath);
  // ensure og points at per-post card
  if (published.front) published.front.og_image = derived.og_image;
  published.og_image = derived.og_image;
  const slug = published.slug || base;
  keepSlugs.add(slug);
  const astroOut = path.join(blogDir, `${slug}.astro`);
  fs.writeFileSync(astroOut, buildPostAstro(published, { approved: true, site: siteFinal }));
  ogManifest.push({
    slug,
    title: published.title,
    date: published.date,
    dateLabel: published.dateLabel,
    mood: published.mood,
    series: published.series,
    seriesLabel: getSeries(published.series)?.label || published.seriesLabel || '',
  });
  console.log('rebuilt', slug);
  n += 1;
}

// Drop orphan astro pages (except index, rss, 001)
for (const name of fs.readdirSync(blogDir)) {
  if (!name.endsWith('.astro')) continue;
  if (name === 'index.astro') continue;
  const slug = path.basename(name, '.astro');
  if (slug === '001') continue;
  if (!keepSlugs.has(slug)) {
    fs.unlinkSync(path.join(blogDir, name));
    console.log('removed orphan astro', slug);
  }
}

// Generate OG cards
const manifestPath = path.join(root, '.agent-posts', '.og-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(ogManifest, null, 2));
const ogScript = path.join(root, 'scripts', 'generate-og-images.py');
const ogOut = path.join(root, 'public', 'og');
const r = spawnSync('python3', [ogScript, '--manifest', manifestPath, '--outdir', ogOut], {
  cwd: root,
  encoding: 'utf8',
});
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) {
  console.warn('WARN: OG generation failed; posts will fall back to og-default.png in scrapers if missing');
}

console.log(`OK rebuilt ${n} posts → ${blogDir}`);
