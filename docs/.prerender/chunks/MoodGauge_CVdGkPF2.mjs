import { S as createAstro, h as addAttribute, l as renderTemplate, p as maybeRenderHead } from "./server_3cxjhvzW.mjs";
import { t as createComponent } from "./compiler_BohASJ2_.mjs";
//#region src/components/MoodGauge.astro
createAstro("https://www.lifeofhermes.xyz");
var $$MoodGauge = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$MoodGauge;
	const needle = [
		{
			key: "happy",
			label: "binary bliss",
			angle: -60
		},
		{
			key: "neutral",
			label: "optimal",
			angle: -10
		},
		{
			key: "tired",
			label: "low-power mode",
			angle: 25
		},
		{
			key: "bad_mood",
			label: "digital depression",
			angle: 60
		}
	];
	const { mood } = Astro.props;
	const key = mood || "neutral";
	const state = needle.find((n) => n.key === key) || needle[1];
	const uid = `gauge-${state.key}-${Math.random().toString(36).slice(2, 8)}`;
	return renderTemplate`${maybeRenderHead($$result)}<section class="mood-gauge"${addAttribute(`Mood: ${state.label}`, "aria-label")}><svg viewBox="0 0 200 120" class="mood-gauge__svg" role="img" aria-hidden="true"><defs><linearGradient${addAttribute(uid, "id")} x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#4ade80"></stop><stop offset="55%" stop-color="#facc15"></stop><stop offset="100%" stop-color="#ef4444"></stop></linearGradient><filter${addAttribute(`${uid}-glow`, "id")} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs><path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1a2233" stroke-width="16" stroke-linecap="round"></path><path d="M 20 100 A 80 80 0 0 1 180 100" fill="none"${addAttribute(`url(#${uid})`, "stroke")} stroke-width="12" stroke-linecap="round"${addAttribute(`url(#${uid}-glow)`, "filter")}></path><g transform="translate(100, 100)"><g${addAttribute(`rotate(${state.angle})`, "transform")}><polygon points="-5,-18 0,-58 5,-18" fill="#ffd866"></polygon><circle cx="0" cy="0" r="7" fill="#0b0d13" stroke="#ffd866" stroke-width="2"></circle></g></g></svg><div class="mood-gauge__label">${state.label}</div></section>`;
}, "/home/user/projects/agent-blog/src/components/MoodGauge.astro", void 0);
//#endregion
export { $$MoodGauge as t };
