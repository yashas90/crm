import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { getMobileAppVersion, isAppVersionAtLeast } from "@/lib/appVersion";

export type AppUpdateRequirement = {
  required: boolean;
  minVersion: string | null;
  updateUrl: string | null;
  currentVersion: string;
};

type HealthPayload = {
  minMobileAppVersion?: string | null;
  mobileUpdateUrl?: string | null;
};

/**
 * Asks the API whether this install is still supported.
 * Fail-open on network errors so offline agents can still open a cached session;
 * API middleware will block authenticated calls once reachable if outdated.
 */
export async function checkAppUpdateRequired(timeoutMs = 12_000): Promise<AppUpdateRequirement> {
  const currentVersion = getMobileAppVersion();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { required: false, minVersion: null, updateUrl: null, currentVersion };
    }
    const json = (await response.json()) as HealthPayload;
    const minVersion = json.minMobileAppVersion?.trim() || null;
    const updateUrl = json.mobileUpdateUrl?.trim() || null;
    if (!minVersion) {
      return { required: false, minVersion: null, updateUrl, currentVersion };
    }
    const required = !isAppVersionAtLeast(currentVersion, minVersion);
    return { required, minVersion, updateUrl, currentVersion };
  } catch {
    return { required: false, minVersion: null, updateUrl: null, currentVersion };
  } finally {
    clearTimeout(timeoutId);
  }
}
