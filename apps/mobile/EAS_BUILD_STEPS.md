# EAS build steps — PropNinja Mobile

Run all commands from `c:\Users\Admin\Desktop\propninjacrm\apps\mobile`.

## 1) Log in to Expo / EAS

```bash
pnpm eas:login
```

If you are using CI, set `EXPO_TOKEN` (Expo access token) instead of interactive login.

## 2) Ensure the project is linked (first time only)

```bash
pnpm eas:init
```

This writes `EAS_PROJECT_ID` into `apps/mobile/.env` (gitignored) and must match the `extra.eas.projectId` value in `app.config.ts`.

## 3) Production build for internal testing (Android + iOS)

This repo’s `production` profile is currently configured for **internal distribution** (not store submission) and **auto-submit is disabled**.

```bash
pnpm exec eas build --platform all --profile production
```

Notes:
- `EXPO_PUBLIC_API_URL` is baked into the build from `apps/mobile/eas.json` → `build.production.env`.
- The current production API is `https://crm-production-6cfe.up.railway.app`.

## 4) Download the artifacts

1. Open https://expo.dev
2. Select the project (`propninja-crm`)
3. Go to **Builds**
4. Open the latest **Android** and **iOS** builds
5. Download the artifacts:
   - Android: `.apk`
   - iOS: `.ipa`

## 5) Install for internal testing

### Android (APK)

1. Copy the `.apk` to the device (USB, Google Drive, WhatsApp to self, etc.).
2. On the device, open the file and install it.
3. If prompted, allow installs from “unknown sources” for your file manager/browser.

### iOS (IPA)

Internal distribution iOS installs require that the device is eligible under your Apple team provisioning.

Common options:
- Use the install link shown in the Expo build page (recommended).
- Or distribute via your team’s preferred MDM / Apple Business Manager flow.

If you want TestFlight instead, switch to store distribution and use `eas submit` (see `EAS_SETUP.md`).

## 6) Verify push token registration hits production

After logging in on a physical device, the app registers an Expo push token and calls:

- `POST /api/auth/push-token`

The base URL is resolved in:

- `apps/mobile/src/lib/apiBaseUrl.ts` (release builds use `EXPO_PUBLIC_API_URL`, with a fallback to the Railway production URL)

So, as long as `apps/mobile/eas.json` sets `EXPO_PUBLIC_API_URL` for the selected profile, push token registration will use the production API.

---

## Android Studio (local APK)

Use this when EAS quota is exhausted or you want a debug/release APK on your machine.

### Prerequisites

1. **Android Studio** (latest stable) with Android SDK 35 and NDK installed.
2. **JDK 17** (Android Studio bundled JBR is fine).
3. From repo root once: `pnpm install`

### One-time setup

From `apps/mobile`:

```powershell
pnpm android:prebuild
```

This runs `expo prebuild` and patches Gradle for the pnpm monorepo (`EXPO_NO_METRO_WORKSPACE_ROOT`, correct JS entry path).

### Open in Android Studio

1. **File → Open** → select folder:
   `c:\Users\Admin\Desktop\propninjacrm\apps\mobile\android`
2. Wait for Gradle sync to finish (first sync can take several minutes).
3. If sync fails, use **File → Invalidate Caches → Invalidate and Restart**.

### Build APK

**Debug (fastest, signed with debug keystore):**

- Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Or terminal from `apps/mobile`: `pnpm android:assemble:debug`

Output: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

**Release (production JS bundle, still debug-signed locally):**

- Menu: **Build → Generate Signed Bundle / APK → APK** (you can use the debug keystore for internal testing)
- Or terminal: `pnpm android:assemble:release`

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

### If native build fails (CMake / ninja on Windows)

1. Close Android Studio.
2. Delete native caches:
   ```powershell
   Remove-Item -Recurse -Force apps\mobile\android\app\.cxx -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force node_modules\.pnpm\expo-modules-core@*\node_modules\expo-modules-core\android\.cxx -ErrorAction SilentlyContinue
   ```
3. Stop Gradle daemons: `cd apps\mobile\android; .\gradlew.bat --stop`
4. Reopen Android Studio and build again.
5. Exclude the project folder from real-time antivirus scanning if CMake keeps failing.

### API URL

Local builds use `EXPO_PUBLIC_API_URL=https://crm-production-e81d.up.railway.app` from `android/gradle.properties` (set by the patch script). Change it there before rebuilding if needed.


