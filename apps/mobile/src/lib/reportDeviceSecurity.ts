import { apiPost } from "@/lib/apiClient";
import type { DeviceSecurityInfo } from "@/lib/deviceSecurity";

export async function reportDeviceSecurityViolation(
  event: "jailbreak_detected",
  device: DeviceSecurityInfo,
): Promise<void> {
  try {
    await apiPost("/api/security/device-event", { event, device });
  } catch {
    // Best-effort — logout still proceeds if reporting fails.
  }
}
