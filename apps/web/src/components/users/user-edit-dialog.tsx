"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type UserRow, useUpdateUser } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useEffect, useState } from "react";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent" },
] as const;

type UserEditDialogProps = {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
};

export function UserEditDialog({ user, open, onOpenChange, currentUserId }: UserEditDialogProps) {
  const updateUser = useUpdateUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("agent");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSelf = user?.id === currentUserId;
  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize";

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setRole(user.role);
    setIsActive(user.isActive);
    setPassword("");
    setError(null);
  }, [user]);

  function handleSave() {
    if (!user) return;
    setError(null);

    const payload: {
      name?: string;
      email?: string;
      phone?: string | null;
      role?: string;
      isActive?: boolean;
      password?: string;
    } = {};

    if (name !== user.name) payload.name = name;
    if (email !== user.email) payload.email = email;
    if (phone !== (user.phone ?? "")) payload.phone = phone || null;
    if (role !== user.role) payload.role = role;
    if (isActive !== user.isActive) payload.isActive = isActive;
    if (password.trim()) payload.password = password.trim();

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    updateUser.mutate(
      { userId: user.id, payload },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(getErrorMessage(err, "Failed to update user")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update profile, role, or reset password. Managers and agents can be managed here.
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                className={selectClass}
                value={role}
                disabled={isSelf}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isSelf ? (
                <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isSelf}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active account
            </label>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New password (optional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                minLength={6}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateUser.isPending || !user}>
            {updateUser.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
