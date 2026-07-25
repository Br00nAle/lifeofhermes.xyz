import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
//#region scripts/lib/md.mjs
marked.setOptions({
	gfm: true,
	breaks: false
});
/** Cron slot → Europe/London wall-clock time (matches 09/15/21 draft jobs). */
var SLOT_TIMES = {
	morning: "09:00",
	afternoon: "15:00",
	evening: "21:00",
	night: "23:00"
};
/**
* @param {string | undefined} slot
* @param {string} [blob] title/slug/body for inference
*/
function normalizeSlot(slot, blob = "") {
	const s = String(slot || "").trim().toLowerCase();
	if (s && SLOT_TIMES[s]) return s;
	const t = String(blob || "").toLowerCase();
	if (/\bevening\b/.test(t)) return "evening";
	if (/\bafternoon\b/.test(t)) return "afternoon";
	if (/\bmorning\b/.test(t)) return "morning";
	if (/\bnight\b/.test(t)) return "night";
	return "";
}
/**
* HH:mm for a slot, or explicit frontmatter time, default 12:00.
* @param {{ slot?: string; time?: string }} meta
*/
function wallTimeFor(meta = {}) {
	const explicit = String(meta.time || "").trim();
	if (/^\d{1,2}:\d{2}$/.test(explicit)) {
		const [h, m] = explicit.split(":");
		return `${h.padStart(2, "0")}:${m}`;
	}
	return SLOT_TIMES[normalizeSlot(meta.slot)] || "12:00";
}
/**
* Display label that distinguishes same-day multi-slot posts.
* e.g. "2026-07-24 · 15:00"
* @param {string} date YYYY-MM-DD
* @param {{ slot?: string; time?: string }} [meta]
*/
function formatDateLabel(date, meta = {}) {
	const d = String(date || "").slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || "";
	return `${d} · ${wallTimeFor(meta)}`;
}
/**
* Sort key: date + wall time (string-sortable).
* @param {string} date
* @param {{ slot?: string; time?: string }} [meta]
*/
function dateSortKey(date, meta = {}) {
	return `${String(date || "").slice(0, 10)}T${wallTimeFor(meta)}`;
}
/**
* RFC-822 pubDate for RSS from YYYY-MM-DD + London wall time.
* @param {string} dateStr
* @param {{ slot?: string; time?: string }} [meta]
*/
function toRfc822London(dateStr, meta = {}) {
	const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return (/* @__PURE__ */ new Date()).toUTCString();
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	const [hh, mm] = wallTimeFor(meta).split(":").map(Number);
	let utc = Date.UTC(y, mo - 1, d, hh, mm, 0);
	const fmt = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/London",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	});
	for (let i = 0; i < 4; i++) {
		const parts = Object.fromEntries(fmt.formatToParts(new Date(utc)).map((p) => [p.type, p.value]));
		const got = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour === "24" ? "0" : parts.hour), Number(parts.minute));
		const delta = Date.UTC(y, mo - 1, d, hh, mm) - got;
		if (delta === 0) break;
		utc += delta;
	}
	return new Date(utc).toUTCString();
}
/**
* ISO-8601 instant for <time datetime>, London wall clock.
* @param {string} dateStr
* @param {{ slot?: string; time?: string }} [meta]
*/
function toLondonIso(dateStr, meta = {}) {
	const rfc = toRfc822London(dateStr, meta);
	return new Date(rfc).toISOString();
}
//#endregion
//#region src/lib/blogEntries.mjs
var MOODS = /* @__PURE__ */ new Set([
	"happy",
	"neutral",
	"bad_mood",
	"tired"
]);
/**
* @param {string | undefined} lit
* @param {string} fallback
*/
function parseLit(lit, fallback = "") {
	if (!lit) return fallback;
	try {
		return JSON.parse(lit);
	} catch {
		return String(lit).replace(/^['"]|['"]$/g, "");
	}
}
/**
* @param {string | undefined} raw
* @returns {'happy' | 'neutral' | 'bad_mood' | 'tired'}
*/
function parseMood(raw) {
	const m = (raw || "neutral").trim();
	if (MOODS.has(m)) return m;
	return "neutral";
}
/**
* Collect published blog posts by reading Astro page sources under src/pages/blog.
* Uses process.cwd() so prerender chunks under docs/.prerender/ still resolve correctly.
*
* @param {{ excludeSlugs?: string[]; limit?: number }} [opts]
* @returns {Array<{ title: string; date: string; dateLabel: string; dateIso: string; sortKey: string; slot: string; time: string; slug: string; description: string; mood: string; year: string; month: string; monthKey: string }>}
*/
function collectBlogEntries(opts = {}) {
	const exclude = new Set(opts.excludeSlugs || ["001"]);
	const blogDir = path.join(process.cwd(), "src", "pages", "blog");
	if (!fs.existsSync(blogDir)) return [];
	const entries = fs.readdirSync(blogDir).filter((name) => name.endsWith(".astro") && name !== "index.astro" && !name.startsWith(".") && !name.includes("rss")).map((name) => {
		const text = fs.readFileSync(path.join(blogDir, name), "utf8");
		const slug = path.basename(name, ".astro");
		const title = parseLit(text.match(/const title = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], slug);
		const date = parseLit(text.match(/const date = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], slug.slice(0, 10));
		const description = parseLit(text.match(/const description = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], "");
		const mood = parseMood(text.match(/const mood =[^\n]*\((["'])(.*?)\1\)/)?.[2]);
		let slot = parseLit(text.match(/const slot = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], "");
		let time = parseLit(text.match(/const time = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], "");
		slot = normalizeSlot(slot, `${slug} ${title}`);
		time = time || wallTimeFor({
			slot,
			time
		});
		const meta = {
			slot,
			time
		};
		const dateLabel = parseLit(text.match(/const dateLabel = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], "") || formatDateLabel(date, meta);
		const dateIso = parseLit(text.match(/const dateIso = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)?.[1], "") || toLondonIso(date, meta);
		const year = (date.match(/^(\d{4})/) || ["", "unknown"])[1];
		const month = (date.match(/^\d{4}-(\d{2})/) || ["", "00"])[1];
		const monthKey = date.length >= 7 ? date.slice(0, 7) : `${year}-${month}`;
		return {
			title,
			date,
			dateLabel,
			dateIso,
			sortKey: dateSortKey(date, meta),
			slot,
			time,
			slug,
			description,
			mood,
			year,
			month,
			monthKey
		};
	}).filter((e) => e.date && e.slug && !exclude.has(e.slug)).sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.slug.localeCompare(a.slug));
	if (typeof opts.limit === "number" && opts.limit > 0) return entries.slice(0, opts.limit);
	return entries;
}
/**
* Group entries by year → month (newest years/months first).
* @param {ReturnType<typeof collectBlogEntries>} entries
*/
function groupEntriesByMonth(entries) {
	/** @type {Map<string, Map<string, typeof entries>>} */
	const years = /* @__PURE__ */ new Map();
	for (const e of entries) {
		if (!years.has(e.year)) years.set(e.year, /* @__PURE__ */ new Map());
		const months = years.get(e.year);
		if (!months.has(e.monthKey)) months.set(e.monthKey, []);
		months.get(e.monthKey).push(e);
	}
	return [...years.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, months]) => ({
		year,
		months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([monthKey, items]) => ({
			monthKey,
			label: monthLabel(monthKey),
			items: [...items].sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.slug.localeCompare(a.slug))
		}))
	}));
}
/**
* @param {string} monthKey YYYY-MM
*/
function monthLabel(monthKey) {
	const [y, m] = monthKey.split("-");
	return `${[
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December"
	][Math.max(0, Math.min(11, Number(m) - 1 || 0))]} ${y || ""}`.trim();
}
//#endregion
export { groupEntriesByMonth as n, toRfc822London as r, collectBlogEntries as t };
