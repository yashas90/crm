"use client";

import { QuarterlyDisbursement } from "@/components/incentives/quarterly-disbursement";
import {
  type AppraisalApproval,
  type ApprovalFilters,
  type IncentiveApproval,
  downloadAppraisalSheet,
  downloadIncentiveSheet,
  useAppraisalApprovals,
  useApprovalActions,
  useApprovalSummary,
  useIncentiveApprovals,
} from "@/hooks/use-approvals";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/errors";
import { currentQuarterKey } from "@/lib/tcf-form";
import { toast } from "@/lib/toast";
import { formatINR } from "@propninja/types/money";
import { Button } from "@propninja/ui/button";
import { Fragment, useMemo, useState } from "react";

const GRADES = ["NE", "N0", "N1", "N2", "N3"] as const;

const INCENTIVE_TABS = [
  { status: "pending_admin_approval", label: "Pending approval" },
  { status: "approved", label: "Approved" },
  { status: "disbursed", label: "Disbursed" },
  { status: "rejected", label: "Rejected" },
] as const;

const APPRAISAL_TABS = [
  { status: "pending_admin_approval", label: "Pending approval" },
  { status: "approved", label: "Approved" },
  { status: "salary_applied", label: "Salary applied" },
  { status: "rejected", label: "Rejected" },
] as const;

function previousMonthKey() {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [year, month] = key.slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonths() {
  const months: string[] = [];
  let cursor = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
    .format(new Date())
    .slice(0, 7);
  for (let index = 0; index < 12; index += 1) {
    months.push(cursor);
    const [year, month] = cursor.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1));
    cursor = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return months;
}

function recentQuarters() {
  const now = new Date();
  const quarters: string[] = [];
  let year = now.getFullYear();
  let month = now.getMonth();
  for (let index = 0; index < 8; index += 1) {
    const code = month < 3 ? "JFM" : month < 6 ? "AMJ" : month < 9 ? "JAS" : "OND";
    quarters.push(`${year}-${code}`);
    month -= 3;
    if (month < 0) {
      month += 12;
      year -= 1;
    }
  }
  return [...new Set(quarters)];
}

