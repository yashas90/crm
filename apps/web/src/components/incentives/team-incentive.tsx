"use client";

import { QuarterSwitcher } from "@/components/incentives/quarter-switcher";
import { useTeamIncentive } from "@/hooks/use-incentives";
import { getErrorMessage } from "@/lib/errors";
import { currentQuarterKey, inr } from "@/lib/tcf-form";
import { useState } from "react";

export function TeamIncentive() {
  const [quarter, setQuarter] = useState(currentQuarterKey);
  const query = useTeamIncentive(quarter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Team incentive</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          N2 and N3 add their exclusive self business to the team&apos;s attributed net revenue. N1
          is paid on exclusive self business, plus 10% of a team member&apos;s base-slab incentive
          when that member&apos;s collected revenue is above 6 times their own monthly basic. Shared
          deals are not the leader&apos;s self business.
        </p>
      </div>
      <QuarterSwitcher quarter={quarter} onChange={setQuarter} />
      {query.data?.note ? <p className="text-sm text-amber-700">{query.data.note}</p> : null}
      {query.isError ? (
        <p className="text-sm text-rose-600">{getErrorMessage(query.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Band</th>
              <th className="px-3 py-2">Counted self</th>
              <th className="px-3 py-2">Counted team</th>
              <th className="px-3 py-2">Confirm self</th>
              <th className="px-3 py-2">Confirm team</th>
              <th className="px-3 py-2">Provisional</th>
              <th className="px-3 py-2">Earned</th>
              <th className="px-3 py-2">Pay + adv</th>
              <th className="px-3 py-2">Due</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.members ?? []).map((member) => (
              <tr key={member.userId} className="border-t">
                <td className="px-3 py-2">{member.name}</td>
                <td className="px-3 py-2">{member.band ?? "—"}</td>
                <td className="px-3 py-2">{inr(member.payout.countedSelfNr)}</td>
                <td className="px-3 py-2">{inr(member.payout.countedTeamNr)}</td>
                <td className="px-3 py-2">{inr(member.payout.confirmSelfNr)}</td>
                <td className="px-3 py-2">{inr(member.payout.confirmTeamNr)}</td>
                <td className="px-3 py-2">{inr(member.payout.provisional)}</td>
                <td className="px-3 py-2">{inr(member.payout.earned)}</td>
                <td className="px-3 py-2">{inr(member.payout.payAdv)}</td>
                <td className="px-3 py-2">{inr(member.payout.due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
