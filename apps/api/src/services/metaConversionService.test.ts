import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CapiEvent, CapiSendResult } from "../lib/metaCapi.js";

const dbState = vi.hoisted(() => ({
  events: [] as Array<Record<string, unknown>>,
  pixelToken: null as string | null,
  pageTokens: [] as string[],
  updates: [] as Array<Record<string, unknown>>,
}));

const tokenState = vi.hoisted(() => ({
  user: "user-token" as string | null,
  system: null as string | null,
}));

function tableKind(table: unknown): "events" | "pixels" | "pages" | "other" {
  if (!table || typeof table !== "object") return "other";
  if ("eventId" in table && "eventName" in table) return "events";
  if ("pixelId" in table && "accessTokenEncrypted" in table) return "pixels";
  if ("pageId" in table && "accessTokenEncrypted" in table) return "pages";
  return "other";
}

vi.mock("../lib/db.js", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const kind = tableKind(table);
        if (kind === "pages") {
          return {
            where: async () => dbState.pageTokens.map((token) => ({ accessTokenEncrypted: token })),
          };
        }
        if (kind === "pixels") {
          return {
            where: () => ({
              limit: async () =>
                dbState.pixelToken ? [{ accessTokenEncrypted: dbState.pixelToken }] : [],
            }),
          };
        }
        return {
          where: () => ({
            orderBy: () => ({
              limit: async () => dbState.events,
            }),
          }),
        };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          const promise = Promise.resolve().then(() => {
            dbState.updates.push(values);
            return [] as Array<{ id: string }>;
          });
          return Object.assign(promise, {
            returning: () => promise,
          });
        },
      }),
    }),
  },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/tokenEncryption.js", () => ({
  decryptSecret: (value: string) => value,
}));

vi.mock("./metaTokenService.js", () => ({
  getActiveAccessToken: async () => tokenState.user,
  getActiveSystemAccessToken: async () => tokenState.system,
}));

vi.mock("../lib/metaCapi.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/metaCapi.js")>();
  return { ...actual, sendCapiEvents: vi.fn() };
});

import { sendCapiEvents } from "../lib/metaCapi.js";
import {
  CAPI_NO_TOKEN_ERROR,
  CAPI_PAGE_TOKEN_ERROR,
  CAPI_STALE_EVENT_ERROR,
  capiAccessTokenCandidates,
  isMetaPageTokenError,
  isStaleCapiEventTime,
  sendPendingConversionEvents,
} from "./metaConversionService.js";

const sendCapiEventsMock = vi.mocked(sendCapiEvents);

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    orgId: "org",
    leadId: null,
    pixelId: "pixel-1",
    eventName: "Lead",
    eventId: "lead:1",
    eventTime: new Date(),
    actionSource: "system_generated",
    eventSourceUrl: null,
    userData: { external_id: ["abc"] },
    customData: { event_source: "crm", lead_event_source: "PropNinja" },
    status: "pending",
    httpStatus: null,
    responsePayload: null,
    errorMessage: null,
    retryCount: 0,
    nextRetryAt: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function okResult(): CapiSendResult {
  return { ok: true, status: 200, eventsReceived: 1 };
}

describe("capiAccessTokenCandidates", () => {
  it("drops Page access tokens and prefers a pixel or system-user token", () => {
    expect(isMetaPageTokenError(CAPI_PAGE_TOKEN_ERROR, 190)).toBe(true);
    expect(
      capiAccessTokenCandidates(
        {
          envToken: null,
          pixelToken: "page-token",
          systemToken: "system-token",
          userToken: "user-token",
        },
        ["page-token"],
      ),
    ).toEqual(["system-token", "user-token"]);
  });

  it("treats events older than 7 days as not sendable", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isStaleCapiEventTime(eightDaysAgo)).toBe(true);
    expect(isStaleCapiEventTime(new Date())).toBe(false);
  });
});