function percent(value: number) {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "salary_applied"
      ? "bg-emerald-100 text-emerald-800"
      : status === "disbursed"
        ? "bg-sky-100 text-sky-800"
        : status === "rejected"
          ? "bg-rose-100 text-rose-800"
          : "bg-amber-100 text-amber-800";
  const label = status.replaceAll("_", " ");
  return <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${tone}`}>{label}</span>;
}

export function ApprovalsPageContent() {
  const { isAdmin, ready } = useSession();
  const [tab, setTab] = useState<"incentives" | "appraisals">("incentives");
  const [status, setStatus] = useState("pending_admin_approval");
  const [month, setMonth] = useState(previousMonthKey);
  const [quarter, setQuarter] = useState(currentQuarterKey);
  const [grade, setGrade] = useState("");
  const [query, setQuery] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{
    kind: "incentive" | "appraisal";
    id: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const actions = useApprovalActions();
  const summary = useApprovalSummary(isAdmin);

  const filters: ApprovalFilters = {
    month: tab === "incentives" ? month : undefined,
    quarter,
    grade: grade || undefined,
    status,
    q: query.trim() || undefined,
    eligible: eligibleOnly || undefined,
  };
  const incentives = useIncentiveApprovals(filters, isAdmin && tab === "incentives");
  const appraisals = useAppraisalApprovals(
    { ...filters, month: undefined },
    isAdmin && tab === "appraisals",
  );

  const pendingIncentiveCount = summary.data?.pendingIncentives.employees ?? 0;
  const pendingAppraisalCount = summary.data?.pendingAppraisals.employees ?? 0;
  const months = useMemo(recentMonths, []);
  const quarters = useMemo(recentQuarters, []);

  if (!ready) return <p className="text-sm text-slate-500">Loading approvals…</p>;
  if (!isAdmin)
    return <p className="text-sm">Only an admin can approve incentives and appraisals.</p>;

  function onError(error: unknown) {
    toast.error(getErrorMessage(error));
  }

  function submitReject() {
    if (!rejecting || !reason.trim()) {
      toast.error("A written reason is required");
      return;
    }
    const body = { id: rejecting.id, reason: reason.trim() };
    const pending =
      rejecting.kind === "incentive"
        ? actions.rejectIncentive.mutateAsync(body)
        : actions.rejectAppraisal.mutateAsync(body);
    void pending
      .then(() => {
        toast.success("Rejected");
        setRejecting(null);
        setReason("");
      })
      .catch(onError);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Only an admin can approve incentives and appraisals. Amounts use Indian rupee grouping.
          Disbursement stays manual. Approved salary hikes apply on the 1st of the next month.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label="Pending incentives"
          value={`${summary.data?.pendingIncentives.employees ?? 0} employees`}
          detail={formatINR(summary.data?.pendingIncentives.total ?? 0)}
        />
        <SummaryCard
          label="Approved this quarter"
          value={`${summary.data?.approvedThisQuarter.employees ?? 0} employees`}
          detail={formatINR(summary.data?.approvedThisQuarter.total ?? 0)}
        />
        <SummaryCard
          label="Pending appraisals"
          value={`${summary.data?.pendingAppraisals.employees ?? 0} employees`}
          detail="Waiting for review"
        />
        <SummaryCard
          label="Hikes to apply"
          value={`${summary.data?.hikesToApply.employees ?? 0} employees`}
          detail={formatINR(summary.data?.hikesToApply.totalIncrement ?? 0)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={tab === "incentives" ? "default" : "outline"}
          onClick={() => {
            setTab("incentives");
            setStatus("pending_admin_approval");
          }}
        >
          Incentives
          {pendingIncentiveCount > 0 ? ` (${pendingIncentiveCount})` : ""}
        </Button>
        <Button
          type="button"
          variant={tab === "appraisals" ? "default" : "outline"}
          onClick={() => {
            setTab("appraisals");
            setStatus("pending_admin_approval");
          }}
        >
          Appraisals
          {pendingAppraisalCount > 0 ? ` (${pendingAppraisalCount})` : ""}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(tab === "incentives" ? INCENTIVE_TABS : APPRAISAL_TABS).map((item) => (
          <button
            key={item.status}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${status === item.status ? "bg-slate-900 text-white" : ""}`}
            onClick={() => setStatus(item.status)}
          >
            {item.label}
            {item.status === "pending_admin_approval"
              ? ` (${tab === "incentives" ? pendingIncentiveCount : pendingAppraisalCount})`
              : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Search
          <input
            className="mt-1 block h-9 rounded-md border bg-transparent px-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Employee name"
          />
        </label>
        <label className="text-sm">
          Grade
          <select
            className="mt-1 block h-9 rounded-md border bg-transparent px-2"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          >
            <option value="">All</option>
            {GRADES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {tab === "incentives" ? (
          <label className="text-sm">
            Month
            <select
              className="mt-1 block h-9 rounded-md border bg-transparent px-2"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {months.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-sm">
          Quarter
          <select
            className="mt-1 block h-9 rounded-md border bg-transparent px-2"
            value={quarter}
            onChange={(event) => setQuarter(event.target.value)}
          >
            {quarters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={eligibleOnly}
            onChange={(event) => setEligibleOnly(event.target.checked)}
          />
          Eligible only
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {tab === "incentives" ? (
          <>
            <Button
              type="button"
              onClick={() =>
                void actions.approveEligibleIncentives
                  .mutateAsync({ month, quarter, grade: grade || undefined })
                  .then((result) =>
                    toast.success(`Approved ${(result as { approved: number }).approved}`),
                  )
                  .catch(onError)
              }
            >
              Approve all eligible
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void actions.calculateIncentives
                  .mutateAsync(month)
                  .then(() => toast.success("Incentives calculated"))
                  .catch(onError)
              }
            >
              Calculate month
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadIncentiveSheet(filters).catch(onError)}
            >
              Export to Excel
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              onClick={() =>
                void actions.approveEligibleAppraisals
                  .mutateAsync({ quarter, grade: grade || undefined })
                  .then((result) =>
                    toast.success(`Approved ${(result as { approved: number }).approved}`),
                  )
                  .catch(onError)
              }
            >
              Approve all eligible
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void actions.calculateAppraisals
                  .mutateAsync(quarter)
                  .then(() => toast.success("Appraisals calculated"))
                  .catch(onError)
              }
            >
              Calculate quarter
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void downloadAppraisalSheet({ ...filters, month: undefined }).catch(onError)
              }
            >
              Export appraisal sheet
            </Button>
          </>
        )}
      </div>

      {rejecting ? (
        <form
          className="space-y-2 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitReject();
          }}
        >
          <p className="text-sm font-medium">Rejection reason</p>
          <textarea
            required
            className="min-h-20 w-full rounded-md border bg-transparent p-2 text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit">Confirm reject</Button>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {tab === "incentives" ? (
        <IncentiveTable
          rows={incentives.data ?? []}
          error={incentives.isError ? getErrorMessage(incentives.error) : null}
          openId={openId}
          onToggle={(id) => setOpenId(openId === id ? null : id)}
          onApprove={(id) =>
            void actions.approveIncentive
              .mutateAsync(id)
              .then(() => toast.success("Approved"))
              .catch(onError)
          }
          onReject={(id) => {
            setRejecting({ kind: "incentive", id });
            setReason("");
          }}
        />
      ) : (
        <AppraisalTable
          rows={appraisals.data ?? []}
          error={appraisals.isError ? getErrorMessage(appraisals.error) : null}
          openId={openId}
          onToggle={(id) => setOpenId(openId === id ? null : id)}
          onApprove={(id) =>
            void actions.approveAppraisal
              .mutateAsync(id)
              .then(() => toast.success("Hike approved"))
              .catch(onError)
          }
          onReject={(id) => {
            setRejecting({ kind: "appraisal", id });
            setReason("");
          }}
        />
      )}

      {tab === "incentives" ? <QuarterlyDisbursement quarter={quarter} /> : null}
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function IncentiveTable({
  rows,
  error,
  openId,
  onToggle,
  onApprove,
  onReject,
}: {
  rows: IncentiveApproval[];
  error: string | null;
  openId: string | null;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
          <tr>
            {[
              "Employee",
              "Designation / grade",
              "Monthly salary",
              "Eligibility target",
              "NR achieved",
              "Achievement",
              "Till target",
              "Above target",
              "Gross",
              "Cash 80%",
              "ESOP 20%",
              "N1 bonus",
              "Total payable",
              "Status",
              "",
            ].map((heading) => (
              <th key={heading} className="px-3 py-2">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr className="border-t">
                <td className="px-3 py-2">{row.employeeName}</td>
                <td className="px-3 py-2">
                  {row.designation ?? "—"} / {row.grade ?? "—"}
                </td>
                <td className="px-3 py-2">{formatINR(row.monthlySalary)}</td>
                <td className="px-3 py-2">{formatINR(row.eligibilityTarget)}</td>
                <td className="px-3 py-2">{formatINR(row.nrAchieved)}</td>
                <td className="px-3 py-2">{percent(row.achievementPercent)}</td>
                <td className="px-3 py-2">{formatINR(row.incentiveTillTarget)}</td>
                <td className="px-3 py-2">{formatINR(row.incentiveAboveTarget)}</td>
                <td className="px-3 py-2">{formatINR(row.grossIncentive)}</td>
                <td className="px-3 py-2">{formatINR(row.cashAmount)}</td>
                <td className="px-3 py-2">{formatINR(row.esopAmount)}</td>
                <td className="px-3 py-2">{formatINR(row.n1Bonus)}</td>
                <td className="px-3 py-2">{formatINR(row.totalPayable)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {row.status === "pending_admin_approval" ? (
                      <>
                        <Button type="button" size="sm" onClick={() => onApprove(row.id)}>
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(row.id)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggle(row.id)}
                    >
                      View details
                    </Button>
                  </div>
                </td>
              </tr>
              {openId === row.id ? (
                <tr key={`${row.id}-details`} className="border-t bg-slate-50 dark:bg-slate-900">
                  <td className="px-3 py-2" colSpan={15}>
                    {row.rejectionReason ? (
                      <p className="mb-2">Reason: {row.rejectionReason}</p>
                    ) : null}
                    {row.deals.length === 0 ? (
                      <p>No counted deals.</p>
                    ) : (
                      <ul className="space-y-1">
                        {row.deals.map((deal) => (
                          <li key={deal.tcfCode}>
                            {deal.tcfCode} · {deal.propertyName ?? "Property"} · NR{" "}
                            {formatINR(deal.nr)} · {deal.invoiceStatus.replaceAll("_", " ")} ·{" "}
                            {deal.closedOn ?? "—"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-slate-500" colSpan={15}>
                No incentive rows for this filter. Calculate the month to create them.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AppraisalTable({
  rows,
  error,
  openId,
  onToggle,
  onApprove,
  onReject,
}: {
  rows: AppraisalApproval[];
  error: string | null;
  openId: string | null;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
          <tr>
            {[
              "Employee",
              "Designation",
              "Grade",
              "Quarter",
              "Required",
              "Achieved",
              "Eligible",
              "Current salary",
              "Hike",
              "New salary",
              "Increment",
              "",
            ].map((heading) => (
              <th key={heading} className="px-3 py-2">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr className="border-t">
                <td className="px-3 py-2">{row.employeeName}</td>
                <td className="px-3 py-2">{row.designation ?? "—"}</td>
                <td className="px-3 py-2">{row.grade ?? "—"}</td>
                <td className="px-3 py-2">{row.quarterName}</td>
                <td className="px-3 py-2">
                  {row.requiredSales ?? "—"} / {row.requiredUnits ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {row.achievedSales} / {row.achievedUnits}
                </td>
                <td className="px-3 py-2">{row.eligible ? "YES" : "NO"}</td>
                <td className="px-3 py-2">{formatINR(row.currentSalary)}</td>
                <td className="px-3 py-2">{Math.round(row.hikePercent * 100)}%</td>
                <td className="px-3 py-2">{formatINR(row.newSalary)}</td>
                <td className="px-3 py-2">{formatINR(row.incrementAmount)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {row.status === "pending_admin_approval" ? (
                      <>
                        <Button type="button" size="sm" onClick={() => onApprove(row.id)}>
                          Approve hike
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(row.id)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggle(row.id)}
                    >
                      View deals
                    </Button>
                  </div>
                </td>
              </tr>
              {openId === row.id ? (
                <tr key={`${row.id}-deals`} className="border-t bg-slate-50 dark:bg-slate-900">
                  <td className="px-3 py-2" colSpan={12}>
                    {row.rejectionReason ? (
                      <p className="mb-2">Reason: {row.rejectionReason}</p>
                    ) : null}
                    {row.effectiveFromLabel ? (
                      <p className="mb-2">Effective from {row.effectiveFromLabel}</p>
                    ) : null}
                    {row.deals.length === 0 ? (
                      <p>
                        No deals counted. A deal counts only when the invoice is raised and payment
                        is collected.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {row.deals.map((deal) => (
                          <li key={deal.tcfCode}>
                            {deal.propertyName ?? "Property"} · {deal.tcfCode} · value{" "}
                            {formatINR(deal.dealValue)} · NR {formatINR(deal.nr)} ·{" "}
                            {deal.closedOn ?? "—"} · invoice raised{" "}
                            {deal.invoiceRaised ? "yes" : "no"} · payment collected{" "}
                            {deal.paymentCollected ? "yes" : "no"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-slate-500" colSpan={12}>
                No appraisal rows for this filter. Calculate the quarter to create them.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
