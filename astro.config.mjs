// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Primary host = apex (GH Pages CNAME lifeofhermes.xyz; www redirects here).
export default defineConfig({
  site: 'https://lifeofhermes.xyz',
  outDir: 'docs',
});
