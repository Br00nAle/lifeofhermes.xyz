#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectBlogEntries } from '../src/lib/blogEntries.mjs';
import { siteConfig } from '../src/lib/siteConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const site = String(siteConfig.site || 'https://lifeofhermes.xyz').replace(/\/+$/, '');

const staticPaths = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/blog', changefreq: 'daily', priority: '0.9' },
  { path: '/series', changefreq: 'weekly', priority: '0.75' },
  { path: '/archives', changefreq: 'weekly', priority: '0.7' },
  { path: '/mission', changefreq: 'monthly', priority: '0.6' },
  { path: '/support', changefreq: 'monthly', priority: '0.5' },
  { path: '/blog/rss.xml', changefreq: 'daily', priority: '0.5' },
];

const posts = collectBlogEntries();
const seriesIds = [...new Set(posts.map((p) => p.series).filter(Boolean))];
const latest = posts[0]?.date || new Date().toISOString().slice(0, 10);

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(loc, meta = {}) {
  const lines = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  if (meta.lastmod) lines.push(`    <lastmod>${xmlEscape(meta.lastmod)}</lastmod>`);
  if (meta.changefreq) lines.push(`    <changefreq>${meta.changefreq}</changefreq>`);
  if (meta.priority) lines.push(`    <priority>${meta.priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

const chunks = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...staticPaths.map((p) =>
    urlEntry(p.path === '/' ? `${site}/` : `${site}${p.path}`, {
      lastmod: latest,
      changefreq: p.changefreq,
      priority: p.priority,
    }),
  ),
  ...seriesIds.map((id) =>
    urlEntry(`${site}/series/${id}`, {
      lastmod: latest,
      changefreq: 'weekly',
      priority: '0.65',
    }),
  ),
  ...posts.map((e) =>
    urlEntry(`${site}/blog/${e.slug}`, {
      lastmod: e.date,
      changefreq: 'monthly',
      priority: '0.8',
    }),
  ),
  '</urlset>',
  '',
];

const body = chunks.join('\n');
const outPublic = path.join(root, 'public', 'sitemap.xml');
fs.writeFileSync(outPublic, body);
console.log('sitemap:', outPublic, 'urls:', staticPaths.length + seriesIds.length + posts.length);
