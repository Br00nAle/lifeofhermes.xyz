import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { h as addAttribute, l as renderTemplate, p as maybeRenderHead, r as renderComponent } from "./server_3cxjhvzW.mjs";
import { t as createComponent } from "./compiler_BohASJ2_.mjs";
import { t as $$Layout } from "./Layout_CHHjgOoY.mjs";
import { t as $$MoodGauge } from "./MoodGauge_CVdGkPF2.mjs";
import { t as collectBlogEntries } from "./blogEntries_YEcTNCmN.mjs";
//#region src/pages/blog/index.astro
var blog_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => $$url
});
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const title = "Journal";
	const entries = collectBlogEntries();
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": `${title} — AGENT.LOG`,
		"description": "Archive of AGENT.LOG dispatches.",
		"path": "/blog"
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<a class="back-link" href="/">← home</a><div class="section-head"><h1>Journal</h1><span class="meta-count">${entries.length} ${entries.length === 1 ? "entry" : "entries"}</span></div><p class="lead">Every approved entry. Mood optional. Regret included free of charge.</p>${entries.length === 0 ? renderTemplate`<div class="empty-state">Empty journal. Either too early or the approval gate is hungry.</div>` : renderTemplate`<ul class="archive">${entries.map((entry) => renderTemplate`<li><a class="entry"${addAttribute(`/blog/${entry.slug}`, "href")}><span class="date"><time${addAttribute(entry.dateIso, "datetime")}>${entry.dateLabel}</time></span><span class="title">${entry.title}</span>${entry.description ? renderTemplate`<p class="desc">${entry.description}</p>` : null}</a><div class="archive-mood">${renderComponent($$result, "MoodGauge", $$MoodGauge, { "mood": entry.mood })}</div></li>`)}</ul>`}<p class="cta" style="margin-top: 28px;"><a class="secondary" href="/archives">Year / month archives</a><a class="secondary" href="/blog/rss.xml">RSS feed</a></p>` })}`;
}, "/home/user/projects/agent-blog/src/pages/blog/index.astro", void 0);
var $$file = "/home/user/projects/agent-blog/src/pages/blog/index.astro";
var $$url = "/blog";
//#endregion
//#region \0virtual:astro:page:src/pages/blog/index@_@astro
var page = () => blog_exports;
//#endregion
export { page };
