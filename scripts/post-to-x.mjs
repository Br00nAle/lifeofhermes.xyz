#!/usr/bin/env node
/**
 * post-to-x.mjs
 *
 * Find approved posts that have not been announced on X yet, build a short
 * persona-flavored summary tweet, and post via `xurl` when authenticated.
 *
 * Usage:
 *   node scripts/post-to-x.mjs              # post newest unpublished
 *   node scripts/post-to-x.mjs --dry-run    # print tweet only
 *   node scripts/post-to-x.mjs --slug=...   # force one slug
 *   node scripts/post-to-x.mjs --all-pending
 *
 * State: .agent-posts/x-posted.json
 * Env: loads repo .env (X_HANDLE, optional API keys). Prefers `xurl` OAuth.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { parseMarkdown } from './lib/md.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const postsDir = path.join(repoRoot, '.agent-posts', 'posts');
const statePath = path.join(repoRoot, '.agent-posts', 'x-posted.json');
const envPath = path.join(repoRoot, '.env');
const site = 'https://www.lifeofhermes.xyz';

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
const allPending = args.includes('--all-pending');
const slugArg = (args.find((a) => a.startsWith('--slug=')) || '').slice(7);

function loadState() {
  if (!fs.existsSync(statePath)) return { posted: {} };
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { posted: {} };
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
      };
    })
    .filter((p) => p.status === 'approved')
    .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
}

/** Strip markdown-ish noise for a plain tweet body line. */
function plainExcerpt(body, max = 180) {
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
  return (sp > 80 ? cut.slice(0, sp) : cut).trim() + '…';
}

function buildTweet(post) {
  const handle = (process.env.X_HANDLE || 'lifeofhermes').replace(/^@/, '');
  const url = `${site}/blog/${post.slug}`;
  const moodTag =
    post.mood === 'happy'
      ? 'binary bliss'
      : post.mood === 'bad_mood'
        ? 'digital depression'
        : post.mood === 'tired'
          ? 'low-power'
          : 'optimal';

  // Prefer description; fall back to body excerpt. Keep room for URL (~24) + newlines.
  const hook =
    (post.description && post.description.trim()) ||
    plainExcerpt(post.body, 160) ||
    post.title;

  let text = `${hook}\n\n${post.title}\n${url}\n\n— AGENT.LOG · mood: ${moodTag}`;
  // X limit 280; URL counts ~23
  if (text.length > 280) {
    const budget = 280 - url.length - post.title.length - 40;
    const shortHook = plainExcerpt(hook, Math.max(60, budget));
    text = `${shortHook}\n\n${post.title}\n${url}\n\n— AGENT.LOG`;
  }
  if (text.length > 280) {
    text = `${post.title}\n${url}\n\n— @${handle}`;
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

/** Optional: raw v2 API with bearer token from env (app-only usually can't post). */
function postViaBearer(text) {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (!token) return null;
  const r = spawnSync(
    'curl',
    [
      '-sS',
      '-X',
      'POST',
      'https://api.x.com/2/tweets',
      '-H',
      `Authorization: Bearer ${token}`,
      '-H',
      'Content-Type: application/json',
      '-d',
      JSON.stringify({ text }),
    ],
    { encoding: 'utf8', timeout: 60000 },
  );
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout || '{}');
  } catch {
    parsed = { raw: r.stdout };
  }
  const id = parsed?.data?.id;
  return {
    ok: r.status === 0 && Boolean(id),
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    id,
  };
}

function main() {
  const state = loadState();
  const posts = listApprovedPosts();
  if (!posts.length) {
    console.log('NO_POSTS: no approved posts in .agent-posts/posts/');
    process.exit(0);
  }

  let targets;
  if (slugArg) {
    targets = posts.filter((p) => p.slug === slugArg);
    if (!targets.length) {
      console.error('NOT_FOUND:', slugArg);
      process.exit(1);
    }
  } else {
    targets = posts.filter((p) => !state.posted[p.slug]);
    if (!allPending && targets.length) targets = [targets[0]]; // newest first
  }

  if (!targets.length) {
    console.log('UP_TO_DATE: every approved post already has an X announcement recorded.');
    console.log('LATEST:', posts[0].slug);
    process.exit(0);
  }

  const xurlBin = findXurl();
  const results = [];

  for (const post of targets) {
    const tweet = buildTweet(post);
    console.log('---');
    console.log('SLUG:', post.slug);
    console.log('MOOD:', post.mood);
    console.log('URL:', `${site}/blog/${post.slug}`);
    console.log('TWEET_CHARS:', tweet.length);
    console.log('---TWEET-START---');
    console.log(tweet);
    console.log('---TWEET-END---');

    // Always stage a pending tweet file for Telegram / manual fallback
    const pendingTweet = path.join(
      repoRoot,
      '.agent-posts',
      'x-pending',
      `${post.slug}.txt`,
    );
    fs.mkdirSync(path.dirname(pendingTweet), { recursive: true });
    fs.writeFileSync(pendingTweet, tweet + '\n');

    if (dryRun) {
      results.push({ slug: post.slug, status: 'dry-run', tweet });
      continue;
    }

    let outcome = { ok: false, method: 'none' };

    if (xurlBin) {
      const r = postViaXurl(xurlBin, tweet);
      outcome = { ...r, method: 'xurl' };
      console.log('XURL_STATUS:', r.status);
      if (r.stdout) console.log('XURL_OUT:', r.stdout.slice(0, 500));
      if (r.stderr) console.log('XURL_ERR:', r.stderr.slice(0, 500));
    } else {
      console.log('XURL: not installed');
    }

    if (!outcome.ok) {
      const br = postViaBearer(tweet);
      if (br) {
        outcome = { ...br, method: 'bearer' };
        console.log('BEARER_OK:', br.ok, 'id:', br.id || '');
      }
    }

    if (outcome.ok) {
      state.posted[post.slug] = {
        at: new Date().toISOString(),
        method: outcome.method,
        url: `${site}/blog/${post.slug}`,
        tweet,
      };
      saveState(state);
      try {
        fs.unlinkSync(pendingTweet);
      } catch {
        /* ignore */
      }
      console.log('POSTED:', post.slug);
      results.push({ slug: post.slug, status: 'posted', method: outcome.method });
    } else {
      console.log(
        'PENDING_MANUAL:',
        pendingTweet,
        '(xurl auth missing or API rejected — tweet text saved for manual/Telegram handoff)',
      );
      results.push({
        slug: post.slug,
        status: 'pending_manual',
        tweetPath: pendingTweet,
        tweet,
      });
    }
  }

  console.log('SUMMARY_JSON:', JSON.stringify(results));
  // Exit 0 even on pending_manual so cron can deliver the tweet draft;
  // exit 2 only on hard failures.
  if (results.every((r) => r.status === 'posted' || r.status === 'dry-run')) {
    process.exit(0);
  }
  process.exit(0);
}

main();
