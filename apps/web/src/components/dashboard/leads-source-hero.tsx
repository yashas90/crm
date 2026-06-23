"use client";

import { LeadsFromSource } from "@/components/dashboard/leads-from-source";
import type { SourceGroupReport } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Megaphone, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

type LeadsSourceHeroProps = {
  groups: SourceGroupReport[];
  className?: string;
};

export function LeadsSourceHero({ groups, className }: LeadsSourceHeroProps) {
  const { total, topSources, socialTotal, portalTotal } = useMemo(() => {
    const flat = groups.flatMap((group) =>
      group.sources.map((source) => ({ ...source, group: group.sourceGroup })),
    );
    const sorted = [...flat].sort((a, b) => b.count - a.count);
    const sum = sorted.reduce((acc, row) => acc + row.count, 0);
    const social = groups.find((g) => g.sourceGroup === "Social");
    const portals = groups.find((g) => g.sourceGroup === "Portals");
    return {
      total: sum,
      topSources: sorted.filter((s) => s.count > 0).slice(0, 6),
      socialTotal: social?.sources.reduce((n, s) => n + s.count, 0) ?? 0,
      portalTotal: portals?.sources.reduce((n, s) => n + s.count, 0) ?? 0,
    };
  }, [groups]);

  const maxCount = topSources[0]?.count ?? 1;

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lead sources
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {total.toLocaleString()} leads across channels
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Facebook, Google, portals, and walk-ins in one view — like LeadRat.
          </p>
        </div>
        <Link
          href="/reports/sources"
          className="text-sm font-semibold text-[#204060] hover:underline"
        >
          Full source report →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSources.length === 0 ? (
              <p className="text-sm text-slate-500">No lead source data yet.</p>
            ) : (
              topSources.map((source) => (
                <div key={source.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{source.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {source.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#204060] transition-all"
                      style={{ width: `${Math.max(8, (source.count / maxCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600">
                <Megaphone className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Social & ads</p>
                <p className="text-2xl font-bold text-slate-900">{socialTotal}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Property portals</p>
                <p className="text-2xl font-bold text-slate-900">{portalTotal}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <LeadsFromSource groups={groups} />
    </section>
  );
}
