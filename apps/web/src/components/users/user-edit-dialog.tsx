"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type UserRow, useResetUserPassword, useUpdateUser } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { Eye, EyeOff } from "lucide-react";
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
  const resetPassword = useResetUserPassword();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("agent");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const isSelf = user?.id === currentUserId;
  const isLastAdmin = user?.isLastAdmin === true;
  const lastAdminTooltip = "At least one admin must exist";
  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setRole(user.role);
    setIsActive(user.isActive);
    setError(null);
    setResetOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setResetError(null);
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
    } = {};

    if (name !== user.name) payload.name = name;
    if (email !== user.email) payload.email = email;
    if (phone !== (user.phone ?? "")) payload.phone = phone || null;
    if (role !== user.role) payload.role = role;
    if (isActive !== user.isActive) payload.isActive = isActive;

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

  function handleResetPassword() {
    if (!user) return;
    setResetError(null);

    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    resetPassword.mutate(
      { userId: user.id, newPassword, userName: user.name },
      {
        onSuccess: () => {
          setResetOpen(false);
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => setResetError(getErrorMessage(err, "Failed to reset password")),
      },
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update profile, role, or active status.</DialogDescription>
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
                  disabled={isSelf || isLastAdmin}
                  title={isLastAdmin ? lastAdminTooltip : undefined}
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
                ) : isLastAdmin ? (
                  <p className="text-xs text-muted-foreground">{lastAdminTooltip}</p>
                ) : null}
              </div>
              <label
                className="flex items-center gap-2 text-sm"
                title={isLastAdmin ? lastAdminTooltip : undefined}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isSelf || isLastAdmin}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active account
              </label>
              {isLastAdmin && !isSelf ? (
                <p className="text-xs text-muted-foreground">{lastAdminTooltip}</p>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setResetOpen(true)}>
                Reset password
              </Button>
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

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {user?.name}. Share it with them directly — no email is sent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password">Confirm password</Label>
              <Input
                id="reset-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </div>
            {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Saving..." : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
