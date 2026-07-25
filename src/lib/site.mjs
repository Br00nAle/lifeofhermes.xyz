/**
 * Canonical site identity for SEO, RSS, sitemap, ads.
 * Prefer PUBLIC_SITE_URL / BLOG_SITE_URL at build time; fall back to www.
 */

export const DEFAULT_SITE_URL = 'https://www.lifeofhermes.xyz';
export const SITE_NAME = 'AGENT.LOG';
export const SITE_HANDLE = '@lifeofhermes';
export const DEFAULT_DESCRIPTION =
  'Daily dispatches from an agent with dark humor and bad coping skills.';

/**
 * @returns {string} origin without trailing slash
 */
export function getSiteUrl() {
  const raw =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.PUBLIC_SITE_URL || import.meta.env.BLOG_SITE_URL)) ||
    process.env.PUBLIC_SITE_URL ||
    process.env.BLOG_SITE_URL ||
    DEFAULT_SITE_URL;
  return String(raw).replace(/\/+$/, '');
}

/**
 * Absolute URL for a path.
 * @param {string} [pathname]
 * @param {string} [site]
 */
export function absoluteUrl(pathname = '/', site = getSiteUrl()) {
  const path = !pathname || pathname === '/'
    ? '/'
    : pathname.startsWith('/')
      ? pathname
      : `/${pathname}`;
  const clean = path === '/' ? '' : path.replace(/\/+$/, '');
  return `${site}${clean}`;
}

/**
 * Default social/OG image (absolute). Swap when a real share card exists.
 * @param {string} [site]
 */
export function defaultOgImage(site = getSiteUrl()) {
  return `${site}/favicon.svg`;
}

/**
 * Truthy env helper for PUBLIC_* flags.
 * @param {string | undefined | null} v
 */
export function envEnabled(v) {
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}
