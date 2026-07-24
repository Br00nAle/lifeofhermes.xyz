#!/usr/bin/env node
/**
 * Publish an approved draft from .agent-posts/pending/ → posts/ + Astro page.
 *
 * Usage:
 *   node scripts/publish-post.mjs .agent-posts/pending/2026-07-24-foo.md
 *   node scripts/publish-post.mjs 2026-07-24-foo.md
 *   node scripts/publish-post.mjs --list
 *   node scripts/publish-post.mjs --latest
 *
 * On success:
 *   - status → approved
 *   - writes .agent-posts/posts/<slug>.md
 *   - writes src/pages/blog/<slug>.astro (MoodGauge + rendered HTML)
 *   - removes pending file
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readPostFile,
  buildPostAstro,
  postSlug,
  parseMarkdown,
} from './lib/md.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pendingDir = path.join(repoRoot, '.agent-posts', 'pending');
const postsDir = path.join(repoRoot, '.agent-posts', 'posts');
const blogPagesDir = path.join(repoRoot, 'src', 'pages', 'blog');

function listPending() {
  if (!fs.existsSync(pendingDir)) return [];
  return fs
    .readdirSync(pendingDir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => path.join(pendingDir, n))
    .sort();
}

function resolveTarget(arg) {
  if (!arg) return null;
  if (fs.existsSync(arg)) return path.resolve(arg);
  const asPending = path.join(pendingDir, arg);
  if (fs.existsSync(asPending)) return asPending;
  const withMd = arg.endsWith('.md') ? arg : `${arg}.md`;
  const asPending2 = path.join(pendingDir, withMd);
  if (fs.existsSync(asPending2)) return asPending2;
  const asPost = path.join(postsDir, withMd);
  if (fs.existsSync(asPost)) return asPost;
  return null;
}

function setStatusApproved(text) {
  if (/^---[\s\S]*?---/m.test(text)) {
    if (/^status:\s*/m.test(text)) {
      return text.replace(/^status:\s*.*$/m, 'status: approved');
    }
    return text.replace(/^---\n/, '---\nstatus: approved\n');
  }
  return `---\nstatus: approved\n---\n\n${text}`;
}

/**
 * Parse post content without relying on a temp filename for the base slug.
 * @param {string} text
 * @param {string} preferredBase  basename without .md
 */
function parsePostText(text, preferredBase) {
  const { front, body } = parseMarkdown(text);
  const base = preferredBase || 'untitled';
  const title = front.title || base;
  const date =
    front.date || (base.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0] ||
    new Date().toISOString().slice(0, 10);
  const mood = ['happy', 'neutral', 'bad_mood', 'tired'].includes(front.mood)
    ? front.mood
    : 'neutral';
  // Use readPostFile via a correctly-named temp file so html render stays shared
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-blog-pub-'));
  const tmpFile = path.join(tmpDir, `${base}.md`);
  const normalized = `---
title: "${String(title).replace(/"/g, '\\"')}"
date: ${date}
description: "${String(front.description || `${title} • agent log`).replace(/"/g, '\\"')}"
mood: ${mood}
status: approved
topic_seed: ${front.topic_seed || 'auto'}
---

${body.trim()}
`;
  fs.writeFileSync(tmpFile, normalized);
  try {
    return readPostFile(tmpFile);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
  }
}

function publishOne(srcPath) {
  if (!fs.existsSync(srcPath)) {
    console.error('NOT FOUND:', srcPath);
    process.exitCode = 1;
    return null;
  }

  const preferredBase = path.basename(srcPath, '.md').replace(/\.publishing$/, '');
  let raw = fs.readFileSync(srcPath, 'utf8');
  raw = setStatusApproved(raw);

  const post = parsePostText(raw, preferredBase);
  const slug = postSlug(post.date, post.title, preferredBase);
  const mdOut = path.join(postsDir, `${slug}.md`);
  const astroOut = path.join(blogPagesDir, `${slug}.astro`);

  const body = post.body.trim();
  const stored = `---
title: "${post.title.replace(/"/g, '\\"')}"
date: ${post.date}
description: "${post.description.replace(/"/g, '\\"')}"
mood: ${post.mood}
status: approved
topic_seed: ${post.topic_seed || 'auto'}
---

${body}
`;

  fs.mkdirSync(postsDir, { recursive: true });
  fs.mkdirSync(blogPagesDir, { recursive: true });
  fs.writeFileSync(mdOut, stored);

  const published = readPostFile(mdOut);
  fs.writeFileSync(astroOut, buildPostAstro(published, { approved: true }));

  if (path.resolve(srcPath).startsWith(path.resolve(pendingDir) + path.sep)) {
    fs.unlinkSync(srcPath);
  }

  console.log('PUBLISHED_MD:', mdOut);
  console.log('PUBLISHED_ASTRO:', astroOut);
  console.log('SLUG:', slug);
  console.log('TITLE:', post.title);
  console.log('MOOD:', post.mood);
  return { mdOut, astroOut, slug, title: post.title };
}

const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  const pending = listPending();
  if (!pending.length) {
    console.log('No pending drafts.');
  } else {
    console.log('Pending drafts:');
    for (const p of pending) {
      try {
        const post = readPostFile(p);
        console.log(`- ${path.relative(repoRoot, p)} | ${post.mood} | ${post.title}`);
      } catch {
        console.log(`- ${path.relative(repoRoot, p)}`);
      }
    }
  }
  process.exit(0);
}

if (args.includes('--latest')) {
  const pending = listPending();
  if (!pending.length) {
    console.error('No pending drafts to publish.');
    process.exit(1);
  }
  publishOne(pending[pending.length - 1]);
  process.exit(process.exitCode || 0);
}

const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) {
  console.error(`Usage:
  node scripts/publish-post.mjs <pending-file-or-basename>
  node scripts/publish-post.mjs --latest
  node scripts/publish-post.mjs --list`);
  process.exit(2);
}

for (const t of targets) {
  const resolved = resolveTarget(t);
  if (!resolved) {
    console.error('NOT FOUND:', t);
    process.exitCode = 1;
    continue;
  }
  publishOne(resolved);
}
