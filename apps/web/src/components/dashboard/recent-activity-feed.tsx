"use client";

import { Badge } from "@/components/ui/badge";
import { NeuPolaroid } from "@/components/ui/neubrutal";
import { NeuSectionHeading } from "@/components/ui/neubrutal";
import type { RecentActivity } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Check, MessageSquare, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";

function activityIcon(type: string) {
  if (type === "call") return Phone;
  if (type === "note") return MessageSquare;
  if (type === "status_change") return Check;
  return RefreshCw;
}

function activityIconBg(type: string) {
  if (type === "call") return "bg-blue-100";
  if (type === "status_change") return "bg-green-100";
  return "bg-amber-100";
}

function activityTitle(activity: RecentActivity) {
  const meta = activity.metadata ?? {};
  if (activity.type === "call") {
    const status = typeof meta.status === "string" ? meta.status : "call";
    return `Call with ${activity.leadName}`;
  }
  if (activity.type === "note") return `Note on ${activity.leadName}`;
  if (activity.type === "status_change") {
    const to = typeof meta.to === "string" ? meta.to : "updated";
    return `Status update: ${activity.leadName}`;
  }
  return `${activity.type.replace("_", " ")}: ${activity.leadName}`;
}

function activityDescription(activity: RecentActivity) {
  const meta = activity.metadata ?? {};
  if (activity.type === "call") {
    const status = typeof meta.status === "string" ? meta.status : "logged";
    return `${activity.userName ?? "Agent"} logged a ${status} call.`;
  }
  if (activity.type === "note") {
    return `${activity.userName ?? "Agent"} added a note on this lead.`;
  }
  if (activity.type === "status_change") {
    const from = typeof meta.from === "string" ? meta.from : "?";
    const to = typeof meta.to === "string" ? meta.to : "?";
    return `Changed from "${from}" to "${to}" by ${activity.userName ?? "agent"}.`;
  }
  return `${activity.userName ?? "Someone"} updated this lead.`;
}

function relativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type RecentActivityFeedProps = {
  activities: RecentActivity[];
  variant?: "default" | "neubrutal";
};

export function RecentActivityFeed({ activities, variant = "default" }: RecentActivityFeedProps) {
  if (variant === "neubrutal") {
    if (activities.length === 0) {
      return <p className="text-sm text-neutral-600">No recent activity yet.</p>;
    }

    return (
      <div className="space-y-6">
        <NeuSectionHeading title="Activity Stream" />
        <div className="grid grid-cols-1 gap-8 pt-2 md:grid-cols-2">
          {activities.slice(0, 4).map((activity, index) => {
            const Icon = activityIcon(activity.type);
            return (
              <NeuPolaroid key={activity.id} tilt={index % 2 === 0 ? "left" : "right"}>
                <div
                  className={`mb-4 flex aspect-video items-center justify-center border border-black ${activityIconBg(activity.type)}`}
                >
                  <Icon className="h-10 w-10" />
                </div>
                <p className="mb-1 font-bold">
                  <Link href={`/leads/${activity.leadId}`} className="hover:underline">
                    {activityTitle(activity)}
                  </Link>
                </p>
                <p className="mb-4 text-sm italic text-neutral-600">
                  {activityDescription(activity)}
                </p>
                <span className="font-heading text-xs font-bold uppercase text-neutral-400">
                  {relativeTime(activity.createdAt)}
                </span>
              </NeuPolaroid>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className="">
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
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary shadow-[2px_2px_0_0_#000]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{activity.userName ?? "Someone"}</span>{" "}
                      {activityDescription(activity)} on{" "}
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
