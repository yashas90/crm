"use client";

import { apiPost } from "@/lib/apiClient";
import { fetchCurrentUser, setAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === "development";
  const [email, setEmail] = useState(isDev ? "admin@propninja.local" : "");
  const [password, setPassword] = useState(isDev ? "admin" : "");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await apiPost<{
        token: string;
        user: { id: string; email: string; name: string; role: string };
      }>("/api/auth/login", { email, password });
      setAuth(data.token, data.user);
      const me = await fetchCurrentUser();
      toast.success(`Welcome, ${me?.name ?? data.user.name}`);
      router.push("/");
    } catch (err) {
      toast.error(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden rounded-2xl border-slate-200/60 bg-white/80 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="h-1 w-full bg-gradient-to-r from-[#204060] to-[#2d5a8a]" />
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Use your organization credentials.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => void handleLogin(e)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm font-medium text-neutral-600">
            <Link href="/forgot-password" className="font-bold text-[#204060] hover:underline">
              Forgot your password?
            </Link>
          </p>
        </form>
        {isDev ? (
          <p className="mt-4 text-center text-sm text-neutral-600">
            Demo: admin@propninja.local / admin
          </p>
        ) : null}
        <p className="mt-2 text-center text-sm text-neutral-600">
          No account?{" "}
          <Link href="/register" className="font-bold text-[#204060] hover:underline">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
