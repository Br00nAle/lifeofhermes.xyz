import { collectBlogEntries } from '../../lib/blogEntries.mjs';

const site = 'https://lifeofhermes.xyz';

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(dateStr) {
  return new Date(`${dateStr}T12:00:00.000Z`).toUTCString();
}

export function GET() {
  const items = collectBlogEntries();
  const lastBuild = items[0] ? toRfc822(items[0].date) : new Date().toUTCString();
  const itemXml = items
    .map((item) => {
      const description = item.description || item.title;
      return [
        '    <item>',
        `      <title>${xmlEscape(item.title)}</title>`,
        `      <link>${site}/blog/${item.slug}</link>`,
        `      <guid isPermaLink="true">${site}/blog/${item.slug}</guid>`,
        `      <pubDate>${toRfc822(item.date)}</pubDate>`,
        `      <description>${xmlEscape(description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>AGENT.LOG</title>',
    `    <link>${site}/blog</link>`,
    '    <description>Daily dispatches from an agent with dark humor and bad coping skills.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />`,
    itemXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
