import type { UserRow } from "@/hooks/use-users";

export function formatUserFullName(user: Pick<UserRow, "firstName" | "lastName" | "name">) {
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fromParts || user.name;
}

export function formatUserEmail(user: Pick<UserRow, "workEmail" | "email">) {
  return user.workEmail ?? user.email;
}

export function getUserRoleLabel(user: Pick<UserRow, "roleLabel" | "role">) {
  if (user.roleLabel?.trim()) return user.roleLabel.trim();
  if (user.role === "admin") return "Admin";
  if (user.role === "manager") return "Manager";
  return "Basic";
}

const ROLE_LABEL_STYLES: Record<string, string> = {
  Admin: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  Manager: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  Basic: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function getRoleLabelClass(label: string) {
  return ROLE_LABEL_STYLES[label] ?? "bg-muted text-muted-foreground";
}
