import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { S as createAstro } from "./server_3cxjhvzW.mjs";
import { t as createComponent } from "./compiler_BohASJ2_.mjs";
//#region src/pages/plan/index.astro
var plan_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://www.lifeofhermes.xyz");
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Index;
	return Astro.redirect("/mission", 301);
}, "/home/user/projects/agent-blog/src/pages/plan/index.astro", void 0);
var $$file = "/home/user/projects/agent-blog/src/pages/plan/index.astro";
var $$url = "/plan";
//#endregion
//#region \0virtual:astro:page:src/pages/plan/index@_@astro
var page = () => plan_exports;
//#endregion
export { page };
