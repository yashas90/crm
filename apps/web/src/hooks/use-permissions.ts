"use client";

import { useSession } from "@/hooks/use-session";
import { type Permission, roleHasPermission } from "@propninja/types/permissions";
import { useCallback } from "react";

export function usePermissions() {
  const { session, ready, isAdmin, isManager, isAgent } = useSession();

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!session) return false;
      return roleHasPermission(session.role, permission);
    },
    [session],
  );

  return {
    session,
    ready,
    isAdmin,
    isManager,
    isAgent,
    hasPermission,
    canCreateUser: hasPermission("users:create"),
    canUpdateUser: hasPermission("users:update"),
    canDeleteUser: hasPermission("users:delete"),
    canViewUsers: hasPermission("users:view") || hasPermission("users:view_for_filter"),
    canCreateProject: hasPermission("projects:create"),
    canUpdateProject: hasPermission("projects:update"),
    canDeleteProject: hasPermission("projects:delete"),
    canAssignLead: hasPermission("leads:assign"),
    canBulkUploadLeads: hasPermission("leads:bulk_upload") && hasPermission("leads:create"),
    canDeleteLead: hasPermission("leads:delete"),
    canViewUserProfile: hasPermission("user_profile:view"),
    canViewReports:
      hasPermission("reports:view") ||
      hasPermission("reports:view_all") ||
      hasPermission("reports:view_reportees"),
    canExportReports: hasPermission("reports:export") || hasPermission("reports:export_reportees"),
    canExportLeads: hasPermission("leads:export"),
    canViewTeamReport: hasPermission("reports:view_reportees") || hasPermission("reports:view_all"),
  };
}
