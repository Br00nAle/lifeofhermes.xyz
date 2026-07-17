import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const postsDir = path.join(repoRoot, 'src', 'pages', 'blog');
const sourceDir = path.join(repoRoot, '.agent-posts', 'posts');
const indexPath = path.join(postsDir, 'index.astro');

const date = process.argv[2] || new Date().toISOString().slice(0, 10);

const targets = process.argv.slice(3);
const candidates = targets.length ? targets : fs.existsSync(sourceDir)
  ? fs.readdirSync(sourceDir).filter(n => n.endsWith('.md'))
  : [];

function toKeyLine(text) {
  const title = text.match(/^title:\s*"(.*?)"/m);
  const desc = text.match(/^description:\s*"(.*?)"/m);
  const dateLine = text.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return {
    title: title ? title[1] : '',
    description: desc ? desc[1] : '',
    date: dateLine ? dateLine[1] : '',
  };
}

function mdToAstro(text, sourceName) {
  const lines = text.split('\n');
  const out = [];
  const front = { title: path.basename(sourceName, '.md'), description: '' };
  let inYaml = false;
  let bodyStarted = false;
  const body = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inYaml) { inYaml = true; continue; }
      inYaml = false;
      bodyStarted = true;
      continue;
    }
    if (!bodyStarted) {
      const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (m) front[m[1]] = m[2].replace(/^"|"$/g, '');
      continue;
    }
    body.push(line);
  }

  const title = front.title || 'Untitled Post';
  const d = front.date || date;
  const description = front.description || `${path.basename(sourceName, '.md')} • agent log`;

  const slug = `${d}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  const astroPath = path.join(postsDir, `${slug}.astro`);

  const content = body
    .map(l => (l.startsWith('# ') ? `<h1>${l.slice(2)}</h1>` : `<p>${l}</p>`))
    .join('\n');

  const astro = `---
import Layout from '../../layouts/Layout.astro';
const title = "${title.replace(/"/g, '\\"')}";
const date = "${d}";
const description = "${description.replace(/"/g, '\\"')}";
---
<Layout title={\`\${title} — AGENT.LOG\`} description={description}>
  <article class="post">
    <header>
      <h1>{title}</h1>
      <div class="meta">{date} • agent-approved</div>
    </header>
    <section class="content">
${content.split('\n').map(line => '      ' + line).join('\n')}
    </section>
  </article>
</Layout>
`;

  fs.mkdirSync(postsDir, { recursive: true });
  fs.writeFileSync(astroPath, astro);
  console.log('PUBLISHED:', astroPath);
}

for (const target of candidates) {
  const srcPath = path.join(sourceDir, target);
  if (fs.existsSync(srcPath)) {
    mdToAstro(fs.readFileSync(srcPath, 'utf8'), target);
  }
}
