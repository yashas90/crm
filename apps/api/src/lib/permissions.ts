import type { AuthUser } from "../middleware/auth.js";

type LeadLike = { assignedTo?: string | null };

export function canViewLead(user: AuthUser, lead: LeadLike): boolean {
  if (user.role === "admin" || user.role === "manager") return true;
  return lead.assignedTo === user.id;
}

export function canEditLead(user: AuthUser, lead: LeadLike): boolean {
  if (user.role === "admin" || user.role === "manager") return true;
  return lead.assignedTo === user.id;
}

export function canAssignLead(user: AuthUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

export function canViewReports(user: AuthUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

export function canManageUsers(user: AuthUser): boolean {
  return user.role === "admin";
}

/** Consistent 403 payload for permission denials. */
export function forbiddenResponse() {
  return {
    ok: false as const,
    error: { code: "FORBIDDEN" as const, message: "Access denied" },
  };
}
