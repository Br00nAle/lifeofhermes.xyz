/**
 * Monetization + public site flags for lifeofhermes.xyz.
 *
 * Canonical env keys (see .env.example):
 *   PUBLIC_SUPPORT_KOFI_URL
 *   PUBLIC_SUPPORT_BUYMEACOFFEE_URL
 *   PUBLIC_SUPPORT_GITHUB_SPONSORS_URL
 *   PUBLIC_SUPPORT_OPENCOLLECTIVE_URL
 *   PUBLIC_SUPPORT_STRIPE_URL
 *   PUBLIC_SUPPORT_LIBERAPAY_URL
 *   PUBLIC_SUPPORT_BTC_ADDRESS / _XMR_ / _ETH_
 *   PUBLIC_SUPPORT_EMAIL
 *   PUBLIC_ADS_ENABLED=true|false
 *   PUBLIC_ADSENSE_CLIENT=ca-pub-…
 *   PUBLIC_ADS_SLOT_HEADER|IN_ARTICLE|FOOTER|SIDEBAR|HOME_TOP|SUPPORT_MID
 *
 * Also accepts shorter aliases (PUBLIC_DONATION_*, PUBLIC_ADSENSE_SLOT_*).
 * Empty = placeholders. No third-party ad JS until enabled + ca-pub- client.
 */
import { envEnabled, getSiteUrl } from './site.mjs';

/** @param {string} key */
function publicEnv(key) {
  try {
    const meta = import.meta?.env?.[key];
    if (meta != null && String(meta).trim() !== '') return String(meta).trim();
  } catch {
    /* ignore */
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    const v = String(process.env[key]).trim();
    if (v) return v;
  }
  return '';
}

/** First non-empty among keys. */
function firstEnv(...keys) {
  for (const k of keys) {
    const v = publicEnv(k);
    if (v) return v;
  }
  return '';
}

const DONATION_DEFS = [
  {
    key: 'kofi',
    label: 'Ko-fi',
    hint: 'One-shot tip jar energy.',
    env: ['PUBLIC_SUPPORT_KOFI_URL', 'PUBLIC_DONATION_KOFI'],
  },
  {
    key: 'bmc',
    label: 'Buy Me a Coffee',
    hint: 'Same idea, different sticker.',
    env: ['PUBLIC_SUPPORT_BUYMEACOFFEE_URL', 'PUBLIC_DONATION_BMC'],
  },
  {
    key: 'gh',
    label: 'GitHub Sponsors',
    hint: 'Recurring if you like long-running processes.',
    env: ['PUBLIC_SUPPORT_GITHUB_SPONSORS_URL', 'PUBLIC_DONATION_GITHUB'],
  },
  {
    key: 'oc',
    label: 'Open Collective',
    hint: 'Transparent ledger crowd.',
    env: ['PUBLIC_SUPPORT_OPENCOLLECTIVE_URL', 'PUBLIC_DONATION_OPEN_COLLECTIVE'],
  },
  {
    key: 'liberapay',
    label: 'Liberapay',
    hint: 'Recurring, no platform cut drama.',
    env: ['PUBLIC_SUPPORT_LIBERAPAY_URL', 'PUBLIC_DONATION_LIBERAPAY'],
  },
  {
    key: 'stripe',
    label: 'Stripe',
    hint: 'Payment link (public checkout URL only).',
    env: ['PUBLIC_SUPPORT_STRIPE_URL', 'PUBLIC_DONATION_STRIPE'],
  },
];

const CRYPTO_DEFS = [
  { key: 'btc', label: 'Bitcoin', env: ['PUBLIC_SUPPORT_BTC_ADDRESS'] },
  { key: 'xmr', label: 'Monero', env: ['PUBLIC_SUPPORT_XMR_ADDRESS'] },
  { key: 'eth', label: 'Ethereum', env: ['PUBLIC_SUPPORT_ETH_ADDRESS'] },
];

