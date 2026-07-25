// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// site is used for absolute URLs; public site is www (cert/CNAME).
export default defineConfig({
  site: 'https://www.lifeofhermes.xyz',
  outDir: 'docs',
});
