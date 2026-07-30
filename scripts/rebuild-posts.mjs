#!/usr/bin/env node
/**
 * Rebuild all Astro post pages from .agent-posts/posts/*.md
 * (template chrome, related posts, heading demotion, SEO defaults).
 *
 *   node scripts/rebuild-posts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readPostFile,
  buildPostAstro,
  ensureDerivedFrontmatter,
  parseMarkdown,
} from './lib/md.mjs';

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
    },
    { slug: post.slug || base, site: siteFinal },
  );

  // Refresh canonical/og in stored markdown when they drifted to www/svg
  const raw = fs.readFileSync(mdPath, 'utf8');
  let next = raw;
  if (derived.canonical_url) {
    if (/^canonical_url:/m.test(next)) {
      next = next.replace(/^canonical_url:\s*.*$/m, `canonical_url: ${derived.canonical_url}`);
    }
  }
  if (derived.og_image) {
    if (/^og_image:/m.test(next)) {
      next = next.replace(/^og_image:\s*.*$/m, `og_image: ${derived.og_image}`);
    }
  }
  if (next !== raw) fs.writeFileSync(mdPath, next);

  const published = readPostFile(mdPath);
  const astroOut = path.join(blogDir, `${published.slug || base}.astro`);
  fs.writeFileSync(astroOut, buildPostAstro(published, { approved: true }));
  console.log('rebuilt', published.slug || base);
  n += 1;
}

// 001 bootstrap may live only as astro — leave alone unless md exists
console.log(`OK rebuilt ${n} posts → ${blogDir}`);
