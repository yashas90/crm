import {
  AGENT_PERMISSIONS,
  MANAGER_PERMISSIONS,
  type Permission,
  roleHasPermission,
} from "@propninja/types/permissions";
import type { AuthUser } from "../middleware/auth.js";

type LeadLike = { assignedTo?: string | null };

export function isAdmin(user: AuthUser): boolean {
  return user.role === "admin";
}

/** Admin has every permission; manager/agent use role allow-lists. */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return roleHasPermission(user.role, permission);
}

/** Managers with leads:view can access all org leads in single-tenant mode. */
function hasTeamLeadAccess(user: AuthUser): boolean {
  return user.role === "manager" && hasPermission(user, "leads:view");
}

export function canViewLead(user: AuthUser, lead: LeadLike): boolean {
  if (hasPermission(user, "leads:view_all")) return true;
  if (hasTeamLeadAccess(user)) return true;
  return lead.assignedTo === user.id;
}

export function canEditLead(user: AuthUser, lead: LeadLike): boolean {
  if (hasPermission(user, "leads:view_all")) return true;
  if (hasTeamLeadAccess(user) && hasPermission(user, "leads:update")) return true;
  if (!hasPermission(user, "leads:update")) return false;
  return lead.assignedTo === user.id;
}

export function canAssignLead(user: AuthUser): boolean {
  return hasPermission(user, "leads:assign");
}

export function canViewReports(user: AuthUser): boolean {
  return (
    hasPermission(user, "reports:view") ||
    hasPermission(user, "reports:view_all") ||
    hasPermission(user, "reports:view_reportees")
  );
}

export function canExportReports(user: AuthUser): boolean {
  return hasPermission(user, "reports:export") || hasPermission(user, "reports:export_reportees");
}

export function canCreateUsers(user: AuthUser): boolean {
  return hasPermission(user, "users:create");
}

export function canUpdateUsers(user: AuthUser): boolean {
  return hasPermission(user, "users:update");
}

export function canDeleteUsers(user: AuthUser): boolean {
  return hasPermission(user, "users:delete");
}

/** @deprecated Use canCreateUsers */
export function canManageUsers(user: AuthUser): boolean {
  return canCreateUsers(user);
}

export function canViewUsers(user: AuthUser): boolean {
  return hasPermission(user, "users:view") || hasPermission(user, "users:view_for_filter");
}

export function canViewOrgProfile(user: AuthUser): boolean {
  return hasPermission(user, "org_profile:view");
}

export function canUpdateOrgProfile(user: AuthUser): boolean {
  return hasPermission(user, "org_profile:update");
}

/** Any authenticated user may list and read projects. */
export function canViewProjects(_user: AuthUser): boolean {
  return true;
}

/** Create, update, delete, and toggle availability — manager and admin only. */
export function canManageProjects(user: AuthUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

/** @deprecated Use canManageProjects */
export function canCreateProject(user: AuthUser): boolean {
  return canManageProjects(user);
}

/** @deprecated Use canManageProjects */
export function canUpdateProject(user: AuthUser): boolean {
  return canManageProjects(user);
}

/** @deprecated Use canManageProjects */
export function canDeleteProject(user: AuthUser): boolean {
  return canManageProjects(user);
}

export function canDeleteLead(user: AuthUser): boolean {
  return hasPermission(user, "leads:delete");
}

export function canViewUserProfile(user: AuthUser): boolean {
  return hasPermission(user, "user_profile:view");
}

/** Re-export role permission lists for tests and diagnostics. */
export { AGENT_PERMISSIONS, MANAGER_PERMISSIONS };

/** Consistent 403 payload for permission denials. */
export function forbiddenResponse() {
  return {
    ok: false as const,
    error: { code: "FORBIDDEN" as const, message: "Access denied" },
  };
}
