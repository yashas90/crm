import type { Context } from "hono";
import type { AuthUser } from "../middleware/auth.js";
import { jsonError } from "./response.js";

export class OrgScopeError extends Error {
  readonly status = 403 as const;
  constructor(message = "Resource not in your organization") {
    super(message);
    this.name = "OrgScopeError";
  }
}

/** Future-proof multi-tenant guard — throws when resource org ≠ requester's org. */
export function assertBelongsToOrg(resourceOrgId: string, user: Pick<AuthUser, "orgId">): void {
  if (resourceOrgId !== user.orgId) {
    throw new OrgScopeError();
  }
}

export function orgForbidden(c: Context) {
  return jsonError(c, "FORBIDDEN", "Access denied", 403);
}

export function handleOrgScopeError(c: Context, error: unknown) {
  if (error instanceof OrgScopeError) {
    return orgForbidden(c);
  }
  throw error;
}
