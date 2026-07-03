import type { PublicSiteVisitView } from "@propninja/types/site-visit-public";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

async function parseEnvelope<T>(res: Response): Promise<T | null> {
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.ok) return null;
  return body.data;
}

export async function fetchPublicSiteVisit(token: string): Promise<PublicSiteVisitView | null> {
  if (!API_URL) return null;
  const res = await fetch(`${API_URL}/api/public/site-visits/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  return parseEnvelope<PublicSiteVisitView>(res);
}

export async function reschedulePublicSiteVisit(
  token: string,
  payload: { visitDate: string; visitTime: string },
): Promise<{ data: PublicSiteVisitView | null; error?: string }> {
  if (!API_URL) return { data: null, error: "API not configured" };
  const res = await fetch(
    `${API_URL}/api/public/site-visits/${encodeURIComponent(token)}/reschedule`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = (await res.json()) as ApiEnvelope<PublicSiteVisitView>;
  if (!res.ok || !body.ok) {
    return { data: null, error: body.ok ? "Request failed" : body.error.message };
  }
  return { data: body.data };
}

export async function cancelPublicSiteVisit(
  token: string,
): Promise<{ data: PublicSiteVisitView | null; error?: string }> {
  if (!API_URL) return { data: null, error: "API not configured" };
  const res = await fetch(`${API_URL}/api/public/site-visits/${encodeURIComponent(token)}/cancel`, {
    method: "POST",
  });
  const body = (await res.json()) as ApiEnvelope<PublicSiteVisitView>;
  if (!res.ok || !body.ok) {
    return { data: null, error: body.ok ? "Request failed" : body.error.message };
  }
  return { data: body.data };
}
