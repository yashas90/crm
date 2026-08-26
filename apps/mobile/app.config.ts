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
  version: "1.0.19",
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
    backgroundColor: "#8CAFBF",
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
    /** Must increase on every sideload APK or Android reports "App not installed". */
    versionCode: 19,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#8CAFBF",
    },
    permissions: [
      "INTERNET",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "SCHEDULE_EXACT_ALARM",
      "android.permission.POST_NOTIFICATIONS",
      // Continuous agent tracking while the app is backgrounded / screen off.
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "WAKE_LOCK",
    ],
    googleServicesFile: undefined,
  },
  plugins: [
    "expo-secure-store",
    "@react-native-community/datetimepicker",
    [
      "expo-notifications",
      {
        color: "#204060",
        defaultChannel: "alerts_swish",
        enableBackgroundRemoteNotifications: false,
        sounds: ["./assets/notification_swish.mp3", "./assets/notification_chime.wav"],
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "PropNinja shares your location with the office every 30 minutes, including when the app is closed, so managers can see live agent positions.",
        locationAlwaysPermission:
          "PropNinja shares your location with the office every 30 minutes, including when the app is closed, so managers can see live agent positions.",
        locationWhenInUsePermission:
          "PropNinja uses location for site visits, maps, and office live tracking.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    "expo-background-fetch",
    "expo-task-manager",
    "./plugins/withAndroidDialerQueries.js",
    "./plugins/withCallLogModule.js",
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
