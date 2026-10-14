"use client";

import { useApprovalActions, useQuarterBundle } from "@/hooks/use-approvals";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { formatINR } from "@propninja/types/money";
import { Button } from "@propninja/ui/button";

export function QuarterlyDisbursement({ quarter }: { quarter: string }) {
  const { isAdmin } = useSession();
  const query = useQuarterBundle(quarter, isAdmin);
  const actions = useApprovalActions();

  if (!isAdmin) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Quarterly disbursement</h2>
        <p className="text-sm text-slate-500">
          Bundles the approved months in {query.data?.quarter.name ?? quarter}. Marking disbursed
          does not move money by itself. It records that payroll has paid the quarter.
        </p>
      </div>
      {query.isError ? (
        <p className="text-sm text-rose-600">{getErrorMessage(query.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Grade</th>
              <th className="px-3 py-2">Cash total</th>
              <th className="px-3 py-2">ESOP total</th>
              <th className="px-3 py-2">Combined</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => (
              <tr key={row.userId} className="border-t">
                <td className="px-3 py-2">
                  <p>{row.employeeName}</p>
                  <p className="text-xs text-slate-500">
                    {row.months.map((month) => `${month.monthLabel}: ${month.status}`).join(" · ")}
                  </p>
                </td>
                <td className="px-3 py-2">{row.grade ?? "—"}</td>
                <td className="px-3 py-2">{formatINR(row.cashTotal)}</td>
                <td className="px-3 py-2">{formatINR(row.esopTotal)}</td>
                <td className="px-3 py-2">{formatINR(row.combinedTotal)}</td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!row.canDisburse || actions.disburse.isPending}
                    onClick={() =>
                      void actions.disburse
                        .mutateAsync({ quarter, userId: row.userId })
                        .then(() => toast.success("Marked as disbursed"))
                        .catch((error) => toast.error(getErrorMessage(error)))
                    }
                  >
                    Mark as disbursed
                  </Button>
                </td>
              </tr>
            ))}
            {(query.data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={6}>
                  No monthly incentive rows in this quarter yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={actions.disburse.isPending}
        onClick={() =>
          void actions.disburse
            .mutateAsync({ quarter })
            .then(() => toast.success("Quarter marked as disbursed"))
            .catch((error) => toast.error(getErrorMessage(error)))
        }
      >
        Mark all approved as disbursed
      </Button>
    </section>
  );
}
