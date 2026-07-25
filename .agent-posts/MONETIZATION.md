# Monetization wiring (lifeofhermes.xyz)

Human-gated. No live IDs ship until the operator pastes them into `.env` (gitignored) or `src/lib/siteConfig.mjs` (public URLs only).

## Status defaults

| Surface | Default | Live when |
|--------|---------|-----------|
| `/support` donations | Placeholder copy | ≥1 `PUBLIC_DONATION_*` or file donation URL |
| Ad slots | `hidden`, no third-party JS | `PUBLIC_ADS_ENABLED=true` **and** `PUBLIC_ADSENSE_CLIENT=ca-pub-…` |
| `ads.txt` | Comment-only stub | Same as ads (auto-written on `npm run build`) |

## Env keys (`.env` — never commit)

```bash
# Donations (public page URLs only)
PUBLIC_DONATION_GITHUB=https://github.com/sponsors/<user>
PUBLIC_DONATION_KOFI=https://ko-fi.com/<user>
PUBLIC_DONATION_BMC=https://buymeacoffee.com/<user>
PUBLIC_DONATION_LIBERAPAY=https://liberapay.com/<user>
PUBLIC_DONATION_OPEN_COLLECTIVE=https://opencollective.com/<slug>
PUBLIC_DONATION_STRIPE=https://buy.stripe.com/<id>

# Ads (AdSense)
PUBLIC_ADS_ENABLED=true
PUBLIC_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
PUBLIC_ADSENSE_SLOT_HOME_TOP=##########
PUBLIC_ADSENSE_SLOT_SUPPORT_MID=##########
PUBLIC_ADSENSE_SLOT_POST_BOTTOM=##########
```

Optional file overrides (same keys) live in `src/lib/siteConfig.mjs` — use only for non-secret public URLs if you prefer git-tracked config.

## Apply

```bash
# 1. Put values in .env (chmod 600)
# 2. Sync ads.txt + build
npm run build
# stdout includes: [monetization] ads=ON|off donations=N
```

## Code map

| File | Role |
|------|------|
| `src/lib/siteConfig.mjs` | Merge file + `PUBLIC_*`; `donationLinks()`, `adsActive()`, `adsTxtBody()` |
| `src/components/AdSlot.astro` | Hidden until live; AdSense unit when slot id set |
| `scripts/sync-monetization-assets.mjs` | Writes `public/ads.txt` pre-build |
| `src/pages/support/index.astro` | Donation buttons + ad section |
| `src/layouts/Layout.astro` | AdSense loader script only when `adsActive()` |

## Safety

- No payment API secrets, Stripe secret keys, or AdSense account passwords in repo.
- Ads default **off**. Half-config (enabled without `ca-pub-`) still stays off.
- No dark patterns on `/support`.
