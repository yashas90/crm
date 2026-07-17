/**
 * Meta Conversions API (CAPI) helpers — PII hashing, user_data payload building,
 * and the `/​{pixel_id}/events` send call.
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api
 */
import { createHash, randomUUID } from "node:crypto";
import { GRAPH_API_VERSION, graphPost } from "./metaGraphClient.js";
import type { CapiEventName } from "./metaStatusMap.js";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Hashes a normalized value; returns `undefined` for empty input (omit the field entirely). */
function hashField(
  value: string | undefined | null,
  normalize: (v: string) => string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return sha256Hex(normalize(trimmed));
}

const lower = (v: string) => v.toLowerCase();
const lowerNoSpaces = (v: string) => v.toLowerCase().replace(/\s+/g, "");
const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "").replace(/^0+/, "");
const zipPrefix = (v: string) => v.toLowerCase().replace(/\s+/g, "").slice(0, 5);

/** SHA-256 hash of a normalized email address (lowercase, trimmed). */
export function hashEmail(email?: string | null): string | undefined {
  return hashField(email, lower);
}

/** SHA-256 hash of a normalized phone number (digits only, no leading zeros). */
export function hashPhone(phone?: string | null): string | undefined {
  return hashField(phone, digitsOnly);
}

/** SHA-256 hash of a normalized first name (lowercase, trimmed). */
export function hashFirstName(firstName?: string | null): string | undefined {
  return hashField(firstName, lower);
}

/** SHA-256 hash of a normalized last name (lowercase, trimmed). */
export function hashLastName(lastName?: string | null): string | undefined {
  return hashField(lastName, lower);
}

/** SHA-256 hash of a normalized city (lowercase, spaces removed). */
export function hashCity(city?: string | null): string | undefined {
  return hashField(city, lowerNoSpaces);
}

/** SHA-256 hash of a normalized state/region (lowercase, spaces removed). */
export function hashState(state?: string | null): string | undefined {
  return hashField(state, lowerNoSpaces);
}

/** SHA-256 hash of a normalized 2-letter country code (lowercase). */
export function hashCountry(country?: string | null): string | undefined {
  return hashField(country, lowerNoSpaces);
}

/** SHA-256 hash of a normalized postal code (lowercase, first 5 chars). */
export function hashZip(zip?: string | null): string | undefined {
  return hashField(zip, zipPrefix);
}

/** SHA-256 hash of an external (CRM) ID, per Meta's recommendation to hash `external_id`. */
export function hashExternalId(externalId?: string | null): string | undefined {
  return hashField(externalId, (v) => v);
}

export type CapiUserDataInput = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  externalId?: string | null;
  /** Facebook browser pixel cookie (`_fbp`) — sent as-is, not hashed. */
  fbp?: string | null;
  /** Facebook click ID cookie (`_fbc`) — sent as-is, not hashed. */
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

/** Meta CAPI `user_data` object — PII fields hashed, dedup/attribution fields passed through. */
export type CapiUserData = {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  st?: string;
  country?: string;
  zp?: string;
  external_id?: string;
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

/** Builds a Meta CAPI `user_data` object: PII hashed (SHA-256), dedup fields passed through. */
export function buildCapiUserData(input: CapiUserDataInput): CapiUserData {
  const userData: CapiUserData = {
    em: hashEmail(input.email),
    ph: hashPhone(input.phone),
    fn: hashFirstName(input.firstName),
    ln: hashLastName(input.lastName),
    ct: hashCity(input.city),
    st: hashState(input.state),
    country: hashCountry(input.country),
    zp: hashZip(input.zip),
    external_id: hashExternalId(input.externalId),
    fbp: input.fbp?.trim() || undefined,
    fbc: input.fbc?.trim() || undefined,
    client_ip_address: input.clientIpAddress?.trim() || undefined,
    client_user_agent: input.clientUserAgent?.trim() || undefined,
  };

  for (const key of Object.keys(userData) as Array<keyof CapiUserData>) {
    if (userData[key] === undefined) delete userData[key];
  }

  return userData;
}

/** Generates a unique `event_id` for CAPI/Pixel event deduplication. */
export function generateEventId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}:${id}` : id;
}

export type CapiEvent = {
  event_name: CapiEventName | string;
  event_time: number;
  event_id: string;
  action_source:
    | "email"
    | "website"
    | "phone_call"
    | "chat"
    | "physical_store"
    | "system_generated"
    | "other";
  event_source_url?: string;
  user_data: CapiUserData;
  custom_data?: Record<string, unknown>;
};

export type CapiSendResult = {
  ok: boolean;
  status: number;
  eventsReceived?: number;
  fbtraceId?: string;
  messages?: unknown[];
  error?: string;
};

/** Sends a batch of CAPI events to `/{pixel_id}/events`. Requires `META_CAPI_ENABLED` at the call site. */
export async function sendCapiEvents(
  pixelId: string,
  accessToken: string,
  events: CapiEvent[],
  options?: { testEventCode?: string },
): Promise<CapiSendResult> {
  if (events.length === 0) {
    return { ok: true, status: 200, eventsReceived: 0 };
  }

  try {
    const { data } = await graphPost<{
      events_received?: number;
      messages?: unknown[];
      fbtrace_id?: string;
    }>(`${pixelId}/events`, accessToken, {
      data: JSON.stringify(events),
      ...(options?.testEventCode ? { test_event_code: options.testEventCode } : {}),
    });

    return {
      ok: true,
      status: 200,
      eventsReceived: data.events_received,
      fbtraceId: data.fbtrace_id,
      messages: data.messages,
    };
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 502;
    return {
      ok: false,
      status,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Re-exported for callers that need the API version used for CAPI calls (e.g. audit logs). */
export { GRAPH_API_VERSION };
