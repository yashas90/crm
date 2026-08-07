/**
 * Semver helpers for enforcing a minimum PropNinja mobile app version.
 * Only major.minor.patch are compared (pre-release suffixes ignored).
 */

export function parseSemver(version: string): [number, number, number] | null {
  const match = version
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Returns negative if a < b, 0 if equal, positive if a > b. Null if either is invalid. */
export function compareSemver(a: string, b: string): number | null {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i += 1) {
    const diff = left[i]! - right[i]!;
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isMobileAppVersionAtLeast(appVersion: string, minimum: string): boolean {
  const cmp = compareSemver(appVersion, minimum);
  return cmp !== null && cmp >= 0;
}

/** Native RN / Expo clients (old builds that never sent our version header). */
export function looksLikeNativeMobileClient(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mozilla/") || ua.includes("chrome/") || ua.includes("safari/")) {
    // Browser UAs often include those; Expo web would too — treat as non-native.
    if (!ua.includes("okhttp") && !ua.includes("expo") && !ua.includes("reactnative")) {
      return false;
    }
  }
  return (
    ua.includes("okhttp") ||
    ua.includes("expo") ||
    ua.includes("reactnative") ||
    ua.includes("propninja") ||
    ua.includes("cfnetwork") // iOS NSURLSession / RN fetch often
  );
}
