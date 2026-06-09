"use client";

import { QuickFilterTabs } from "@/components/common/quick-filter-tabs";

type AdSourceFilter = "all" | "ad_leads";

const AD_SOURCE_TABS: { id: AdSourceFilter; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "ad_leads", label: "Ad Leads" },
];

type LeadsAdSourceTabsProps = {
  adLeadsOnly: boolean;
  onChange: (adLeadsOnly: boolean) => void;
  className?: string;
};

export function LeadsAdSourceTabs({ adLeadsOnly, onChange, className }: LeadsAdSourceTabsProps) {
  return (
    <QuickFilterTabs
      tabs={AD_SOURCE_TABS}
      value={adLeadsOnly ? "ad_leads" : "all"}
      onChange={(value) => onChange(value === "ad_leads")}
      variant="pill"
      ariaLabel="Lead source type"
      className={className}
    />
  );
}
