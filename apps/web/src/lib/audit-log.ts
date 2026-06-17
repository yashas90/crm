import type { AuditLogRow } from "@/hooks/use-audit-logs";

export type AuditBadgeVariant = "create" | "update" | "delete" | "assign" | "login" | "default";

const CREATE_ACTIONS = new Set([
  "LEAD_CREATED",
  "USER_CREATED",
  "DOCUMENT_UPLOADED",
  "SITE_VISIT_SCHEDULED",
  "PROJECT_CREATED",
  "TCF_CONSENT_CREATED",
  "PROJECT_UNITS_CREATED",
]);

const DELETE_ACTIONS = new Set([
  "LEAD_DELETED",
  "DOCUMENT_DELETED",
  "SITE_VISIT_CANCELLED",
  "PROJECT_DELETED",
  "PROJECT_UNIT_DELETED",
  "TCF_CONSENT_REVOKED",
]);

const ASSIGN_ACTIONS = new Set(["LEAD_ASSIGNED"]);

const LOGIN_ACTIONS = new Set(["USER_LOGIN"]);

export function auditBadgeVariant(action: string): AuditBadgeVariant {
  if (CREATE_ACTIONS.has(action)) return "create";
  if (DELETE_ACTIONS.has(action)) return "delete";
  if (ASSIGN_ACTIONS.has(action)) return "assign";
  if (LOGIN_ACTIONS.has(action)) return "login";
  if (
    action.includes("UPDATED") ||
    action.includes("CHANGED") ||
    action.includes("COMPLETED") ||
    action.includes("SHARED") ||
    action.includes("LOGGED")
  ) {
    return "update";
  }
  return "default";
}

export const AUDIT_BADGE_CLASSES: Record<AuditBadgeVariant, string> = {
  create: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  assign: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  login: "bg-muted text-muted-foreground",
  default: "bg-muted text-muted-foreground",
};

export function formatAuditAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function auditDetailsPreview(metadata: Record<string, unknown>): string {
  const keys = Object.keys(metadata);
  if (keys.length === 0) return "—";
  if (typeof metadata.fields === "object" && Array.isArray(metadata.fields)) {
    return `Updated: ${(metadata.fields as string[]).join(", ")}`;
  }
  if (metadata.from !== undefined && metadata.to !== undefined) {
    return `${String(metadata.from)} → ${String(metadata.to)}`;
  }
  const text = JSON.stringify(metadata);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export function auditEntityHref(row: AuditLogRow): string | null {
  if (row.entityExists === false) return null;

  switch (row.entityType) {
    case "lead":
      return `/leads/${row.entityId}`;
    case "user":
      return "/settings/users";
    case "project":
      return `/projects/${row.entityId}`;
    case "call": {
      const leadId = row.metadata.leadId;
      return typeof leadId === "string" ? `/leads/${leadId}` : null;
    }
    case "site_visit": {
      const leadId = row.metadata.leadId;
      return typeof leadId === "string" ? `/leads/${leadId}` : null;
    }
    case "document":
      return "/documents";
    case "org":
      return "/settings";
    default:
      return null;
  }
}

export const AUDIT_ENTITY_TYPES = [
  "lead",
  "user",
  "project",
  "call",
  "site_visit",
  "document",
  "org",
  "tcf_consent",
  "project_unit",
] as const;

export const AUDIT_ACTION_OPTIONS = [
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "LEAD_DELETED",
  "LEAD_ASSIGNED",
  "LEAD_STAGE_CHANGED",
  "CALL_LOGGED",
  "USER_CREATED",
  "USER_ROLE_CHANGED",
  "USER_DEACTIVATED",
  "USER_ACTIVATED",
  "USER_LOGIN",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT_COMPLETED",
  "SITE_VISIT_CANCELLED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_SHARED",
  "DOCUMENT_DELETED",
  "ORG_SETTINGS_UPDATED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_DELETED",
] as const;