describe("sendPendingConversionEvents", () => {
  beforeEach(() => {
    dbState.events = [];
    dbState.pixelToken = null;
    dbState.pageTokens = [];
    dbState.updates = [];
    tokenState.user = "user-token";
    tokenState.system = null;
    process.env.META_CAPI_ACCESS_TOKEN = "";
    process.env.META_CAPI_TEST_EVENT_CODE = "";
    sendCapiEventsMock.mockReset();
    sendCapiEventsMock.mockResolvedValue(okResult());
  });

  it("does not send with a Page token stored on the pixel", async () => {
    dbState.pageTokens = ["page-token"];
    dbState.pixelToken = "page-token";
    dbState.events = [eventRow()];

    const result = await sendPendingConversionEvents({ orgId: "org", limit: 10 });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.error).toBeUndefined();
    expect(sendCapiEventsMock).toHaveBeenCalledTimes(1);
    expect(sendCapiEventsMock.mock.calls[0]?.[1]).toBe("user-token");
    expect(dbState.updates.some((update) => update.status === "sent")).toBe(true);
    expect(dbState.updates.some((update) => update.status === "failed")).toBe(false);
  });

  it("falls through to the next token when Meta rejects a Page access token", async () => {
    dbState.pixelToken = "stale-page-token";
    dbState.events = [eventRow({ status: "failed", retryCount: 1 })];
    sendCapiEventsMock.mockImplementation(async (_pixelId, accessToken) => {
      if (accessToken === "stale-page-token") {
        return { ok: false, status: 400, code: 190, error: CAPI_PAGE_TOKEN_ERROR };
      }
      return okResult();
    });

    const result = await sendPendingConversionEvents({ orgId: "org", limit: 10 });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.error).toBeUndefined();
    expect(sendCapiEventsMock.mock.calls.map((call) => call[1])).toEqual([
      "stale-page-token",
      "user-token",
    ]);
  });

  it("keeps events pending and returns the Page token error when no CAPI token exists", async () => {
    dbState.pageTokens = ["page-token"];
    dbState.pixelToken = "page-token";
    tokenState.user = "page-token";
    dbState.events = [eventRow()];

    const result = await sendPendingConversionEvents({ orgId: "org", limit: 10 });

    expect(result).toMatchObject({ sent: 0, failed: 0, error: CAPI_NO_TOKEN_ERROR });
    expect(sendCapiEventsMock).not.toHaveBeenCalled();
    expect(dbState.updates.some((update) => update.status === "failed")).toBe(false);
    expect(dbState.updates.some((update) => update.errorMessage === CAPI_NO_TOKEN_ERROR)).toBe(
      true,
    );
  });

  it("skips events older than 7 days and still sends a fresh one", async () => {
    dbState.events = [
      eventRow({
        id: "old",
        eventId: "old",
        eventTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      }),
      eventRow({ id: "new", eventId: "new" }),
    ];

    const result = await sendPendingConversionEvents({ orgId: "org", limit: 10 });

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    const payloads = sendCapiEventsMock.mock.calls[0]?.[2] as CapiEvent[];
    expect(payloads.map((event) => event.event_id)).toEqual(["new"]);
    expect(dbState.updates.some((update) => update.errorMessage === CAPI_STALE_EVENT_ERROR)).toBe(
      true,
    );
  });

  it("sends the valid events when one event in the batch is rejected", async () => {
    dbState.events = [
      eventRow({ id: "good", eventId: "good" }),
      eventRow({ id: "bad", eventId: "bad" }),
    ];
    sendCapiEventsMock.mockImplementation(async (_pixelId, _token, events) => {
      if (events.length > 1) {
        return { ok: false, status: 400, error: "Invalid parameter" };
      }
      if (events[0]?.event_id === "bad") {
        return { ok: false, status: 400, error: "Event rejected by Meta" };
      }
      return okResult();
    });

    const result = await sendPendingConversionEvents({ orgId: "org", limit: 10 });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.error).toBe("Event rejected by Meta");
    expect(dbState.updates.some((update) => update.status === "sent")).toBe(true);
    expect(dbState.updates.some((update) => update.status === "failed")).toBe(true);
  });
});
