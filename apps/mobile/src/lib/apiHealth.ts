import { getApiBaseUrl } from "@/lib/apiBaseUrl";

/** Quick connectivity check — used on login to distinguish offline vs bad credentials. */
export async function checkApiReachable(timeoutMs = 12_000): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { status?: string };
    return json.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
