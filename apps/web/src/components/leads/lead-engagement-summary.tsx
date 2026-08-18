"use client";

import type { LeadActivity } from "@/hooks/use-leads";
import { type SiteVisit, formatVisitTime, useSiteVisits } from "@/hooks/use-site-visits";
import { CalendarDays } from "lucide-react";

function pickSiteVisit(visits: SiteVisit[]): SiteVisit | null {
  if (visits.length === 0) return null;
  const booked = visits.find((visit) => visit.status === "scheduled") ?? visits[0];
  return booked ?? null;
}

function formatMediumDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function firstFollowUpAt(activities: LeadActivity[]): string | null {
  const followUps = activities
    .filter((activity) => activity.type === "follow_up")
    .map((activity) => activity.createdAt)
    .sort();
  return followUps[0] ?? null;
}

type LeadEngagementSummaryProps = {
  leadId: string;
  ownerName: string | null;
  createdAt: string;
  followUpCount?: number;
  activities?: LeadActivity[];
};

export function LeadEngagementSummary({
  leadId,
  ownerName,
  createdAt,
  followUpCount = 0,
  activities = [],
}: LeadEngagementSummaryProps) {
  const visitsQuery = useSiteVisits({ leadId, pageSize: 20 }, { enabled: Boolean(leadId) });
  const visit = pickSiteVisit(visitsQuery.data?.items ?? []);
  const followUpStart = firstFollowUpAt(activities) ?? (followUpCount > 0 ? createdAt : null);

  if (!ownerName && !visit && followUpCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {ownerName && followUpStart ? (
        <p className="text-foreground/90">
          Followed up by <span className="font-semibold">{ownerName}</span> since{" "}
          {formatMediumDate(followUpStart)}
          {followUpCount > 0
            ? ` · ${followUpCount} completed follow-up${followUpCount === 1 ? "" : "s"}`
            : ""}
        </p>
      ) : null}
      {visit ? (
        <p className="inline-flex flex-wrap items-center gap-1.5 text-sky-800 dark:text-sky-300">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="font-semibold">Site visit booked</span>
          <span>
            {visit.visitDate} · {formatVisitTime(visit.visitTime)}
            {visit.propertyLabel || visit.propertyAddress
              ? ` · ${visit.propertyLabel ?? visit.propertyAddress}`
              : ""}
            {visit.agent?.name ? ` · ${visit.agent.name}` : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}
