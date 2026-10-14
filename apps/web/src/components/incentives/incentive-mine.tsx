"use client";

import { QuarterSwitcher } from "@/components/incentives/quarter-switcher";
import { useMyIncentive } from "@/hooks/use-incentives";
import { getErrorMessage } from "@/lib/errors";
import { currentQuarterKey, inr } from "@/lib/tcf-form";
import { useState } from "react";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export function IncentiveMine() {
  const [quarter, setQuarter] = useState(currentQuarterKey);
  const query = useMyIncentive(quarter);
  const payout = query.data?.payout;
  const profile = query.data?.profile;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My incentive</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Incentive is a percent of net revenue above a monthly-basic hurdle. Nothing is paid until
          approved TCF revenue is above monthly basic times the band multiplier. The extra uses the
          above-target percent. Convertible deals use the till-target percent. Twenty percent of the
          incentive is ESOP and eighty percent is cash. Due stays zero until the invoice is
          collected.
        </p>
      </div>
      <QuarterSwitcher quarter={quarter} onChange={setQuarter} />
      {query.isError ? (
        <p className="text-sm text-rose-600">{getErrorMessage(query.error)}</p>
      ) : null}
      {profile ? (
        <p className="text-sm">
          {profile.name} · band {profile.band ?? "not set"} · designation{" "}
          {profile.designation ?? "not set"} · monthly basic {inr(profile.monthlyBasic)}
        </p>
      ) : (
        <p className="text-sm text-amber-700">
          An admin still needs to set your band and monthly basic. Incentive is zero until then.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        {(query.data?.slabs ?? []).map((slab) => (
          <div key={slab.band} className="rounded-lg border p-3 text-sm">
            <p className="font-semibold">{slab.band}</p>
            <p>Eligibility {slab.multiplier}x monthly basic</p>
            <p>Till target {slab.tillPercent}%</p>
            <p>Above target {slab.abovePercent}%</p>
          </div>
        ))}
      </div>
      {payout ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Counted self business" value={inr(payout.countedSelfNr)} />
            <Metric label="Counted team business" value={inr(payout.countedTeamNr)} />
            <Metric label="Confirm self business" value={inr(payout.confirmSelfNr)} />
            <Metric label="Confirm team business" value={inr(payout.confirmTeamNr)} />
            <Metric label="Eligibility target" value={inr(payout.eligibilityTarget)} />
            <Metric label="Provisional incentive" value={inr(payout.provisional)} />
            <Metric label="Earned incentive" value={inr(payout.earned)} />
            <Metric label="Pay + adv (80% cash)" value={inr(payout.payAdv)} />
            <Metric label="ESOP (20%)" value={inr(payout.esop)} />
            <Metric label="Due incentive" value={inr(payout.due)} />
            <Metric label="N1 team kicker" value={inr(payout.n1TeamKicker)} />
          </div>
          {(query.data?.approvals?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Gross</th>
                    <th className="px-3 py-2">Cash</th>
                    <th className="px-3 py-2">ESOP</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(query.data?.approvals ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">{row.monthKey}</td>
                      <td className="px-3 py-2">{inr(row.grossIncentive)}</td>
                      <td className="px-3 py-2">{inr(row.cashAmount)}</td>
                      <td className="px-3 py-2">{inr(row.esopAmount)}</td>
                      <td className="px-3 py-2">{inr(row.totalPayable)}</td>
                      <td className="px-3 py-2">
                        {row.status.replaceAll("_", " ")}
                        {row.rejectionReason ? ` — ${row.rejectionReason}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2">Quarter</th>
                  <th className="px-3 py-2">TCF</th>
                  <th className="px-3 py-2">Counted self NR</th>
                  <th className="px-3 py-2">Confirm self NR</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Self business</th>
                </tr>
              </thead>
              <tbody>
                {payout.deals.map((deal) => (
                  <tr key={deal.id} className="border-t">
                    <td className="px-3 py-2">{query.data?.quarter.label}</td>
                    <td className="px-3 py-2">{deal.tcfCode}</td>
                    <td className="px-3 py-2">{inr(deal.countedNr)}</td>
                    <td className="px-3 py-2">{inr(deal.confirmNr)}</td>
                    <td className="px-3 py-2">INR</td>
                    <td className="px-3 py-2">{deal.invoiceStatus.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2">{deal.exclusive ? "Exclusive" : "Shared"}</td>
                  </tr>
                ))}
                {payout.deals.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={7}>
                      No approved closures in this quarter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
