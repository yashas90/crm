"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { UserCreateForm } from "@/components/users/user-create-form";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isForbiddenError, useUpdateUser, useUsers, type UserRow } from "@/hooks/use-users";
import { getSession } from "@/lib/auth";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Pencil, UserPlus } from "lucide-react";
import { useState } from "react";

const ROLE_FILTERS = [
  { value: "", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "manager", label: "Managers" },
  { value: "agent", label: "Agents" },
] as const;

const ROLES = ["admin", "manager", "agent"] as const;

export default function UsersPage() {
  const session = getSession();
  const isAdmin = session?.role === "admin";
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const { data, isLoading, isError, error } = useUsers(roleFilter || undefined);
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Team members and roles for your organization.
            {isAdmin
              ? " Admins can add managers and agents, edit profiles, and reset passwords."
              : null}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setShowCreateForm((v) => !v)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add user
          </Button>
        ) : null}
      </div>

      {isAdmin && showCreateForm ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Create user</CardTitle>
          </CardHeader>
          <CardContent>
            <UserCreateForm onSuccess={() => setShowCreateForm(false)} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ROLE_FILTERS.map((filter) => (
          <Button
            key={filter.value || "all"}
            size="sm"
            variant={roleFilter === filter.value ? "default" : "outline"}
            onClick={() => setRoleFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
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
              <TableHead>Phone</TableHead>
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
              const isSelf = user.id === session?.id;

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone ?? "—"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <select
                        className={selectClass}
                        value={draft.role}
                        disabled={isSelf}
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
                          disabled={isSelf}
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
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingUser(user)}
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!changed || updateUser.isPending || isSelf}
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
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <UserEditDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        currentUserId={session?.id}
      />
    </div>
  );
}
