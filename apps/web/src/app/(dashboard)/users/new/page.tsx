"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { UserForm } from "@/components/users/user-form";
import { usePermissions } from "@/hooks/use-permissions";
export default function NewUserPage() {
  const { ready, canCreateUser } = usePermissions();

  if (ready && !canCreateUser) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add User</h1>
          <p className="text-sm text-muted-foreground">Create a new team member account.</p>
        </div>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add User</h1>
        <p className="text-sm text-muted-foreground">
          Enter profile, office, and role details for the new user.
        </p>
      </div>
      <UserForm mode="create" />
    </div>
  );
}
