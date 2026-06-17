"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateUser } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const CREATE_ROLES = [
  { value: "agent", label: "Agent" },
  { value: "manager", label: "Manager" },
] as const;

type UserCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserCreateDialog({ open, onOpenChange }: UserCreateDialogProps) {
  const createUser = useCreateUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"agent" | "manager">("agent");
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("agent");
    setIsActive(true);
    setShowPassword(false);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    createUser.mutate(
      { name, email, password, role, isActive },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
        onError: (err) => {
          const message = getErrorMessage(err, "Failed to create user");
          setError(message.toLowerCase().includes("email") ? "Email already in use" : message);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Create an account with a temporary password. The user must change it on first login.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 py-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="create-name">Full name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">Password</Label>
            <div className="relative">
              <Input
                id="create-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
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
            <Label htmlFor="create-confirm-password">Confirm password</Label>
            <Input
              id="create-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-role">Role</Label>
            <select
              id="create-role"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value as "agent" | "manager")}
            >
              {CREATE_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active account
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
