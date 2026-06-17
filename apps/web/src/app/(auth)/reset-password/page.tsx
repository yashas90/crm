"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setInvalid(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ valid: boolean; email: string }>(
          `/api/auth/reset-password/${token}`,
        );
        if (cancelled) return;
        setEmail(data.email);
        setInvalid(false);
      } catch {
        if (cancelled) return;
        setInvalid(true);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
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

    setLoading(true);
    try {
      await apiPost<{ message: string }>("/api/auth/reset-password", {
        token,
        newPassword: password,
      });
      setDone(true);
      window.setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset password"));
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return <p className="text-sm text-muted-foreground">Validating reset link…</p>;
  }

  if (invalid) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          This link is invalid or has expired. Contact your admin.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <p className="font-medium text-foreground">Password updated successfully</p>
        <p className="text-muted-foreground">Redirecting you to sign in…</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      {email ? (
        <p className="text-sm text-muted-foreground">
          Resetting password for <span className="font-medium text-foreground">{email}</span>
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
