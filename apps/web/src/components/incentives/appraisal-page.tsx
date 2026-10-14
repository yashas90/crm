"use client";

import { InrInput } from "@/components/common/inr-input";
import { QuarterSwitcher } from "@/components/incentives/quarter-switcher";
import {
  type AppraisalResult,
  useAppraisal,
  useSaveIncentiveProfile,
} from "@/hooks/use-incentives";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/errors";
import { DESIGNATIONS, INCENTIVE_BANDS, currentQuarterKey, inr } from "@/lib/tcf-form";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { useState } from "react";

export function AppraisalPageContent() {
  const { isAdmin, isManager, ready } = useSession();
  const [quarter, setQuarter] = useState(currentQuarterKey);
  const query = useAppraisal(quarter);
  const canSeeAll = isAdmin || isManager;
  const mine = query.data?.results[0];

  if (!ready) return <p className="text-sm text-slate-500">Loading appraisal…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Appraisal policy — sales team</h1>
        <p className="text-sm text-slate-500">
          Gold sheet appraisal · Location: Bangalore · Department: Sales
        </p>
        <p className="max-w-3xl text-sm text-slate-500">
          A calendar quarter pays a 10% hike on monthly basic when the person hits both the minimum
          sales and the minimum units. A closure counts only after the TCF is admin-approved and the
          invoice is collected. Only that person&apos;s own share counts. An admin approves the
          hike. Salary updates on the 1st of the next month and is then used for the next target.
        </p>
      </div>
      <QuarterSwitcher quarter={quarter} onChange={setQuarter} />
      {query.isError ? (
        <p className="text-sm text-rose-600">{getErrorMessage(query.error)}</p>
      ) : null}
      <PolicyTable rows={query.data?.policy ?? []} />
      {!canSeeAll && mine ? (
        <AgentResult result={mine} quarterName={query.data?.quarter.name ?? ""} />
      ) : null}
      {canSeeAll ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Designation</th>
                <th className="px-3 py-2">Band</th>
                <th className="px-3 py-2">Monthly basic</th>
                <th className="px-3 py-2">Sales</th>
                <th className="px-3 py-2">Units</th>
                <th className="px-3 py-2">Hike</th>
                <th className="px-3 py-2">Recommended basic</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.results ?? []).map((result) =>
                isAdmin ? (
                  <AdminResultRow key={result.userId} result={result} />
                ) : (
                  <tr key={result.userId} className="border-t">
                    <td className="px-3 py-2">{result.name}</td>
                    <td className="px-3 py-2">{result.designation ?? "Not mapped"}</td>
                    <td className="px-3 py-2">{result.band ?? "—"}</td>
                    <td className="px-3 py-2">
                      {result.monthlyBasic == null ? "—" : inr(result.monthlyBasic)}
                    </td>
                    <td className="px-3 py-2">
                      {result.countedSales}
                      {result.minSales != null ? ` / ${result.minSales}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      {result.countedUnits}
                      {result.minUnits != null ? ` / ${result.minUnits}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      {result.mapped
                        ? result.eligible
                          ? result.hikeAmount == null
                            ? "Eligible"
                            : `Eligible ${inr(result.hikeAmount)}`
                          : "Not eligible"
                        : "Not mapped"}
                    </td>
                    <td className="px-3 py-2">
                      {result.recommendedBasic == null ? "—" : inr(result.recommendedBasic)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function PolicyTable({
  rows,
}: {
  rows: {
    designation: string;
    grade: string | null;
    minSales: number;
    minUnits: number;
    hikePercent: number;
  }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-200 text-xs uppercase">
          <tr>
            <th className="px-3 py-2">Designation</th>
            <th className="px-3 py-2">Grade</th>
            <th className="px-3 py-2">Minimum closures / units</th>
            <th className="px-3 py-2">Appraisal hike</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.designation} className="border-t">
              <td className="px-3 py-2">{row.designation}</td>
              <td className="px-3 py-2">{row.grade ?? "—"}</td>
              <td className="px-3 py-2">
                {row.minSales} sales / {row.minUnits} units
              </td>
              <td className="px-3 py-2">{Math.round(row.hikePercent * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-1 px-3 py-3 text-sm text-slate-600">
        <li>Appraisals are calculated on a calendar quarter basis (JFM, AMJ, JAS, OND).</li>
        <li>
          Appraisal slabs are effective only after the invoice is raised and payment is collected.
        </li>
        <li>All appraisals are based strictly on individual contribution.</li>
      </ul>
    </div>
  );
}

function AgentResult({ result, quarterName }: { result: AppraisalResult; quarterName: string }) {
  return (
    <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
      <p>
        <span className="text-slate-500">Designation</span>
        <br />
        {result.designation ?? "Not mapped"}
      </p>
      <p>
        <span className="text-slate-500">Quarter</span>
        <br />
        {quarterName}
      </p>
      <p>
        <span className="text-slate-500">Grade</span>
        <br />
        {result.mapped ? (result.grade ?? "None") : "Not mapped"}
      </p>
      <p>
        <span className="text-slate-500">Counted sales</span>
        <br />
        {result.countedSales} / {result.minSales ?? "—"}
      </p>
      <p>
        <span className="text-slate-500">Counted units</span>
        <br />
        {result.countedUnits} / {result.minUnits ?? "—"}
      </p>
      <p>
        <span className="text-slate-500">10% hike</span>
        <br />
        {result.eligible ? `Eligible · ${inr(result.hikeAmount)}` : "Not eligible"}
      </p>
      <p>
        <span className="text-slate-500">Recommended basic</span>
        <br />
        {inr(result.recommendedBasic)}
      </p>
    </div>
  );
}

function AdminResultRow({ result }: { result: AppraisalResult }) {
  const save = useSaveIncentiveProfile();
  const [designation, setDesignation] = useState(result.designation ?? "");
  const [band, setBand] = useState(result.band ?? "");
  const [basic, setBasic] = useState<number | null>(result.monthlyBasic);

  return (
    <tr className="border-t">
      <td className="px-3 py-2">{result.name}</td>
      <td className="px-3 py-2">
        <select
          className="h-9 max-w-56 rounded-md border bg-transparent px-2 text-sm"
          value={designation}
          onChange={(event) => setDesignation(event.target.value)}
        >
          <option value="">Not mapped</option>
          {DESIGNATIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={band}
          onChange={(event) => setBand(event.target.value)}
        >
          <option value="">Not set</option>
          {INCENTIVE_BANDS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <InrInput className="w-36" value={basic} onChange={setBasic} />
      </td>
      <td className="px-3 py-2">
        {result.countedSales}
        {result.minSales != null ? ` / ${result.minSales}` : ""}
      </td>
      <td className="px-3 py-2">
        {result.countedUnits}
        {result.minUnits != null ? ` / ${result.minUnits}` : ""}
      </td>
      <td className="px-3 py-2">
        {result.mapped
          ? result.eligible
            ? `Eligible ${inr(result.hikeAmount)}`
            : "Not eligible"
          : "Not mapped"}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span>{inr(result.recommendedBasic)}</span>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              const monthlyBasic = basic ?? 0;
              save.mutate(
                {
                  userId: result.userId,
                  designation: designation || null,
                  band: band || null,
                  monthlyBasic,
                },
                {
                  onSuccess: () => toast.success("Appraisal profile saved"),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              );
            }}
          >
            Save
          </Button>
        </div>
      </td>
    </tr>
  );
}
