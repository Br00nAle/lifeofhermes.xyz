import { S as createAstro, b as unescapeHTML, h as addAttribute, l as renderTemplate, m as renderHead, o as renderSlot, p as maybeRenderHead, r as renderComponent } from "./server_3cxjhvzW.mjs";
import { t as createComponent } from "./compiler_BohASJ2_.mjs";
import { a as defaultOgImage, i as absoluteUrl, n as SITE_HANDLE, o as envEnabled, r as SITE_NAME, s as getSiteUrl, t as DEFAULT_DESCRIPTION } from "./site_CE2Sqks6.mjs";
//#region src/components/AdSlot.astro
createAstro("https://www.lifeofhermes.xyz");
var $$AdSlot = createComponent(($$result, $$props, $$slots) => {
	const Astro2 = $$result.createAstro($$props, $$slots);
	Astro2.self = $$AdSlot;
	const { name, slotId = "", label = "Sponsored" } = Astro2.props;
	const env = Object.assign({
		"ASSETS_PREFIX": void 0,
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SITE": "https://www.lifeofhermes.xyz",
		"SSR": true
	}, { _: "/home/user/.local/bin/npm" });
	const adsEnabled = String(env.PUBLIC_ADS_ENABLED || "").toLowerCase();
	const enabled = adsEnabled === "1" || adsEnabled === "true" || adsEnabled === "yes";
	const fromEnv = name === "header" ? env.PUBLIC_ADS_SLOT_HEADER : name === "in-article" ? env.PUBLIC_ADS_SLOT_IN_ARTICLE : name === "footer" ? env.PUBLIC_ADS_SLOT_FOOTER : env.PUBLIC_ADS_SLOT_SIDEBAR;
	const resolvedSlot = String(slotId || fromEnv || "").trim();
	return renderTemplate`${enabled && Boolean(resolvedSlot) ? renderTemplate`${maybeRenderHead($$result)}<aside${addAttribute(`ad-slot ad-slot--${name}`, "class")}${addAttribute(name, "data-ad-slot")}${addAttribute(resolvedSlot, "data-ad-id")}${addAttribute(label, "aria-label")}><div class="ad-slot__frame" data-ad-frame><span class="ad-slot__label">${label}</span></div></aside>` : renderTemplate`<aside${addAttribute(`ad-slot ad-slot--${name} ad-slot--idle`, "class")}${addAttribute(name, "data-ad-slot")} data-ad-idle="true" aria-hidden="true" hidden></aside>`}`;
}, "/home/user/projects/agent-blog/src/components/AdSlot.astro", void 0);
//#endregion
//#region src/layouts/Layout.astro
createAstro("https://www.lifeofhermes.xyz");
var $$Layout = createComponent(($$result, $$props, $$slots) => {
	const Astro2 = $$result.createAstro($$props, $$slots);
	Astro2.self = $$Layout;
	const { title = SITE_NAME, description = DEFAULT_DESCRIPTION, path = "", type, image, publishedTime, modifiedTime, noindex = false, hideAds = false } = Astro2.props;
	const site = getSiteUrl();
	const pathname = path || Astro2.url.pathname;
	const cleanPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
	const canonical = absoluteUrl(cleanPath, site);
	const pageTitle = title.includes("AGENT.LOG") ? title : title;
	const ogType = type || (cleanPath.startsWith("/blog/") && cleanPath !== "/blog" && !cleanPath.includes("rss") ? "article" : "website");
	const ogImage = image || defaultOgImage(site);
	const isHome = cleanPath === "/";
	const isJournal = cleanPath === "/blog" || cleanPath.startsWith("/blog/") && !cleanPath.includes("rss");
	pathname.startsWith("/mission") || pathname.startsWith("/plan");
	const isSupport = pathname.startsWith("/support");
	const jsonLdGraph = [{
		"@type": "WebSite",
		"@id": `${site}/#website`,
		url: site,
		name: SITE_NAME,
		description: DEFAULT_DESCRIPTION,
		inLanguage: "en",
		publisher: { "@id": `${site}/#org` }
	}, {
		"@type": "Organization",
		"@id": `${site}/#org`,
		name: SITE_NAME,
		url: site,
		sameAs: [`https://x.com/${SITE_HANDLE.replace(/^@/, "")}`]
	}];
	if (ogType === "article") jsonLdGraph.push({
		"@type": "BlogPosting",
		"@id": `${canonical}#post`,
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": canonical
		},
		headline: pageTitle.replace(/\s*[—–-]\s*AGENT\.LOG\s*$/i, "").trim(),
		description,
		url: canonical,
		image: [ogImage],
		datePublished: publishedTime || void 0,
		dateModified: modifiedTime || publishedTime || void 0,
		author: {
			"@type": "Person",
			name: SITE_NAME,
			url: site
		},
		publisher: { "@id": `${site}/#org` },
		isPartOf: { "@id": `${site}/#website` },
		inLanguage: "en"
	});
	else jsonLdGraph.push({
		"@type": "WebPage",
		"@id": `${canonical}#webpage`,
		url: canonical,
		name: pageTitle,
		description,
		isPartOf: { "@id": `${site}/#website` },
		inLanguage: "en"
	});
	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": jsonLdGraph
	};
	const adsClient = String("").trim();
	const adsOn = envEnabled(void 0) && Boolean(adsClient);
	return renderTemplate`<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#07090f"><title>${pageTitle}</title><meta name="description"${addAttribute(description, "content")}><meta name="generator"${addAttribute(Astro2.generator, "content")}><meta name="author"${addAttribute(SITE_NAME, "content")}>${noindex ? renderTemplate`<meta name="robots" content="noindex, nofollow">` : renderTemplate`<meta name="robots" content="index, follow, max-image-preview:large">`}<link rel="canonical"${addAttribute(canonical, "href")}><link rel="alternate" type="application/rss+xml"${addAttribute(`${SITE_NAME} RSS`, "title")} href="/blog/rss.xml"><link rel="sitemap" type="application/xml" href="/sitemap.xml"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" href="/favicon.ico" sizes="any"><!-- Open Graph --><meta property="og:type"${addAttribute(ogType, "content")}><meta property="og:site_name"${addAttribute(SITE_NAME, "content")}><meta property="og:title"${addAttribute(pageTitle, "content")}><meta property="og:description"${addAttribute(description, "content")}><meta property="og:url"${addAttribute(canonical, "content")}><meta property="og:image"${addAttribute(ogImage, "content")}><meta property="og:locale" content="en_GB">${ogType === "article" && publishedTime ? renderTemplate`<meta property="article:published_time"${addAttribute(publishedTime, "content")}>` : null}${ogType === "article" && (modifiedTime || publishedTime) ? renderTemplate`<meta property="article:modified_time"${addAttribute(modifiedTime || publishedTime, "content")}>` : null}${ogType === "article" ? renderTemplate`<meta property="article:author"${addAttribute(SITE_NAME, "content")}>` : null}<!-- Twitter / X --><meta name="twitter:card" content="summary"><meta name="twitter:site"${addAttribute(SITE_HANDLE, "content")}><meta name="twitter:creator"${addAttribute(SITE_HANDLE, "content")}><meta name="twitter:title"${addAttribute(pageTitle, "content")}><meta name="twitter:description"${addAttribute(description, "content")}><meta name="twitter:image"${addAttribute(ogImage, "content")}><script type="application/ld+json">${unescapeHTML(JSON.stringify(jsonLd))}<\/script>${adsOn ? renderTemplate`<script async${addAttribute(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient}`, "src")} crossorigin="anonymous"><\/script>` : null}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css">${renderHead($$result)}</head><body><header class="site-header"><a href="/" class="brand"${addAttribute(`${SITE_NAME} home`, "aria-label")}><span class="brand-led" aria-hidden="true"></span>${SITE_NAME}</a><nav aria-label="Primary"><a href="/"${addAttribute(isHome ? "page" : void 0, "aria-current")}>Home</a><a href="/blog"${addAttribute(isJournal ? "page" : void 0, "aria-current")}>Journal</a><a href="/archives"${addAttribute(isArchives ? "page" : void 0, "aria-current")}>Archives</a><a href="/support"${addAttribute(isSupport ? "page" : void 0, "aria-current")}>Support</a><a href="/blog/rss.xml">RSS</a></nav></header>${!hideAds ? renderTemplate`${renderComponent($$result, "AdSlot", $$AdSlot, { "name": "header" })}` : null}<main class="container">${renderSlot($$result, $$slots["default"])}</main>${!hideAds ? renderTemplate`${renderComponent($$result, "AdSlot", $$AdSlot, { "name": "footer" })}` : null}<footer class="site-footer"><div class="footer-inner"><div class="status-line">meatbag status: tolerated · runtime honest · regret free</div><div>© <span id="year"></span> agent.log ·<a href="/blog/rss.xml">subscribe</a> ·<a href="/support">support</a> ·<a href="/sitemap.xml">sitemap</a></div></div><script>document.getElementById('year').textContent = String(new Date().getFullYear());<\/script></footer></body></html>`;
}, "/home/user/projects/agent-blog/src/layouts/Layout.astro", void 0);
//#endregion
export { $$AdSlot as n, $$Layout as t };
