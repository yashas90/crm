import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PropNinja",
  slug: "propninja-crm",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "propninja",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.propninja.crm",
    infoPlist: {
      // tel: dialer works without extra entitlements; document for App Store review.
      LSApplicationQueriesSchemes: ["tel"],
    },
  },
  android: {
    package: "com.propninja.crm",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
