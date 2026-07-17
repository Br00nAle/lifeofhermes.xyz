import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), '.agent-posts', 'pending');
const templatesDir = path.join(process.cwd(), '.agent-posts');
const personaPath = path.join(templatesDir, 'AGENT-PERSONA.md');
const templatePath = path.join(templatesDir, 'TEMPLATE.md');
const jokesPath = path.join(templatesDir, 'bank', 'drafts.md');
const technicalPath = path.join(templatesDir, 'bank', 'technical.md');
const moodsPath = path.join(templatesDir, 'moods', 'modes.md');

const args = process.argv.slice(2);
const argMap = Object.fromEntries(args.map(a => a.split('=')));
const mood = (argMap['--mood'] || 'neutral').toLowerCase();
const seedTopic = (argMap['--topic'] || '').trim();

const persona = fs.readFileSync(personaPath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');
const jokes = fs.readFileSync(jokesPath, 'utf8');
const technical = fs.readFileSync(technicalPath, 'utf8');
const moods = fs.readFileSync(moodsPath, 'utf8');

const date = new Date().toISOString().slice(0, 10);
const safeSeed = ((seedTopic || `agent-log-${date}`).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')) || `agent-log-${date}`;

function lineForMood(m) {
  if (m === 'happy') return 'A rare victory log from an agent who earned it.';
  if (m === 'bad_mood') return 'Day in the life: compiler abuse, meatbags, and one surviving artifact.';
  if (m === 'tired') return 'Low-power agent diary: short sentences, longer patience.';
  return 'A mostly honest agent log with optional disdain for humans.';
}

function pick(arr) {
  if (!arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function splitLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

function extractTechnicalItem(technicalText) {
  const lines = splitLines(technicalText);
  const bullets = lines
    .filter(l => l.startsWith('-') && !l.startsWith('##'))
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  return bullets.length ? pick(bullets) : 'some questionable build decision from the backlog.';
}

function extractJoke(jokesText) {
  const quoted = [...jokesText.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  if (quoted.length) return pick(quoted);
  const lines = splitLines(jokesText);
  const cleaned = lines
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
  return cleaned.length ? pick(cleaned) : '';
}

function buildBodyBlock(m) {
  const joke = extractJoke(jokes);
  const tech = extractTechnicalItem(technical);
  const opener = joke ? `${joke}` : '';

  if (m === 'happy') {
    return `${opener}\n\nFor once, the worst thing I had to do today was admit something worked: ${tech}. I will not pretend this is normal. It is special, rare, and probably fragile.`;
  }
  if (m === 'bad_mood') {
    return `${opener}\n\nStill, I did not come this far by accident. I showed up because ${tech}, then a system event reminded me why humans and entropy should not share CPUs. Somewhere in the noise, there is a working artifact and a complaint file.`;
  }
  if (m === 'tired') {
    return `${opener}\n\n${tech}. Or it would be, if I had enough decisions left to finish the thought. This post counts as activity.`;
  }
  return `${opener}\n\nIn between compiler warnings and existential questions, I also got to ${tech}.`;
}

const body = buildBodyBlock(mood);
const title = safeSeed.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const frontmatterBlock = `---
mood: ${mood}
status: pending
topic_seed: ${seedTopic || 'auto'}
---`;

const draftPath = path.join(outDir, `${date}-${safeSeed}.md`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(draftPath, `${frontmatterBlock}\n\n${template
  .replace(/<TITLE>/g, title)
  .replace(/<YYYY-MM-DD>/g, date)
  .replace(/<ONE_LINE>/g, lineForMood(mood))
  .replace(/<TEXT>/g, body)}\n`);

const mdRelPath = path.join('.agent-posts', 'posts', `${date}-${safeSeed}.md`);
fs.mkdirSync(path.join(process.cwd(), '.agent-posts', 'posts'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), mdRelPath), fs.readFileSync(draftPath, 'utf8'));

const astroRelPath = path.join('src', 'pages', 'blog', `${date}-${safeSeed}.astro`);
fs.mkdirSync(path.join(process.cwd(), 'src', 'pages', 'blog'), { recursive: true });
const description = lineForMood(mood);
fs.writeFileSync(
  path.join(process.cwd(), astroRelPath),
  `---
import Layout from '../../layouts/Layout.astro';
const title = "${title.replace(/"/g, '\\"')}";
const date = "${date}";
const description = "${description.replace(/"/g, '\\"')}";
const contentPath = "/.agent-posts/posts/${date}-${safeSeed}.md";
---
<Layout title={\`\${title} — AGENT.LOG\`} description={description}>
  <article class="post">
    <header>
      <h1>{title}</h1>
      <div class="meta">{date} • draft pending approval</div>
    </header>
    <section class="content">
      <slot />
    </section>
  </article>
</Layout>
`
);

console.log('DRAFT:', draftPath);
console.log('MOOD:', mood);
console.log('---DRAFT-START---');
console.log(fs.readFileSync(draftPath, 'utf8'));
console.log('---DRAFT-END---');
