import type { ConfigContext, ExpoConfig } from "expo/config";

const BUNDLE_ID = "com.propninja.crm";
const EAS_PROJECT_ID = "fe2ff218-2069-40bb-ab90-e694a50777e2";
const EXPO_OWNER = "propninjacrm";
/** Production API — also set in eas.json preview/production env for release builds. */
const PRODUCTION_API_URL = "https://crm-production-e81d.up.railway.app";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PropNinja",
  slug: "propninja-crm",
  version: "1.0.0",
  description:
    "PropNinja CRM for real estate agents — manage leads, follow-ups, and log SIM calls from your phone.",
  orientation: "portrait",
  scheme: "propninja",
  userInterfaceStyle: "light",
  newArchEnabled: false,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#FFFBF2",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      LSApplicationQueriesSchemes: ["tel", "whatsapp", "https"],
      ITSAppUsesNonExemptEncryption: false,
      NSUserNotificationUsageDescription: "PropNinja sends follow-up reminders and lead alerts.",
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#204060",
    },
    permissions: [
      "INTERNET",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "android.permission.POST_NOTIFICATIONS",
    ],
    googleServicesFile: undefined,
  },
  plugins: [
    "expo-secure-store",
    [
      "expo-notifications",
      {
        color: "#204060",
        defaultChannel: "default",
        enableBackgroundRemoteNotifications: false,
      },
    ],
    "./plugins/withAndroidDialerQueries.js",
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? EAS_PROJECT_ID,
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? PRODUCTION_API_URL,
    privacyPolicyUrl:
      process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "https://www.ninjamarketing.in/privacy",
  },
  owner: process.env.EXPO_OWNER ?? EXPO_OWNER,
});
