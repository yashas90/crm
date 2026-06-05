"use client";

import { Badge } from "@/components/ui/badge";
import type { RecentActivity } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { MessageSquare, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";

function activityIcon(type: string) {
  if (type === "call") return Phone;
  if (type === "note") return MessageSquare;
  return RefreshCw;
}

function activityLabel(activity: RecentActivity) {
  const meta = activity.metadata ?? {};
  if (activity.type === "call") {
    const status = typeof meta.status === "string" ? meta.status : "call";
    return `logged a ${status} call`;
  }
  if (activity.type === "note") return "added a note";
  if (activity.type === "status_change") {
    const from = typeof meta.from === "string" ? meta.from : "?";
    const to = typeof meta.to === "string" ? meta.to : "?";
    return `changed status ${from} → ${to}`;
  }
  return activity.type.replace("_", " ");
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentActivityFeed({ activities }: { activities: RecentActivity[] }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity yet.</p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />
            {activities.map((activity) => {
              const Icon = activityIcon(activity.type);
              return (
                <div key={activity.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{activity.userName ?? "Someone"}</span>{" "}
                      {activityLabel(activity)} on{" "}
                      <Link
                        href={`/leads/${activity.leadId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {activity.leadName}
                      </Link>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {activity.type.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(activity.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
