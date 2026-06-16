import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "System Status — PropNinja CRM",
  description: "Public status for PropNinja CRM API and database connectivity",
};

export const revalidate = 30;

type HealthPayload = {
  status: string;
  version: string;
  timestamp: string;
  db?: string;
  service?: string;
  message?: string;
};

function resolveApiBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  return null;
}

async function fetchHealth(): Promise<{
  reachable: boolean;
  httpStatus: number | null;
  payload: HealthPayload | null;
  error: string | null;
}> {
  const apiBase = resolveApiBaseUrl();
  if (!apiBase) {
    return {
      reachable: false,
      httpStatus: null,
      payload: null,
      error: "NEXT_PUBLIC_API_URL is not configured",
    };
  }

  try {
    const res = await fetch(`${apiBase}/health`, { cache: "no-store" });
    const payload = (await res.json()) as HealthPayload;
    return {
      reachable: true,
      httpStatus: res.status,
      payload,
      error: null,
    };
  } catch (err) {
    return {
      reachable: false,
      httpStatus: null,
      payload: null,
      error: err instanceof Error ? err.message : "API unreachable",
    };
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "success" : "warning"} className="text-sm">
      {label}
    </Badge>
  );
}

function formatTimestamp(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function StatusPage() {
  const health = await fetchHealth();
  const apiOk = health.httpStatus === 200 && health.payload?.status === "ok";
  const dbOk = health.payload?.db === "ok";
  const deployTime = process.env.NEXT_PUBLIC_BUILD_TIME;
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">PropNinja CRM Status</h1>
          <p className="text-sm text-muted-foreground">Live service health for operators</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              API
              <StatusBadge ok={apiOk} label={apiOk ? "Operational" : "Degraded"} />
            </CardTitle>
            <CardDescription>{resolveApiBaseUrl() ?? "API URL not configured"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {health.error ? (
              <p className="text-destructive">{health.error}</p>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">HTTP status</span>
                  <span>{health.httpStatus ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">API version</span>
                  <span>{health.payload?.version ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Last checked</span>
                  <span>{formatTimestamp(health.payload?.timestamp)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Database
              <StatusBadge
                ok={dbOk}
                label={dbOk ? "Connected" : health.payload ? "Error" : "Unknown"}
              />
            </CardTitle>
            <CardDescription>From API /health response</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">DB status</span>
              <span>{health.payload?.db ?? "—"}</span>
            </div>
            {health.payload?.message ? (
              <p className="text-muted-foreground">{health.payload.message}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Web deploy</CardTitle>
            <CardDescription>Vercel build metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last deploy</span>
              <span>{formatTimestamp(deployTime)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Git commit</span>
              <span className="font-mono text-xs">{commitSha ? commitSha.slice(0, 7) : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Sign in to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
