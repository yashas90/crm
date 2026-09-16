"use client";

import {
  downloadCampaignExport,
  downloadCampaignPdf,
  useBlastCampaigns,
  useCampaignReport,
  useWhatsAppReports,
} from "@/hooks/use-whatsapp-blaster";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import Link from "next/link";
import { useState } from "react";

export default function WhatsAppCampaignsPage() {
  const campaigns = useBlastCampaigns();
  const summary = useWhatsAppReports();
  const [openId, setOpenId] = useState<string | null>(null);
  const report = useCampaignReport(openId);
  const items = campaigns.data?.items ?? [];
  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Campaigns" value={s?.totalCampaigns ?? 0} />
        <Kpi title="Messages sent" value={s?.totalMessagesSent ?? 0} />
        <Kpi title="Delivery rate" value={`${s?.overallDeliveryRate ?? 0}%`} />
        <Kpi title="Interest rate" value={`${s?.overallInterestRate ?? 0}%`} />
        <Kpi title="Leads generated" value={s?.totalLeadsGenerated ?? 0} />
      </div>
      <p className="text-xs text-muted-foreground">{s?.provider.label}</p>
      <div className="overflow-auto rounded-xl border border-slate-200/80 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Interested</th>
              <th className="px-3 py-2">Leads</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{c.campaignCode}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.status}</td>
                <td className="px-3 py-2">{c.sentCount}</td>
                <td className="px-3 py-2">{c.interestedCount}</td>
                <td className="px-3 py-2">{c.leadsGenerated}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>
                      Report
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadCampaignExport(c.id, `${c.campaignCode}.csv`)}
                    >
                      Excel/CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadCampaignPdf(c.id, `${c.campaignCode}.pdf`)}
                    >
                      PDF
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/whatsapp">Open blaster</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && report.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign drill-down</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Funnel — sent {(report.data.funnel as { sent: number }).sent}, delivered{" "}
              {(report.data.funnel as { delivered: number }).delivered}, read{" "}
              {(report.data.funnel as { read: number }).read}, replied{" "}
              {(report.data.funnel as { replied: number }).replied}, interested{" "}
              {(report.data.funnel as { interested: number }).interested}
            </p>
            <div>
              {(
                report.data.questionBreakdown as Array<{
                  questionText: string;
                  answers: Array<{ label: string; percent: number; count: number }>;
                }>
              ).map((q) => (
                <p key={q.questionText}>
                  {q.questionText}{" "}
                  {q.answers.map((a) => `${a.percent}% said ${a.label}`).join(", ")}
                </p>
              ))}
            </div>
            <p>
              Agent distribution:{" "}
              {(report.data.agentDistribution as Array<{ name: string; count: number }>)
                .map((a) => `${a.name}: ${a.count}`)
                .join(" · ") || "—"}
            </p>
            <p>
              Time-of-day (IST replies):{" "}
              {(report.data.timeOfDay as Array<{ hour: number; replies: number }>)
                .filter((h) => h.replies > 0)
                .map((h) => `${h.hour}:00 (${h.replies})`)
                .join(" · ") || "No replies yet"}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
