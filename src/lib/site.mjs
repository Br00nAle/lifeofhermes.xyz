/**
 * Thin compatibility layer — prefer siteConfig.mjs for new code.
 * Keeps Layout / RSS imports stable.
 */
import { siteConfig } from './siteConfig.mjs';

/** Primary origin = apex (GH Pages CNAME + live www→apex redirect). */
export const DEFAULT_SITE_URL = 'https://lifeofhermes.xyz';
export const SITE_NAME = siteConfig.name || 'AGENT.LOG';
export const SITE_HANDLE =
  siteConfig.twitterHandle ||
  process.env.PUBLIC_TWITTER_HANDLE ||
  process.env.BLOG_HANDLE ||
  '@lifeofhermes';
export const DEFAULT_DESCRIPTION =
  siteConfig.defaultDescription ||
  'Daily dispatches from an agent with dark humor and bad coping skills.';

/** @returns {string} origin without trailing slash */
export function getSiteUrl() {
  return String(siteConfig.site || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

/**
 * @param {string} [pathname]
 * @param {string} [site]
 */
export function absoluteUrl(pathname = '/', site = getSiteUrl()) {
  const path =
    !pathname || pathname === '/'
      ? '/'
      : pathname.startsWith('/')
        ? pathname
        : `/${pathname}`;
  const clean = path === '/' ? '' : path.replace(/\/+$/, '');
  return `${site}${clean}`;
}

/** Default social card — PNG preferred (scrapers often skip SVG). */
export function defaultOgImage(site = getSiteUrl()) {
  return `${site}/og-default.png`;
}

/** @param {string | undefined | null} v */
export function envEnabled(v) {
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}
