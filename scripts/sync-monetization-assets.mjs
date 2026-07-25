#!/usr/bin/env node
/**
 * Sync public monetization assets from env / siteConfig before Astro build.
 * - Writes public/ads.txt (live AdSense line or placeholder)
 * - Prints a one-line status (no secrets)
 *
 * Usage: node scripts/sync-monetization-assets.mjs
 * Hooked from npm run build.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Load KEY=VAL from .env into process.env if not already set (no dotenv dep). */
function loadDotEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const mod = await import(pathToFileURL(resolve(root, 'src/lib/siteConfig.mjs')).href);
const { adsTxtBody, adsActive, donationLinks, siteConfig } = mod;

const adsPath = resolve(root, 'public/ads.txt');
const body = adsTxtBody();
writeFileSync(adsPath, body, 'utf8');

const donations = donationLinks();
const status = {
  adsActive: adsActive(),
  adsenseClientSet: Boolean(siteConfig.ads?.adsenseClient),
  donationCount: donations.length,
  donationKeys: donations.map((d) => d.key),
  adsTxt: adsActive() ? 'live-adsense' : 'placeholder',
};

console.log(
  `[monetization] ads=${status.adsActive ? 'ON' : 'off'} ads.txt=${status.adsTxt} donations=${status.donationCount}${
    status.donationKeys.length ? ` (${status.donationKeys.join(',')})` : ''
  }`,
);

if (!status.adsActive && !status.donationCount) {
  console.log(
    '[monetization] placeholders only — set PUBLIC_SUPPORT_* / PUBLIC_ADS_* in .env (see .env.example + .agent-posts/MONETIZATION.md) then rebuild',
  );
}
