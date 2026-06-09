import type { UserRole } from "@propninja/types/enums";

/**
 * Maps UI role group labels (from user_roles / the Add-Edit User form) to the
 * `users.role` enum that drives JWT auth and permission checks.
 *
 * - "Admin"    -> admin   (full access)
 * - "Manager"  -> manager (team management)
 * - "Basic" or "Agent" -> agent (standard field user)
 *
 * `users.roleLabel` keeps the display name shown in lists; `users.role` is what
 * middleware and sidebar nav use — always derive role from roleLabel on write.
 */
export function mapRoleLabelToRole(roleLabel: string): UserRole {
  const normalized = roleLabel.trim().toLowerCase();

  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "manager";
  // Basic, Agent, and any other label map to the agent permission tier.
  return "agent";
}

export function defaultRoleLabel(role: UserRole | string): string {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return "Basic";
}

export function resolveUserRoleFields(input: {
  role?: UserRole;
  roleLabel?: string | null;
}): { role: UserRole; roleLabel: string } | null {
  if (input.roleLabel !== undefined && input.roleLabel !== null) {
    const trimmed = input.roleLabel.trim();
    const roleLabel = trimmed || defaultRoleLabel("agent");
    return {
      roleLabel,
      role: mapRoleLabelToRole(roleLabel),
    };
  }

  if (input.role !== undefined) {
    return {
      role: input.role,
      roleLabel: defaultRoleLabel(input.role),
    };
  }

  return null;
}
