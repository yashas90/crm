import type { AuthUser } from "../middleware/auth.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve which user's calls to list. Agents are always scoped to self. */
export function resolveCallAgentId(
  authUser: AuthUser,
  options: { agentId?: string; userId?: string },
): string | undefined {
  if (authUser.role === "agent") {
    return authUser.id;
  }

  const raw = options.agentId ?? options.userId;
  if (!raw || raw === "all") {
    return undefined;
  }
  if (raw === "me") {
    return authUser.id;
  }
  if (UUID_RE.test(raw)) {
    return raw;
  }

  return undefined;
}
