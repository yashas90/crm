import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

type MeResponse = {
  data?: { id: string; role: string };
};

async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_URL is not configured" }, { status: 500 });
  }

  const meRes = await fetch(`${apiBase.replace(/\/$/, "")}/api/auth/me`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meJson = (await meRes.json()) as MeResponse;
  if (meJson.data?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  return null;
}

/** Intentionally throws so admins can verify Sentry web/server capture. */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const error = new Error("PropNinja Sentry test error (web /api/sentry-test)");
  Sentry.captureException(error);
  await Sentry.flush(2000);
  throw error;
}
