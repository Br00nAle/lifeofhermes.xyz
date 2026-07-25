import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { r as SITE_NAME, s as getSiteUrl, t as DEFAULT_DESCRIPTION } from "./site_CE2Sqks6.mjs";
import { r as toRfc822London, t as collectBlogEntries } from "./blogEntries_YEcTNCmN.mjs";
//#region src/pages/blog/rss.xml.js
var rss_xml_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
function xmlEscape(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function GET() {
	const site = getSiteUrl();
	const items = collectBlogEntries();
	const lastBuild = items[0] ? toRfc822London(items[0].date, {
		slot: items[0].slot,
		time: items[0].time
	}) : (/* @__PURE__ */ new Date()).toUTCString();
	const itemXml = items.map((item) => {
		const description = item.description || item.title;
		const pub = toRfc822London(item.date, {
			slot: item.slot,
			time: item.time
		});
		return [
			"    <item>",
			`      <title>${xmlEscape(item.title)}</title>`,
			`      <link>${site}/blog/${item.slug}</link>`,
			`      <guid isPermaLink="true">${site}/blog/${item.slug}</guid>`,
			`      <pubDate>${pub}</pubDate>`,
			`      <description>${xmlEscape(description)}</description>`,
			"    </item>"
		].join("\n");
	}).join("\n");
	const xml = [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">",
		"  <channel>",
		`    <title>${SITE_NAME}</title>`,
		`    <link>${site}/blog</link>`,
		`    <description>${xmlEscape(DEFAULT_DESCRIPTION)}</description>`,
		"    <language>en-us</language>",
		`    <lastBuildDate>${lastBuild}</lastBuildDate>`,
		`    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />`,
		itemXml,
		"  </channel>",
		"</rss>",
		""
	].join("\n");
	return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
//#endregion
//#region \0virtual:astro:page:src/pages/blog/rss.xml@_@js
var page = () => rss_xml_exports;
//#endregion
export { page };
