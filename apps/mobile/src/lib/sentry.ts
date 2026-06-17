import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn =
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ??
  process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE;

let initialized = false;

export function initSentry() {
  if (initialized || !dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    enabled: Boolean(dsn),
  });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, string>) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, value);
      }
    }
    Sentry.captureException(error);
  });
}

export function setSentryUser(user: { id: string; role: string } | null) {
  if (!initialized) return;
  if (user) {
    Sentry.setUser({ id: user.id });
    Sentry.setTag("role", user.role);
  } else {
    Sentry.setUser(null);
  }
}

export { Sentry };
