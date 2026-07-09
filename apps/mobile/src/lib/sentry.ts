/** Mobile Sentry is disabled until EXPO_PUBLIC_SENTRY_DSN_MOBILE and the Expo plugin are configured. */

export function initSentry() {}

export function captureException(_error: unknown, _context?: Record<string, string>) {}

export function setSentryUser(_user: { id: string; role: string } | null) {}
