"use client";

import { QuarterSwitcher } from "@/components/incentives/quarter-switcher";
import { QuarterlyDisbursement } from "@/components/incentives/quarterly-disbursement";
import { useSession } from "@/hooks/use-session";
import { currentQuarterKey } from "@/lib/tcf-form";
import { useState } from "react";

export function IncentiveDisbursement() {
  const { isAdmin, ready } = useSession();
  const [quarter, setQuarter] = useState(currentQuarterKey);

  if (!ready) return <p className="text-sm text-slate-500">Loading disbursements…</p>;
  if (!isAdmin) {
    return <p className="text-sm">Only an admin can mark a quarterly incentive as disbursed.</p>;
  }

  return (
    <div className="space-y-4">
      <QuarterSwitcher quarter={quarter} onChange={setQuarter} />
      <QuarterlyDisbursement quarter={quarter} />
    </div>
  );
}
