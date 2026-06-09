"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { UserForm } from "@/components/users/user-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useUser } from "@/hooks/use-users";
import { Button } from "@propninja/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type UserDetailPageProps = {
  params: { id: string };
};

export default function UserDetailPage({ params }: UserDetailPageProps) {
  const searchParams = useSearchParams();
  const readOnly = searchParams.get("view") === "1";
  const { ready, canUpdateUser, canViewUsers } = usePermissions();
  const userQuery = useUser(params.id, { enabled: ready && canViewUsers });

  if (ready && !canViewUsers) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User</h1>
        </div>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  if (userQuery.isLoading) {
    return <p className="text-muted-foreground">Loading user...</p>;
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">Unable to load user.</p>
        <Button asChild variant="outline">
          <Link href="/users">Back to users</Link>
        </Button>
      </div>
    );
  }

  const user = userQuery.data;
  const canEdit = canUpdateUser && !readOnly;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {readOnly ? "View User" : "Edit User"}
        </h1>
        <p className="text-sm text-muted-foreground">{user.name}</p>
      </div>
      <UserForm mode="edit" user={user} readOnly={!canEdit} />
    </div>
  );
}
