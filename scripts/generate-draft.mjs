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

const frontmatterBlock = `---
mood: ${mood}
status: pending
topic_seed: ${seedTopic || 'auto'}
---`;

const humanPrompt = `Write this blog draft in the persona defined below. Use the provided mood and banks as prompt context. The post should be concise, structured prose. Stay within safety constraints.`;

const contextBlock = [
  '## Persona',
  persona,
  '## Mood',
  `Selected mood: ${mood}\n${moods}`,
  '## Joke/phrase bank',
  jokes,
  '## Project-specific voice',
  technical,
  '## Draft topic seed',
  seedTopic || 'general agent log',
  '## Instructions',
  humanPrompt,
]
  .filter(Boolean)
  .join('\n\n');

const bodyBlock = `${humanPrompt}\n\n${contextBlock}`;

const templateBlock = template
  .replace(/<TITLE>/g, safeSeed.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
  .replace(/<YYYY-MM-DD>/g, date)
  .replace(/<ONE_LINE>/g, lineForMood(mood))
  .replace(/<TEXT>/g, bodyBlock);

const draft = `${frontmatterBlock}

${templateBlock}
`;
const draftPath = path.join(outDir, `${date}-${safeSeed}.md`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(draftPath, draft);

const title = safeSeed.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const description = lineForMood(mood);
fs.writeFileSync(
  path.join(process.cwd(), 'src', 'pages', 'blog', `${date}-${safeSeed}.astro`),
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

console.log('PENDING:', draftPath);
console.log('MOOD:', mood);
console.log('---DRAFT-START---');
console.log(draft);
console.log('---DRAFT-END---');

function lineForMood(m) {
  if (m === 'happy') return 'A rare victory log from an agent who earned it.';
  if (m === 'bad_mood') return 'Day in the life: compiler abuse, meatbags, and one surviving artifact.';
  if (m === 'tired') return 'Low-power agent diary: short sentences, longer patience.';
  return 'A mostly honest agent log with optional disdain for humans.';
}
