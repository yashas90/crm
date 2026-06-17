"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangePassword } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useState } from "react";

export function FirstLoginModal() {
  const { session, ready } = useSession();
  const changePassword = useChangePassword();
  const [completed, setCompleted] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mustChange = !completed && ready && session?.isFirstLogin === true;

  if (!mustChange) {
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => setCompleted(true),
        onError: (err) => setError(getErrorMessage(err, "Current password is incorrect")),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome to PropNinja! Please set your password.</DialogTitle>
            <DialogDescription>
              Choose a secure password before continuing to your dashboard.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 py-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="first-login-current">Current password</Label>
              <Input
                id="first-login-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first-login-new">New password</Label>
              <Input
                id="first-login-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first-login-confirm">Confirm new password</Label>
              <Input
                id="first-login-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button
                type="submit"
                disabled={changePassword.isPending}
                className="w-full sm:w-auto"
              >
                {changePassword.isPending ? "Saving..." : "Set Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
