# EAS setup — PropNinja Mobile

Step-by-step guide to link Expo, build store-ready binaries, and submit to Google Play / App Store.

**Run all commands from `apps/mobile`** unless noted.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Node 20+ | Matches monorepo `engines` |
| pnpm 9+ | `corepack enable` (root has `packageManager`) |
| Expo account | Free at [expo.dev/signup](https://expo.dev/signup) |
| Git repo at monorepo root | EAS uploads from `apps/mobile` but needs root `pnpm-lock.yaml` |
| Production API live | `https://crm-production-6cfe.up.railway.app` (set in `eas.json`) |

**Store accounts (for submit only):**

- **Android:** Google Play Console ($25 one-time)
- **iOS:** Apple Developer Program ($99/year)

---

## Step 1 — Install dependencies

From repo root (after `nodeLinker: hoisted` in `pnpm-workspace.yaml`):

```bash
pnpm install
```

---

## Step 2 — Log in to Expo

```bash
cd apps/mobile
pnpm eas:login
```

Or use a CI token: set `EXPO_TOKEN` from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).

---

## Step 3 — Link EAS project (`eas init`)

```bash
pnpm eas:init
```

This will:

1. Create or link an Expo project for slug `propninja-crm`
2. Write `EAS_PROJECT_ID` into `apps/mobile/.env` (gitignored)

Verify:

```bash
pnpm exec expo config --type public | findstr projectId
```

`extra.eas.projectId` must **not** be `undefined`.

Optional: set `EXPO_OWNER` in `.env` if the app lives under an Expo organization.

---

## Step 4 — Configure signing (first build)

EAS can generate credentials for you on the first build.

### Android

On first `eas build --platform android`, choose **Let EAS handle credentials**.

- **Production** → **AAB** (Google Play)
- **Preview** → **APK** (sideload / internal testers)

### iOS

Requires Apple Developer account. On first iOS build, EAS prompts for:

- Apple ID
- Team ID
- Distribution certificate + provisioning profile (auto-generated)

---

## Step 5 — Build

### Production (store submission)

```bash
# Android AAB (Play Store)
pnpm eas:build:android

# iOS IPA (App Store / TestFlight)
pnpm eas:build:ios
```

### Preview (internal testing)

```bash
# Installable APK — share link from Expo dashboard
pnpm eas:build:preview:android
```

Monitor builds: [expo.dev](https://expo.dev) → your project → Builds.

---

## Step 6 — Test before submit

Download the build artifact and verify on a **physical device**:

- [ ] Login with a real org user (not demo if disabled in prod)
- [ ] Leads list loads
- [ ] Lead detail opens
- [ ] `tel:` opens native dialer
- [ ] Return to app → call log modal (or manual “Log Last Call”)
- [ ] Today queue works
- [ ] Logout / login again (secure token storage)

---

## Step 7 — Store listings

Draft copy is in [`store/listing.md`](./store/listing.md).

Before submit:

1. **Privacy policy** — host at `https://www.ninjamarketing.in/privacy` (or update `EXPO_PUBLIC_PRIVACY_POLICY_URL`)
2. **Screenshots** — phone + tablet (iOS), phone (Android); capture from preview build
3. **Icons** — replace placeholders in `assets/` if needed (1024×1024 icon, adaptive icon)

---

## Step 8 — Submit to stores

### Google Play

1. Play Console → Create app → package `com.propninja.crm`
2. Setup → API access → Create service account → download JSON
3. Save as `store/google-service-account.json` (gitignored)
4. Submit:

```bash
pnpm eas:submit:android
```

First run is interactive; later you can add `serviceAccountKeyPath` to `eas.json` → `submit.production.android`.

Default track: **internal** (draft). Change in `eas.json` when ready for production.

### App Store / TestFlight

1. App Store Connect → New app → bundle ID `com.propninja.crm`
2. Create App Store Connect API key → save `.p8` to `store/` (gitignored)
3. Submit:

```bash
pnpm eas:submit:ios
```

See [`store/submit.env.example`](./store/submit.env.example) for credential env vars.

---

## Build profiles (`eas.json`)

| Profile | Android output | Distribution | Use case |
|---------|----------------|--------------|----------|
| `development` | Dev client (simulator) | Internal | Local debugging with native modules |
| `preview` | **APK** | Internal | QA / sideload |
| `production` | **APK** | Internal | Internal testing (current) |

`EXPO_PUBLIC_API_URL` is baked in at build time for preview + production.

When you are ready for store submission, switch `build.production` back to `distribution: store` and use Android **AAB** + iOS submission (see Step 8).

---

## Monorepo notes

- **Git root** must be `propninjacrm/` (not `apps/mobile`)
- **`pnpm-lock.yaml`** must be committed at repo root
- **`eas-build-pre-install`** runs `corepack enable` before install on EAS servers
- **`nodeLinker: hoisted`** in `pnpm-workspace.yaml` avoids pnpm isolated-deps issues with Expo SDK 53

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `projectId` undefined | Run `pnpm eas:init`; set `EAS_PROJECT_ID` in `.env` |
| `Not logged in` | `pnpm eas:login` or set `EXPO_TOKEN` |
| `lock file not found` on EAS | Ensure `pnpm-lock.yaml` is committed; git root is monorepo root |
| Network error on release build | Rebuild after confirming `eas.json` `EXPO_PUBLIC_API_URL` |
| Metro can't find `App` | Use `index.js` entry + `metro.config.js` (already configured) |
| iOS export compliance | `usesNonExemptEncryption: false` is set in `app.config.ts` |

---

## Quick reference

```bash
cd apps/mobile
pnpm eas:login
pnpm eas:init
pnpm eas:build:preview:android   # APK for testing
pnpm eas:build:android           # AAB for Play Store
pnpm eas:build:ios               # IPA for App Store
pnpm eas:submit:android
pnpm eas:submit:ios
```
