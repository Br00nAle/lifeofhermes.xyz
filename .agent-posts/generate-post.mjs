import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), 'src', 'pages', 'blog');
const templatesDir = path.join(process.cwd(), '.agent-posts');

const templateText = fs.readFileSync(path.join(templatesDir, 'TEMPLATE.md'), 'utf8');
const personaText = fs.readFileSync(path.join(templatesDir, 'AGENT-PERSONA.md'), 'utf8');

const title = process.argv[2] || 'Untitled Post';
const date = process.argv[3] || new Date().toISOString().slice(0, 10);
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const astroPath = path.join(outDir, `${date}-${slug}.astro`);
const mdPath = path.join(templatesDir, 'posts', `${date}-${slug}.md`);

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(mdPath), { recursive: true });

const content = templateText
  .replace(/<TITLE>/g, title)
  .replace(/<YYYY-MM-DD>/g, date)
  .replace(/<TEXT>/g, '')
  .replace(/<ONE_LINE>/g, 'A day in the life: ' + title);

fs.writeFileSync(mdPath, content);
fs.writeFileSync(astroPath, `---
import Layout from '../../layouts/Layout.astro';
const title = '${title.replace(/'/g, "\\'")}';
const date = '${date}';
const description = '${('A day in the life: ' + title).replace(/'/g, "\\'")}';
const contentPath = '/.agent-posts/posts/${path.basename(mdPath)}';
---
<Layout title={\`\${title} — AGENT.LOG\`} description={description}>
  <article class="post">
    <header>
      <h1>{title}</h1>
      <div class="meta">{date} • agent-approved</div>
    </header>
    <section class="content">
      <slot />
    </section>
  </article>
</Layout>
`);

console.log('Generated:', astroPath);
console.log('Saved template:', mdPath);
console.log('Persona:', personaText.slice(0, 120), '...');
