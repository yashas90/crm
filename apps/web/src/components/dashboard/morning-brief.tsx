"use client";

import { EmptyState } from "@/components/common/empty-state";
import { NeuButton, NeuCard } from "@/components/ui/neubrutal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type MorningBrief as MorningBriefData,
  type MorningCallback,
  useCompleteMorningCallback,
  useMorningBrief,
} from "@/hooks/use-morning-brief";
import { useSession } from "@/hooks/use-session";
import { apiPost } from "@/lib/apiClient";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { memo, useEffect, useState } from "react";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesAgo(updatedAt: number) {
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000));
}

function useBrowserOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

const SectionSkeleton = memo(function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
});

const TargetCard = memo(function TargetCard({ brief }: { brief: MorningBriefData }) {
  const width = Math.max(0, Math.min(100, brief.target.percent));
  return (
    <NeuCard className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">This month</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {brief.target.achievedLabel}
            <span className="text-base font-medium text-slate-400">
              {" "}
              / {brief.target.amountLabel}
            </span>
          </p>
        </div>
        <span
          className={
            brief.target.unlocked
              ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700"
              : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
          }
        >
          {brief.target.unlocked ? "Unlocked" : "Locked"} · {brief.target.aboveTargetPercent}% above
          target
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[#204060]" style={{ width: `${width}%` }} />
      </div>
      <p className="text-sm text-slate-600">
        {brief.target.dailyNeededLabel} a day · {brief.target.daysRemaining} days left ·{" "}
        {brief.target.percent}% of target
      </p>
    </NeuCard>
  );
});

const TeamTargetCard = memo(function TeamTargetCard({
  team,
}: {
  team: NonNullable<MorningBriefData["teamTarget"]>;
}) {
  return (
    <NeuCard className="space-y-2 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Team target</p>
      <p className="text-xl font-bold text-slate-900 dark:text-white">
        {team.achievedLabel}
        <span className="text-base font-medium text-slate-400"> / {team.targetLabel}</span>
      </p>
      <p className="text-sm text-slate-600">
        {team.aboveTargetCount} of {team.memberCount} above target
      </p>
    </NeuCard>
  );
});

const CallbackList = memo(function CallbackList({
  title,
  items,
  pendingId,
  onDone,
}: {
  title: string;
  items: MorningCallback[];
  pendingId: string | null;
  onDone: (item: MorningCallback) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {items.map((item) => (
        <div key={`${item.source}:${item.id}`} className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            {item.leadId ? (
              <Link href={`/leads/${item.leadId}`} className="font-medium text-[#204060]">
                {item.name}
              </Link>
            ) : (
              <span className="font-medium">{item.name}</span>
            )}
            <p className="text-xs text-slate-500">{formatWhen(item.at)}</p>
          </div>
          {item.phone ? (
            <a href={`tel:${item.phone}`}>
              <NeuButton type="button">Call now</NeuButton>
            </a>
          ) : null}
          <NeuButton
            type="button"
            disabled={pendingId === item.id}
            onClick={() => onDone(item)}
            aria-label={`Mark ${item.name} done`}
          >
            Done
          </NeuButton>
        </div>
      ))}
    </div>
  );
});

export function MorningBrief() {
  const brief = useMorningBrief();
  const done = useCompleteMorningCallback();
  const { session } = useSession();
  const online = useBrowserOnline();
  const [requestNote, setRequestNote] = useState<string | null>(null);
  const requestData = useMutation({
    mutationFn: () =>
      apiPost<{ contactsAssigned: number; denialReason: string | null }>(
        "/api/agent/request-data",
        {},
      ),
    onSuccess: (result) => {
      setRequestNote(
        result.denialReason ?? `${result.contactsAssigned} contacts assigned. Start calling.`,
      );
    },
    onError: (error: Error) => setRequestNote(error.message),
  });

  const data = brief.data;
  const loading = brief.isLoading && !data;
  const role = session?.role ?? "agent";
  const reportsHref = role === "agent" ? "/reports/calls" : "/reports";

  if (brief.isError && !data) {
    return (
      <EmptyState
        title="Couldn't load your morning brief"
        description="Your morning brief failed to load."
        actionLabel="Retry"
        onActionClick={() => void brief.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {!online && data && brief.dataUpdatedAt > 0 ? (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
          Showing data from {minutesAgo(brief.dataUpdatedAt)} minutes ago — offline
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {loading ? (
            <SectionSkeleton lines={2} />
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-white">
                {data?.greeting}, {data?.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{data?.date}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data ? (
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold">
              Tracking {data.trackingStatus.label}
              {data.trackingStatus.health ? ` · ${data.trackingStatus.health}` : ""}
            </span>
          ) : null}
          <NeuButton type="button" onClick={() => void brief.refetch()} disabled={brief.isFetching}>
            Refresh
          </NeuButton>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/leads">
          <NeuButton type="button" variant="primary">
            Start calling
          </NeuButton>
        </Link>
        <Link href="/leads">
          <NeuButton type="button">Add lead</NeuButton>
        </Link>
        <Link href={reportsHref}>
          <NeuButton type="button">Reports</NeuButton>
        </Link>
        <Link href={data?.teamFeed.viewAll.webPath ?? "/leaderboard"}>
          <NeuButton type="button">{role === "admin" ? "WhatsApp" : "Team"}</NeuButton>
        </Link>
        <Link href="/leaderboard">
          <NeuButton type="button">Leaderboard</NeuButton>
        </Link>
        {role === "agent" ? (
          <NeuButton
            type="button"
            disabled={requestData.isPending}
            onClick={() => requestData.mutate()}
          >
            Request more calling data
          </NeuButton>
        ) : null}
        {role === "admin" ? (
          <Link href="/calling-data">
            <NeuButton type="button">Calling data</NeuButton>
          </Link>
        ) : null}
      </div>
      {requestNote ? <p className="text-sm text-slate-600">{requestNote}</p> : null}

      <NeuCard className="p-5">
        {loading ? (
          <SectionSkeleton lines={2} />
        ) : (
          <p className="text-base text-slate-700 dark:text-slate-200">“{data?.quoteOfDay.text}”</p>
        )}
      </NeuCard>

      {loading ? (
        <NeuCard className="p-5">
          <SectionSkeleton />
        </NeuCard>
      ) : data ? (
        <TargetCard brief={data} />
      ) : null}

      {data?.teamTarget ? <TeamTargetCard team={data.teamTarget} /> : null}

      <NeuCard className="space-y-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Callbacks{data ? ` · ${data.callbacks.count}` : ""}
        </p>
        {loading ? (
          <SectionSkeleton />
        ) : data && data.callbacks.count === 0 ? (
          <p className="text-sm text-slate-500">No callbacks due today.</p>
        ) : data ? (
          <>
            <CallbackList
              title="Overdue"
              items={data.callbacks.overdue}
              pendingId={done.isPending ? (done.variables?.id ?? null) : null}
              onDone={(item) => done.mutate({ source: item.source, id: item.id })}
            />
            <CallbackList
              title="Today"
              items={data.callbacks.today}
              pendingId={done.isPending ? (done.variables?.id ?? null) : null}
              onDone={(item) => done.mutate({ source: item.source, id: item.id })}
            />
          </>
        ) : null}
      </NeuCard>

      <div className="grid gap-4 md:grid-cols-2">
        <NeuCard className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Leaderboard
          </p>
          {loading || !data ? (
            <SectionSkeleton lines={3} />
          ) : (
            <>
              <p className="text-2xl font-bold">#{data.leaderboard.rank}</p>
              <p className="text-sm text-slate-600">
                Yesterday #{data.leaderboard.previousRank ?? "—"} · {data.leaderboard.trend}
              </p>
              <p className="text-sm text-slate-600">
                {data.leaderboard.nameAbove
                  ? `${data.leaderboard.gapToNextLabel} behind ${data.leaderboard.nameAbove}`
                  : "You are at the top of this board"}
              </p>
              {data.leaderboard.neighborBelow ? (
                <p className="text-sm text-slate-500">
                  Next behind you: {data.leaderboard.neighborBelow.name} #
                  {data.leaderboard.neighborBelow.rank}
                </p>
              ) : null}
            </>
          )}
        </NeuCard>
        <NeuCard className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Calling data
          </p>
          {loading || !data ? (
            <SectionSkeleton lines={2} />
          ) : (
            <p className="text-sm text-slate-700">
              {data.callingData.pending} pending · {data.callingData.calledToday} called today ·{" "}
              {data.callingData.interestedToday} interested today · {data.callingData.remaining}{" "}
              remaining
            </p>
          )}
        </NeuCard>
      </div>

      <NeuCard className="space-y-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Leads</p>
        {loading || !data ? (
          <SectionSkeleton lines={2} />
        ) : (
          <p className="text-sm text-slate-700">
            {data.leads.hot} hot · {data.leads.warm} warm · {data.leads.cold} cold ·{" "}
            {data.leads.siteVisit} site visit · {data.leads.negotiation} negotiation ·{" "}
            {data.leads.urgent} urgent
          </p>
        )}
      </NeuCard>

      <NeuCard className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Team feed</p>
          {data ? (
            <Link
              href={data.teamFeed.viewAll.webPath}
              className="text-sm font-semibold text-[#204060]"
            >
              {data.teamFeed.viewAll.label}
            </Link>
          ) : null}
        </div>
        {loading || !data ? (
          <SectionSkeleton />
        ) : data.teamFeed.items.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing new from the team yet.</p>
        ) : (
          data.teamFeed.items.map((item) => (
            <div key={item.id}>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="whitespace-pre-line text-sm text-slate-600">{item.body}</p>
              <p className="text-xs text-slate-400">{item.reactions} reactions</p>
            </div>
          ))
        )}
      </NeuCard>

      {loading ? (
        <NeuCard className="p-5">
          <SectionSkeleton lines={2} />
        </NeuCard>
      ) : data && data.schedule.items.length > 0 ? (
        <NeuCard className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Today&apos;s visits
          </p>
          {data.schedule.items.map((visit) => (
            <p key={visit.id} className="text-sm text-slate-700">
              {visit.timeLabel} · {visit.leadName}
              {visit.projectName ? ` · ${visit.projectName}` : ""} · {visit.status}
              {visit.agentName ? ` · ${visit.agentName}` : ""}
            </p>
          ))}
        </NeuCard>
      ) : null}

      <NeuCard className="space-y-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Appraisal</p>
        {loading || !data ? (
          <SectionSkeleton lines={2} />
        ) : (
          <p className="text-sm text-slate-700">
            {data.appraisal.quarterLabel}: {data.appraisal.sales} sales / {data.appraisal.units}{" "}
            units
            {data.appraisal.minSales != null
              ? ` (need ${data.appraisal.minSales} / ${data.appraisal.minUnits})`
              : ""}
            . {Math.round(data.appraisal.hikePercent * 100)}% hike{" "}
            {data.appraisal.eligible ? `ready · ${data.appraisal.hikeAmountLabel}` : "not yet"}.
            {data.appraisal.mapped ? "" : " Designation is not on the appraisal sheet."}
          </p>
        )}
      </NeuCard>
    </div>
  );
}
