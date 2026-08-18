export type MobileHealthPayload = {
  minMobileAppVersion?: string | null;
  mobileUpdateUrl?: string | null;
};

export function resolveApiBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  return null;
}

/** Direct APK download link (Expo artifact, Drive, S3, etc.). Set on Vercel. */
export function resolveMobileApkUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_MOBILE_APK_URL?.trim();
  return url || null;
}

export async function fetchMobileHealth(): Promise<{
  minVersion: string | null;
  updateUrl: string | null;
  error: string | null;
}> {
  const apiBase = resolveApiBaseUrl();
  if (!apiBase) {
    return { minVersion: null, updateUrl: null, error: "API URL is not configured" };
  }

  try {
    const res = await fetch(`${apiBase}/health`, { next: { revalidate: 60 } });
    if (!res.ok) {
      return { minVersion: null, updateUrl: null, error: `Health check failed (${res.status})` };
    }
    const json = (await res.json()) as MobileHealthPayload;
    return {
      minVersion: json.minMobileAppVersion?.trim() || null,
      updateUrl: json.mobileUpdateUrl?.trim() || null,
      error: null,
    };
  } catch (err) {
    return {
      minVersion: null,
      updateUrl: null,
      error: err instanceof Error ? err.message : "Could not reach API",
    };
  }
}
