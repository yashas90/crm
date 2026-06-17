const blockedIps = new Map<string, number>();

const ONE_HOUR_MS = 60 * 60 * 1000;

export function blockIp(ip: string, durationMs = ONE_HOUR_MS): void {
  blockedIps.set(ip, Date.now() + durationMs);
}

export function isIpBlocked(ip: string): boolean {
  const until = blockedIps.get(ip);
  if (!until) return false;
  if (Date.now() >= until) {
    blockedIps.delete(ip);
    return false;
  }
  return true;
}

export function clearExpiredIpBlocks(): void {
  const now = Date.now();
  for (const [ip, until] of blockedIps) {
    if (now >= until) blockedIps.delete(ip);
  }
}

export function getIpBlockExpiry(ip: string): number | undefined {
  return blockedIps.get(ip);
}
