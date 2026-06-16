"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { BarChart } from "@/components/reports/bar-chart";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { useReportFilters } from "@/hooks/use-report-filters";
import { downloadSourcesReportCsv, isForbiddenError, useSourceReport } from "@/hooks/use-reports";
import { Button } from "@propninja/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function isMetaAdsSource(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("facebook") ||
    n.includes("instagram") ||
    n.includes("whatsapp") ||
    n.includes("meta")
  );
}

function isGoogleAdsSource(name: string) {
  return name.toLowerCase().includes("google");
}

function isCsvImportSource(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("bulk_import") ||
    (n.includes("bulk") && n.includes("import")) ||
    (n.includes("csv") && n.includes("import"))
  );
}

export default function SourcesReportPage() {
  const { filters, setFilters, dateFrom, dateTo, labelFrom, labelTo } = useReportFilters();
  const sourcesReport = useSourceReport({ dateFrom, dateTo });
  const [isExporting, setIsExporting] = useState(false);

  const items = useMemo(() => {
    const leadsFromSource = sourcesReport.data?.leads_from_source ?? [];
    const flat = leadsFromSource.flatMap((group) =>
      group.sources.map((s) => ({ name: s.name, count: s.count })),
    );

    const meta = flat.filter((r) => isMetaAdsSource(r.name)).reduce((sum, r) => sum + r.count, 0);
    const google = flat
      .filter((r) => isGoogleAdsSource(r.name))
      .reduce((sum, r) => sum + r.count, 0);
    const csvImport = flat
      .filter((r) => isCsvImportSource(r.name))
      .reduce((sum, r) => sum + r.count, 0);
    const total = flat.reduce((sum, r) => sum + r.count, 0);
    const manual = Math.max(0, total - meta - google - csvImport);

    return [
      { label: "Meta Ads", value: meta },
      { label: "Google Ads", value: google },
      { label: "Manual", value: manual },
      { label: "CSV Import", value: csvImport },
    ];
  }, [sourcesReport.data]);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadSourcesReportCsv({ dateFrom, dateTo });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead sources</h1>
          <p className="text-muted-foreground">
            Lead counts by source ({labelFrom} → {labelTo}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports">← Reports</Link>
          </Button>
          <Button variant="outline" onClick={() => void handleExport()} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} hideAgent />

      {sourcesReport.isLoading ? (
        <p className="text-muted-foreground">Loading sources report...</p>
      ) : sourcesReport.isError ? (
        isForbiddenError(sourcesReport.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load sources report.</p>
        )
      ) : (
        <BarChart title="Leads by source" items={items} />
      )}
    </div>
  );
}
