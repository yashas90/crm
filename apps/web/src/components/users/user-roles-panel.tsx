"use client";

import type { UserRoleGroup } from "@/hooks/use-user-roles";
import { formatPermissionLines, roleNameToSystemRole } from "@/lib/user-form-schema";
import { Input } from "@propninja/ui/input";
import { cn } from "@propninja/ui/lib/utils";
import { Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";

type UserRolesPanelProps = {
  roles: UserRoleGroup[];
  selectedRoleName: string;
  onSelectRole: (name: string) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  error?: string;
};

export function UserRolesPanel({
  roles,
  selectedRoleName,
  onSelectRole,
  readOnly = false,
  isAdmin = false,
  error,
}: UserRolesPanelProps) {
  const [search, setSearch] = useState("");

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roles.filter((role) => {
      if (!isAdmin && roleNameToSystemRole(role.name) === "admin") return false;
      if (!term) return true;
      return role.name.toLowerCase().includes(term);
    });
  }, [isAdmin, roles, search]);

  const selectedRole = roles.find((role) => role.name === selectedRoleName) ?? filteredRoles[0];
  const permissionLines = formatPermissionLines(selectedRole?.permissions ?? []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search for role..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        {filteredRoles.map((role) => {
          const isSelected = role.name === selectedRoleName;
          return (
            <button
              key={role.id}
              type="button"
              disabled={readOnly}
              onClick={() => onSelectRole(role.name)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-black bg-background hover:border-border",
                readOnly && "cursor-default opacity-80",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-primary" : "border-muted-foreground/40",
                )}
              >
                {isSelected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{role.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {role.permissions.includes("*")
                    ? "Full system access"
                    : `${role.permissions.length} permissions`}
                </span>
              </span>
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="rounded-xl border border-slate-200/80 bg-muted/30 p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">Permissions</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedRole
            ? `Access granted for the ${selectedRole.name} role.`
            : "Select a role to view permissions."}
        </p>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-muted-foreground">
          {permissionLines.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
