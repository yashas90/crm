import Constants from "expo-constants";

/** Marketing / Expo config version (e.g. 1.0.5). */
export function getMobileAppVersion(): string {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.0";
}

export function parseSemver(version: string): [number, number, number] | null {
  const match = version
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isAppVersionAtLeast(appVersion: string, minimum: string): boolean {
  const left = parseSemver(appVersion);
  const right = parseSemver(minimum);
  if (!left || !right) return false;
  for (let i = 0; i < 3; i += 1) {
    const diff = left[i]! - right[i]!;
    if (diff !== 0) return diff > 0;
  }
  return true;
}

export function getMobileClientHeaders(): Record<string, string> {
  return {
    "X-PropNinja-Client": "mobile",
    "X-PropNinja-App-Version": getMobileAppVersion(),
  };
}
