import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { getClientIp } from "../lib/clientIp.js";
import { AppError } from "../lib/errors.js";
import { unblockIp } from "../lib/ipBlocklist.js";
import { clearAllLoginRateLimits } from "../lib/loginBruteForce.js";
import { listPaginationSchema } from "../lib/pagination.js";
import { isAdmin } from "../lib/permissions.js";
import { PORTAL_MOCK_PAYLOADS } from "../lib/portalWebhookDefaults.js";
import { clearAllRateLimits } from "../lib/rateLimitStore.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { clearAllResponseCaches } from "../lib/responseCache.js";
import { validate } from "../lib/validate.js";
import {
  createPortalWebhookBodySchema,
  portalWebhookTestBodySchema,
  updatePortalWebhookBodySchema,
} from "../lib/validators/portalWebhook.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  listActiveSessions,
  listFailedLoginsByIp,
  listRecentExportEvents,
} from "../services/adminSecurityService.js";
import { auditFromContext } from "../services/auditService.js";
import { documentService } from "../services/documentService.js";
import { portalWebhookService } from "../services/portalWebhookService.js";
import {
  listUnresolvedSecurityAlerts,
  resolveSecurityAlert,
} from "../services/securityAlertService.js";
import { revokeAllUserSessions } from "../services/tokenRevocationService.js";

export const adminRoutes = new Hono();

function resolvePublicApiBaseUrl(c: { req: { url: string } }): string | undefined {
  try {
    const url = new URL(c.req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

adminRoutes.post("/cache/clear", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const cleared = clearAllResponseCaches();
  return jsonOk(c, { cleared });
});

/** Clear the caller's IP from the anti-scrape blocklist (e.g. after a false positive). */
adminRoutes.post("/ip-block/clear", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const ip = getClientIp(c);
  if (ip) await unblockIp(ip);
  return jsonOk(c, { cleared: ip ?? null });
});

/** Clear all API rate-limit counters and login lockouts (e.g. after office Wi‑Fi false positives). */
adminRoutes.post("/rate-limits/clear", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const clearedRateLimits = clearAllRateLimits();
  const clearedLoginLimits = clearAllLoginRateLimits();
  const ip = getClientIp(c);
  if (ip) await unblockIp(ip);

  return jsonOk(c, {
    clearedRateLimits,
    clearedLoginLimits,
    clearedIp: ip ?? null,
  });
});

adminRoutes.get("/security-alerts", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const db = c.get("db");
  const [items, failedLoginsByIp, exportEvents] = await Promise.all([
    listUnresolvedSecurityAlerts(db),
    listFailedLoginsByIp(db),
    listRecentExportEvents(db),
  ]);

  return jsonOk(c, { items, failedLoginsByIp, exportEvents });
});

adminRoutes.get("/active-sessions", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const sessions = await listActiveSessions(c.get("db"));
  return jsonOk(c, { sessions });
});

adminRoutes.post("/security-alerts/:id/resolve", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const id = c.req.param("id");
  const resolved = await resolveSecurityAlert(c.get("db"), id);
  if (!resolved) {
    return jsonError(c, "NOT_FOUND", "Alert not found", 404);
  }

  return jsonOk(c, { resolved: true });
});

adminRoutes.post("/users/:id/revoke-sessions", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const targetUserId = c.req.param("id");
  const db = c.get("db");

  const [target] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    return jsonError(c, "NOT_FOUND", "User not found", 404);
  }

  await revokeAllUserSessions(targetUserId);

  await auditFromContext(c, db, {
    userId: authUser.id,
    action: AUDIT_ACTIONS.SESSIONS_REVOKED,
    entityType: "user",
    entityId: targetUserId,
    entityName: target.name,
  });

  return jsonOk(c, { revoked: true, userId: targetUserId });
});

const adminDocumentsQuerySchema = listPaginationSchema;

adminRoutes.get("/documents", validate("query", adminDocumentsQuerySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const query = c.req.valid("query");
  const data = await documentService.adminList(query);
  return jsonOk(c, data);
});

adminRoutes.get("/portal-webhooks", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const items = await portalWebhookService.list(resolvePublicApiBaseUrl(c));
  return jsonOk(c, { items });
});

adminRoutes.post("/portal-webhooks", validate("json", createPortalWebhookBodySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const body = c.req.valid("json");
  const created = await portalWebhookService.create(body, resolvePublicApiBaseUrl(c));
  return jsonOk(c, created, undefined, 201);
});

adminRoutes.patch(
  "/portal-webhooks/:id",
  validate("json", updatePortalWebhookBodySchema),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;

    if (!isAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Admin access required", 403);
    }

    const body = c.req.valid("json");
    try {
      const updated = await portalWebhookService.update(
        c.req.param("id"),
        body,
        resolvePublicApiBaseUrl(c),
      );
      return jsonOk(c, updated);
    } catch (error) {
      if (error instanceof AppError && error.status === 404) {
        return jsonError(c, error.code, error.message, 404);
      }
      throw error;
    }
  },
);

adminRoutes.post(
  "/portal-webhooks/test-preview",
  validate("json", portalWebhookTestBodySchema),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;

    if (!isAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Admin access required", 403);
    }

    const body = c.req.valid("json");
    const preview = portalWebhookService.previewLead(body);
    return jsonOk(c, { preview });
  },
);

adminRoutes.post("/portal-webhooks/:id/test", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }

  const webhook = await portalWebhookService.list(resolvePublicApiBaseUrl(c));
  const config = webhook.find((item) => item.id === c.req.param("id"));
  if (!config) {
    return jsonError(c, "NOT_FOUND", "Portal webhook not found", 404);
  }

  const payload = PORTAL_MOCK_PAYLOADS[config.portalName];
  const preview = portalWebhookService.previewLead({
    portalName: config.portalName,
    fieldMapping: config.fieldMapping,
    payload,
  });

  return jsonOk(c, { preview, mockPayload: payload });
});
