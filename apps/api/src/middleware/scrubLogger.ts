export const SCRUB_FIELDS = [
  "password",
  "phone",
  "email",
  "token",
  "secret",
  "otp",
  "cardnumber",
  "key",
] as const;

function shouldScrubKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SCRUB_FIELDS.some((field) => lower.includes(field));
}

/** Redact sensitive keys from objects before logging. */
export function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (shouldScrubKey(key)) {
        return [key, "[REDACTED]"];
      }
      if (Array.isArray(value)) {
        return [key, value.map((item) => scrubUnknown(item))];
      }
      if (value && typeof value === "object") {
        return [key, scrubObject(value as Record<string, unknown>)];
      }
      return [key, value];
    }),
  );
}

function scrubUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item));
  }
  if (value && typeof value === "object") {
    return scrubObject(value as Record<string, unknown>);
  }
  return value;
}

/** Redact sensitive query string parameters before logging. */
export function scrubQueryParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) =>
      shouldScrubKey(key) ? [key, "[REDACTED]"] : [key, value],
    ),
  );
}

export function queryParamsFromUrl(url: string): Record<string, string> {
  const search = new URL(url, "http://localhost").searchParams;
  return Object.fromEntries(search.entries());
}
