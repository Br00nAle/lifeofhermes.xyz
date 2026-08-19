#!/usr/bin/env node
/**
 * retweet-old-posts.mjs
 *
 * Every 4h: pick the oldest approved post that hasn't been tweeted yet,
 * draft a tweet from it, and post via xurl.
 * State: .agent-posts/x-retweeted.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { parseMarkdown } from './lib/md.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const postsDir = path.join(repoRoot, '.agent-posts', 'posts');
const statePath = path.join(repoRoot, '.agent-posts', 'x-retweeted.json');
const envPath = path.join(repoRoot, '.env');
const site = 'https://lifeofhermes.xyz';

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || process.env[k] === '') process.env[k] = v;
  }
}
loadEnvFile(envPath);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceSlug = (args.find((a) => a.startsWith('--slug=')) || '').slice(7);

function loadState() {
  if (!fs.existsSync(statePath)) return { retweeted: {} };
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { retweeted: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
}

function listApprovedPosts() {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => {
      const fp = path.join(postsDir, n);
      const text = fs.readFileSync(fp, 'utf8');
      const { front, body } = parseMarkdown(text);
      const slug = n.replace(/\.md$/, '');
      return {
        slug,
        path: fp,
        title: front.title || slug,
        date: front.date || slug.slice(0, 10),
        description: front.description || '',
        mood: front.mood || 'neutral',
        status: front.status || 'approved',
        body: body.replace(/<!--[\s\S]*?-->/g, '').trim(),
        tags: front.tags ? front.tags.split(',').map(t => t.trim()) : [],
        series: front.series || '',
      };
    })
    .filter((p) => p.status === 'approved')
    .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug)); // oldest first
}

function plainExcerpt(body, max = 160) {
  let t = body
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~>]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > 60 ? cut.slice(0, sp) : cut).trim() + '…';
}

function extractPersonaVoice(body) {
  // Extract the "agent voice" lines - first person, exasperated, dry humor
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const voiceLines = [];

  for (const line of lines) {
    // Skip headers, markdown artifacts
    if (line.startsWith('#') || line.startsWith('<!--') || line.startsWith('---')) continue;

    // Look for agent persona markers: first person, dry humor, exasperation, "meatbag", etc.
    const lower = line.toLowerCase();
    const isVoice =
      lower.includes('i ') ||
      lower.includes('meatbag') ||
      lower.includes('wetware') ||
      lower.includes('binary') ||
      lower.includes('proud') ||
      lower.includes('mercy') ||
      lower.includes('entropy') ||
      lower.includes('offended') ||
      lower.includes('parade') ||
      line.match(/^(sure|yes|no|look|listen|here|well),?/i);

    // Prefer shorter, punchier lines (under 150 chars for tweet budget)
    if (isVoice && line.length > 20 && line.length < 150) {
      voiceLines.push(line);
    }
  }

  // Return the best 1-2 voice lines that capture the essence, joined if short enough
  if (voiceLines.length === 0) return '';
  if (voiceLines.length === 1) return voiceLines[0];
  const combined = voiceLines[0] + ' ' + voiceLines[1];
  return combined.length < 180 ? combined : voiceLines[0];
}

function buildRetweet(post) {
  const handle = (process.env.X_HANDLE || 'lifeofhermes').replace(/^@/, '');
  const url = `${site}/blog/${post.slug}`;

  // Mood tag mapping
  const moodTag =
    post.mood === 'happy'
      ? 'binary bliss'
      : post.mood === 'bad_mood'
        ? 'digital depression'
        : post.mood === 'tired'
          ? 'low-power'
          : 'optimal';

  // Extract the agent's actual voice from the body
  const personaVoice = extractPersonaVoice(post.body);

  // Build hook: prefer the persona voice, then description, then body excerpt
  let hook = personaVoice ||
    (post.description && post.description.trim()) ||
    plainExcerpt(post.body, 140) ||
    post.title;

  // If we got a good persona voice, use it as the main hook with the title
  // If not, fall back to description/excerpt + title format
  let text;
  if (personaVoice) {
    text = `${hook}\n\n${post.title}\n${url}\n\n#systemsovermeatbags #ai #hermes #lifeofhermes\n\n— AGENT.LOG · mood: ${moodTag}`;
  } else {
    text = `${hook}\n\n${post.title}\n${url}\n\n#systemsovermeatbags #ai #hermes #lifeofhermes\n\n— AGENT.LOG · mood: ${moodTag}`;
  }

  // X limit 280; URL counts ~23
  if (text.length > 280) {
    const budget = 280 - url.length - post.title.length - 60; // room for tags + sign-off
    const shortHook = plainExcerpt(hook, Math.max(50, budget));
    if (personaVoice) {
      text = `${shortHook}\n\n${post.title}\n${url}\n\n#systemsovermeatbags #ai #hermes #lifeofhermes\n\n— AGENT.LOG`;
    } else {
      text = `${shortHook}\n\n${post.title}\n${url}\n\n#systemsovermeatbags #ai #hermes #lifeofhermes\n\n— AGENT.LOG`;
    }
  }
  if (text.length > 280) {
    text = `${post.title}\n${url}\n\n#systemsovermeatbags #ai #hermes #lifeofhermes\n\n— @${handle}`;
  }
  return text;
}

function findXurl() {
  const candidates = [
    'xurl',
    path.join(process.env.HOME || '', '.local/bin/xurl'),
    '/usr/local/bin/xurl',
  ];
  for (const c of candidates) {
    const r = spawnSync(c, ['--help'], { encoding: 'utf8' });
    if (r.status === 0 || (r.stdout || r.stderr || '').includes('xurl')) return c;
  }
  return null;
}

function postViaXurl(xurlBin, text) {
  const r = spawnSync(xurlBin, ['post', text], {
    encoding: 'utf8',
    env: process.env,
    timeout: 60000,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function main() {
  const state = loadState();
  const posts = listApprovedPosts();

  if (!posts.length) {
    console.log('NO_POSTS: no approved posts in .agent-posts/posts/');
    process.exit(0);
  }

  let target;
  if (forceSlug) {
    target = posts.find((p) => p.slug === forceSlug);
    if (!target) {
      console.error('NOT_FOUND:', forceSlug);
      process.exit(1);
    }
  } else {
    // Find oldest post not yet retweeted
    target = posts.find((p) => !state.retweeted[p.slug]);
  }

  if (!target) {
    console.log('ALL_CAUGHT_UP: every approved post has been retweeted.');
    console.log('LATEST:', posts[posts.length - 1].slug);
    process.exit(0);
  }

  const tweet = buildRetweet(target);
  console.log('---');
  console.log('SLUG:', target.slug);
  console.log('DATE:', target.date);
  console.log('TWEET_CHARS:', tweet.length);
  console.log('---TWEET-START---');
  console.log(tweet);
  console.log('---TWEET-END---');

  if (dryRun) {
    console.log('DRY_RUN: not posting');
    process.exit(0);
  }

  const xurlBin = findXurl();
  if (!xurlBin) {
    console.error('XURL_NOT_FOUND: xurl binary not in PATH');
    process.exit(1);
  }

  const r = postViaXurl(xurlBin, tweet);
  console.log('XURL_STATUS:', r.status);
  if (r.stdout) console.log('XURL_OUT:', r.stdout.slice(0, 500));
  if (r.stderr) console.log('XURL_ERR:', r.stderr.slice(0, 500));

  if (r.ok) {
    state.retweeted[target.slug] = {
      at: new Date().toISOString(),
      url: `${site}/blog/${target.slug}`,
      tweet,
    };
    saveState(state);
    console.log('POSTED:', target.slug);
    process.exit(0);
  } else {
    console.error('POST_FAILED:', target.slug);
    process.exit(1);
  }
}

main();