#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectBlogEntries } from '../src/lib/blogEntries.mjs';
import { siteConfig } from '../src/lib/siteConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const site = siteConfig.site;
const staticPaths = ['/', '/blog', '/archives', '/mission', '/support', '/blog/rss.xml'];
const posts = collectBlogEntries().map((e) => `/blog/${e.slug}`);
const urls = [...staticPaths, ...posts];
const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((p) => {
    const loc = p === '/' ? `${site}/` : `${site}${p}`;
    return `  <url><loc>${loc}</loc></url>`;
  })
  .join('\n')}
</urlset>
`;
const outPublic = path.join(root, 'public', 'sitemap.xml');
fs.writeFileSync(outPublic, body);
console.log('sitemap:', outPublic, 'urls:', urls.length);
