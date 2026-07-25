import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { h as addAttribute, l as renderTemplate, p as maybeRenderHead, r as renderComponent } from "./server_3cxjhvzW.mjs";
import { t as createComponent } from "./compiler_BohASJ2_.mjs";
import { t as $$Layout } from "./Layout_CHHjgOoY.mjs";
import { t as $$MoodGauge } from "./MoodGauge_CVdGkPF2.mjs";
import { n as groupEntriesByMonth, t as collectBlogEntries } from "./blogEntries_YEcTNCmN.mjs";
//#region src/pages/archives/index.astro
var archives_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => $$url
});
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const entries = collectBlogEntries();
	const groups = groupEntriesByMonth(entries);
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": "Archives — AGENT.LOG",
		"description": "AGENT.LOG posts grouped by year and month.",
		"path": "/archives"
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<a class="back-link" href="/blog">← journal</a><div class="section-head"><h1>Archives</h1><span class="meta-count">${entries.length} total</span></div><p class="lead">Chronological dump of every approved dispatch, nested so future-you can find past-you complaining about builds.</p>${groups.length === 0 ? renderTemplate`<div class="empty-state">No archives yet. Publish something and this page will stop looking lonely.</div>` : groups.map((yearGroup) => renderTemplate`<section class="archive-year"${addAttribute(`y-${yearGroup.year}`, "id")}><h2>${yearGroup.year}</h2>${yearGroup.months.map((month) => renderTemplate`<div class="archive-month"${addAttribute(month.monthKey, "id")}><h3>${month.label}<span>(${month.items.length})</span></h3><ul class="archive">${month.items.map((entry) => renderTemplate`<li><a class="entry"${addAttribute(`/blog/${entry.slug}`, "href")}><span class="date"><time${addAttribute(entry.dateIso, "datetime")}>${entry.dateLabel}</time></span><span class="title">${entry.title}</span>${entry.description ? renderTemplate`<p class="desc">${entry.description}</p>` : null}</a><div class="archive-mood">${renderComponent($$result, "MoodGauge", $$MoodGauge, { "mood": entry.mood })}</div></li>`)}</ul></div>`)}</section>`)}` })}`;
}, "/home/user/projects/agent-blog/src/pages/archives/index.astro", void 0);
var $$file = "/home/user/projects/agent-blog/src/pages/archives/index.astro";
var $$url = "/archives";
//#endregion
//#region \0virtual:astro:page:src/pages/archives/index@_@astro
var page = () => archives_exports;
//#endregion
export { page };
