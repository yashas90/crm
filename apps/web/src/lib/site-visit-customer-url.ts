export { buildSiteVisitCustomerUrl } from "@propninja/types/site-visit-public";

export function siteVisitCustomerUrlFromToken(publicToken: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://www.ninjamarketing.in");
  return `${base.replace(/\/$/, "")}/sitevisit/${encodeURIComponent(publicToken)}`;
}
