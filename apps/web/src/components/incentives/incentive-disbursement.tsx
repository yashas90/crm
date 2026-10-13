"use client";

import { QuarterSwitcher } from "@/components/incentives/quarter-switcher";
import {
  useDisburseIncentive,
  useDisbursements,
  useSaveIncentiveProfile,
} from "@/hooks/use-incentives";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/errors";
import { INCENTIVE_BANDS, currentQuarterKey, inr } from "@/lib/tcf-form";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { useState } from "react";

export function IncentiveDisbursement() {
  const { isAdmin, ready } = useSession();
  const [quarter, setQuarter] = useState(currentQuarterKey);
  const query = useDisbursements(quarter, isAdmin);
  const disburse = useDisburseIncentive();
  const saveProfile = useSaveIncentiveProfile();

  if (!ready) return <p className="text-sm text-slate-500">Loading disbursements…</p>;

  if (!isAdmin) {
    return <p className="text-sm">Only an admin can mark a quarterly incentive as disbursed.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Incentive disbursement</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Marking a quarter disbursed records the earned cash and ESOP. It does not change payroll.
          Designation and monthly basic are edited on Appraisal.
        </p>
      </div>
      <QuarterSwitcher quarter={quarter} onChange={setQuarter} />
      {query.isError ? (
        <p className="text-sm text-rose-600">{getErrorMessage(query.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Band</th>
              <th className="px-3 py-2">Earned</th>
              <th className="px-3 py-2">Cash 80%</th>
              <th className="px-3 py-2">ESOP 20%</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => (
              <tr key={row.userId} className="border-t">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">
                  <select
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                    value={row.band ?? ""}
                    onChange={(event) =>
                      saveProfile.mutate(
                        { userId: row.userId, band: event.target.value || null },
                        {
                          onSuccess: () => toast.success("Band saved"),
                          onError: (error) => toast.error(getErrorMessage(error)),
                        },
                      )
                    }
                  >
                    <option value="">Not set</option>
                    {INCENTIVE_BANDS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">{inr(row.payout.earned)}</td>
                <td className="px-3 py-2">{inr(row.payout.cash)}</td>
                <td className="px-3 py-2">{inr(row.payout.esop)}</td>
                <td className="px-3 py-2">{inr(row.payout.due)}</td>
                <td className="px-3 py-2">
                  {row.disbursed ? (
                    <span className="text-emerald-700">Disbursed</span>
                  ) : (
                    <Button
                      type="button"
                      disabled={disburse.isPending || row.payout.earned <= 0}
                      onClick={() =>
                        disburse.mutate(
                          { userId: row.userId, quarter },
                          {
                            onSuccess: () => toast.success("Quarter marked disbursed"),
                            onError: (error) => toast.error(getErrorMessage(error)),
                          },
                        )
                      }
                    >
                      Mark disbursed
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
