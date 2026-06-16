import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const SENSITIVE_KEY = /password|passwd|token|authorization|jwt|secret|cookie|phone|mobile/i;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/g;

function scrubString(value: string): string {
  return value.replace(JWT_PATTERN, "[Filtered]").replace(PHONE_PATTERN, "[Filtered]");
}

function scrubUnknown(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) {
    return "[Filtered]";
  }
  if (typeof value === "string") {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item));
  }
  if (value && typeof value === "object") {
    return scrubObject(value as Record<string, unknown>);
  }
  return value;
}

function scrubObject(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = scrubUnknown(value, key);
  }
  return output;
}

function scrubRequestHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return;
  for (const key of Object.keys(headers)) {
    if (/authorization|cookie|set-cookie/i.test(key)) {
      headers[key] = "[Filtered]";
    }
  }
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request?.headers) {
    scrubRequestHeaders(event.request.headers as Record<string, string>);
  }
  if (event.request?.data) {
    event.request.data = scrubUnknown(event.request.data) as ErrorEvent["request"] extends {
      data?: infer D;
    }
      ? D
      : never;
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra);
  }
  if (event.contexts) {
    event.contexts = scrubObject(
      event.contexts as Record<string, unknown>,
    ) as typeof event.contexts;
  }
  if (event.message && typeof event.message === "string") {
    event.message = scrubString(event.message);
  }
  return event;
}
