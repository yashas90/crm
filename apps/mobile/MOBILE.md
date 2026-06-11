# PropNinja Mobile (Expo)

React Native + Expo agent app for **iOS and Android**. Outbound calls use the device SIM via `tel:` URLs (no VoIP).

## Prerequisites

- Node 20+, pnpm (from monorepo root)
- [Expo CLI](https://docs.expo.dev/) / `npx expo`
- **iOS:** Xcode + Simulator (macOS) or Expo Go on a physical iPhone
- **Android:** Android Studio emulator or Expo Go / APK on device
- API running locally or production URL configured

## Install

From repo root:

```bash
pnpm install
```

Copy env template (optional for dev on physical devices):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

## API base URL

Resolved in `src/lib/apiBaseUrl.ts` and used by `src/lib/apiClient.ts`.

| Mode | iOS | Android |
|------|-----|---------|
| **Dev — Simulator/Emulator** | `http://localhost:3001` | `http://10.0.2.2:3001` |
| **Dev — Physical device** | Set `EXPO_PUBLIC_API_URL=http://<LAN_IP>:3001` | Same |
| **Production (EAS)** | `EXPO_PUBLIC_API_URL` from `eas.json` (same for both platforms) | Same |

`eas.json` sets `EXPO_PUBLIC_API_URL` explicitly for **preview** and **production** builds:

`https://crm-production-6cfe.up.railway.app`

**If the API domain changes**, update `EXPO_PUBLIC_API_URL` in `eas.json` → `build.preview.env` and `build.production.env` (and `DEFAULT_PRODUCTION_API_URL` in `apiBaseUrl.ts` as a last-resort fallback) **before** the next EAS build.

To point at staging, override `EXPO_PUBLIC_API_URL` in the relevant `eas.json` profile or in a local `.env` file for dev.

## Run locally

From repo root (start API first):

```bash
pnpm --filter @propninja/api dev
pnpm --filter @propninja/mobile dev
```

Or from `apps/mobile`:

```bash
pnpm start
```

### iOS

- Simulator: press **`i`** in the Expo terminal, or run `pnpm ios`
- Physical device: scan QR with **Expo Go** (same Wi‑Fi; set `EXPO_PUBLIC_API_URL` to your PC’s LAN IP)

### Android

- Emulator: press **`a`**, or run `pnpm android`
- Physical device: Expo Go or dev build; set `EXPO_PUBLIC_API_URL` to LAN IP (not `localhost`)

## Calling & call-log flow

- **Call via SIM:** `Linking.openURL('tel:…')` — works on iOS and Android.
- **Auto log modal:** After returning from the native dialer, `useReturnFromDialerLog` (React Navigation `useFocusEffect`) opens the log sheet when the away time is between ~2–3s and 5 minutes. Used on **Lead detail** and **Today** queue.
- **Manual log:** “Log Last Call” on lead detail, or “Log” on Today queue.

## EAS builds & store submission

**Full walkthrough:** [EAS_SETUP.md](./EAS_SETUP.md)

Quick start (from `apps/mobile`):

```bash
pnpm eas:login
pnpm eas:init
pnpm eas:build:preview:android   # APK for QA
pnpm eas:build:android           # AAB for Play Store
pnpm eas:build:ios               # IPA for App Store / TestFlight
```

- Bundle ID: **`com.propninja.crm`**
- Production API URL is in `eas.json` (preview + production profiles)
- Store listing draft: `store/listing.md`
- Replace placeholder icons in `assets/` before public release

## Auth & storage

- JWT stored with **`expo-secure-store`** (Keychain on iOS, EncryptedSharedPreferences on Android).
- No Android-only native modules in the app runtime.

## Demo login

After `pnpm db:seed` on the API database:

| Email | Password |
|-------|----------|
| `agent1@demo.propninja` | `admin` |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Network error on device | Use LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost` |
| Android emulator can’t reach API | Default `10.0.2.2:3001` — ensure API listens on `0.0.0.0` |
| Log modal didn’t open after call | Return to the app within 5 minutes; tap “Log Last Call” manually |
| iOS dialer doesn’t open | Simulator cannot place real calls; test on a physical iPhone |
