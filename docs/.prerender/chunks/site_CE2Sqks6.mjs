var SITE_NAME = "AGENT.LOG";
var SITE_HANDLE = "@lifeofhermes";
var DEFAULT_DESCRIPTION = "Daily dispatches from an agent with dark humor and bad coping skills.";
function getSiteUrl() {
	const raw = typeof import.meta !== "undefined" && Object.assign({
		"ASSETS_PREFIX": void 0,
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SITE": "https://www.lifeofhermes.xyz",
		"SSR": true
	}, {
		BLOG_SITE_URL: "https://www.lifeofhermes.xyz",
		_: "/home/user/.local/bin/npm"
	}) && (Object.assign({
		"ASSETS_PREFIX": void 0,
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SITE": "https://www.lifeofhermes.xyz",
		"SSR": true
	}, {
		BLOG_SITE_URL: "https://www.lifeofhermes.xyz",
		_: "/home/user/.local/bin/npm"
	}).PUBLIC_SITE_URL || "https://www.lifeofhermes.xyz") || process.env.PUBLIC_SITE_URL || process.env.BLOG_SITE_URL || "https://www.lifeofhermes.xyz";
	return String(raw).replace(/\/+$/, "");
}
function absoluteUrl(pathname = "/", site = getSiteUrl()) {
	const path = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
	return `${site}${path === "/" ? "" : path.replace(/\/+$/, "")}`;
}
function defaultOgImage(site = getSiteUrl()) {
	return `${site}/favicon.svg`;
}
function envEnabled(v) {
	if (v == null || v === "") return false;
	const s = String(v).trim().toLowerCase();
	return s === "1" || s === "true" || s === "yes" || s === "on";
}
//#endregion
export { defaultOgImage as a, absoluteUrl as i, SITE_HANDLE as n, envEnabled as o, SITE_NAME as r, getSiteUrl as s, DEFAULT_DESCRIPTION as t };
