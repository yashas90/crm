# Certificate pinning (PropNinja mobile)

The mobile app pins the Railway API TLS public key using [`react-native-ssl-public-key-pinning`](https://github.com/frw/react-native-ssl-public-key-pinning). Pinning is initialized in `apps/mobile/index.js` before any network requests.

## Current pins

Host: `crm-production-6cfe.up.railway.app` (and subdomains via `includeSubdomains: true`)

| Role | SPKI SHA-256 (base64) |
|------|------------------------|
| Leaf (Railway) | `sGDbTDZa6e6YT2TE9XG0KNYPBuV/4YoqFrebzjQs1Ss=` |
| Backup (Let's Encrypt E7) | `y7xVm0TVJNahMr2sZydE2jQH8SquXV9yLF9seROHHHU=` |

Pins live in `apps/mobile/src/lib/sslPinning.ts`. Override at build time with `EXPO_PUBLIC_API_CERT_SHA256` (comma-separated base64 hashes).

## When to rotate

Railway uses Let's Encrypt certificates that renew about every **90 days**. Set a calendar reminder to verify pins **two weeks before** the known expiry date.

1. Run the pin extraction script (from repo root):

```bash
node scripts/mobile-extract-cert-pin.js crm-production-6cfe.up.railway.app
```

2. Update `RAILWAY_PUBLIC_KEY_HASHES` in `sslPinning.ts` with the new leaf hash.
3. Keep at least **two** hashes (leaf + issuer/intermediate) so renewals do not brick the app.
4. Ship a new mobile build via EAS **before** the old certificate expires.
5. Test on a production build (pinning is skipped in Expo Go).

## Disabling pinning locally

Set `EXPO_PUBLIC_DISABLE_SSL_PINNING=1` for development builds when debugging MITM tools. Never disable in production builds.

## Verification

1. Build a release/preview app with EAS.
2. Confirm API calls succeed against production.
3. Temporarily replace a pin with a dummy hash, rebuild, and confirm requests fail (proves pinning is active).

## Notes

- Pinning requires a **development or production build** — not Expo Go.
- iOS caches TLS sessions; restart the app after changing pins during testing.
- `expo-dev-client` may bypass pinning in debug mode; validate on release builds.