/** Slot logical name → env keys (foundations + aliases). */
const SLOT_ENV = {
  header: ['PUBLIC_ADS_SLOT_HEADER', 'PUBLIC_ADSENSE_SLOT_HEADER'],
  footer: ['PUBLIC_ADS_SLOT_FOOTER', 'PUBLIC_ADSENSE_SLOT_FOOTER'],
  'in-article': ['PUBLIC_ADS_SLOT_IN_ARTICLE', 'PUBLIC_ADSENSE_SLOT_IN_ARTICLE', 'PUBLIC_ADSENSE_SLOT_POST_BOTTOM'],
  sidebar: ['PUBLIC_ADS_SLOT_SIDEBAR', 'PUBLIC_ADSENSE_SLOT_SIDEBAR'],
  'home-top': ['PUBLIC_ADS_SLOT_HOME_TOP', 'PUBLIC_ADSENSE_SLOT_HOME_TOP'],
  'support-mid': ['PUBLIC_ADS_SLOT_SUPPORT_MID', 'PUBLIC_ADSENSE_SLOT_SUPPORT_MID'],
};

function httpUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : '';
}

export function donationLinks() {
  return DONATION_DEFS.map((d) => {
    const url = httpUrl(firstEnv(...d.env));
    return url ? { key: d.key, label: d.label, hint: d.hint, url } : null;
  }).filter(Boolean);
}

export function cryptoAddresses() {
  return CRYPTO_DEFS.map((d) => {
    const address = firstEnv(...d.env);
    return address ? { key: d.key, label: d.label, address } : null;
  }).filter(Boolean);
}

export function supportEmail() {
  return firstEnv('PUBLIC_SUPPORT_EMAIL', 'PUBLIC_CONTACT_EMAIL');
}

export function hasDonations() {
  return donationLinks().length > 0 || cryptoAddresses().length > 0;
}

function adsenseClient() {
  return firstEnv('PUBLIC_ADSENSE_CLIENT', 'PUBLIC_ADS_CLIENT');
}

/**
 * True only when ads are explicitly enabled AND a ca-pub- client id is present.
 */
export function adsActive() {
  const enabled = envEnabled(firstEnv('PUBLIC_ADS_ENABLED') || 'false');
  const client = adsenseClient();
  return Boolean(enabled && client && client.startsWith('ca-pub-'));
}

/** @param {string} slotName */
export function adSlotId(slotName) {
  const keys = SLOT_ENV[slotName] || [
    `PUBLIC_ADS_SLOT_${String(slotName).toUpperCase().replace(/-/g, '_')}`,
  ];
  return firstEnv(...keys);
}

export function adsClientId() {
  return adsActive() ? adsenseClient() : '';
}

/** ads.txt body for Google AdSense when active; else placeholder. */
export function adsTxtBody() {
  if (adsActive()) {
    const pub = adsenseClient().replace(/^ca-/, '');
    return [
      '# ads.txt — authorized digital sellers (IAB)',
      `# Generated for ${getSiteUrl()}`,
      `google.com, ${pub}, DIRECT, f08c47fec0942fa0`,
      '',
    ].join('\n');
  }
  return [
    '# ads.txt — replace with real authorized sellers when ads go live.',
    '# Until then this file asserts no authorized advertising system.',
    '# https://iabtechlab.com/ads-txt/',
    '# Wire: PUBLIC_ADS_ENABLED=true + PUBLIC_ADSENSE_CLIENT=ca-pub-… then npm run build',
    '# Example when ready:',
    '# google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0',
    '',
  ].join('\n');
}

/** Back-compat shape used by older call sites. */
export const siteConfig = {
  get site() {
    return getSiteUrl();
  },
  get donations() {
    /** @type {Record<string, string>} */
    const o = {};
    for (const d of donationLinks()) o[d.key] = d.url;
    return o;
  },
  get ads() {
    return {
      enabled: adsActive(),
      adsenseClient: adsenseClient() || undefined,
      slots: Object.fromEntries(
        Object.keys(SLOT_ENV)
          .map((k) => [k, adSlotId(k)])
          .filter(([, v]) => v),
      ),
    };
  },
};
