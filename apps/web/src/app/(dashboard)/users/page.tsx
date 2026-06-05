"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isForbiddenError, useUpdateUser, useUsers } from "@/hooks/use-users";
import { getSession } from "@/lib/auth";
import { Button } from "@propninja/ui/button";
import { useState } from "react";

const ROLES = ["admin", "manager", "agent"] as const;

export default function UsersPage() {
  const session = getSession();
  const isAdmin = session?.role === "admin";
  const { data, isLoading, isError, error } = useUsers();
  const updateUser = useUpdateUser();
  const [drafts, setDrafts] = useState<Record<string, { role: string; isActive: boolean }>>({});

  function getDraft(user: { id: string; role: string; isActive: boolean }) {
    return drafts[user.id] ?? { role: user.role, isActive: user.isActive };
  }

  function setDraft(
    user: { id: string; role: string; isActive: boolean },
    patch: Partial<{ role: string; isActive: boolean }>,
  ) {
    const current = getDraft(user);
    setDrafts((prev) => ({
      ...prev,
      [user.id]: { ...current, ...patch },
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Team members and roles for your organization.
          {isAdmin ? " Admins can update role and active status." : null}
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading users...</p>
      ) : isError ? (
        isForbiddenError(error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load users.</p>
        )
      ) : !data ? (
        <p className="text-muted-foreground">Unable to load users.</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
              {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => {
              const draft = getDraft(user);
              const changed = draft.role !== user.role || draft.isActive !== user.isActive;
              const selectClass =
                "flex h-9 rounded-md border border-input bg-background px-2 text-sm capitalize";

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <select
                        className={selectClass}
                        value={draft.role}
                        onChange={(event) => setDraft(user, { role: event.target.value })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {user.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) => setDraft(user, { isActive: event.target.checked })}
                        />
                        {draft.isActive ? "Active" : "Inactive"}
                      </label>
                    ) : user.isActive ? (
                      "Active"
                    ) : (
                      "Inactive"
                    )}
                  </TableCell>
                  {isAdmin ? (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!changed || updateUser.isPending}
                        onClick={() =>
                          updateUser.mutate(
                            {
                              userId: user.id,
                              payload: {
                                role: draft.role,
                                isActive: draft.isActive,
                              },
                            },
                            {
                              onSuccess: () => {
                                setDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[user.id];
                                  return next;
                                });
                              },
                            },
                          )
                        }
                      >
                        Save
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
