"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { apiDelete, apiDownload, apiGet, apiPost, apiPut, apiUpload } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type Tab = "overview" | "upload" | "batches" | "pool" | "agents" | "leads" | "controls";

type PoolStats = {
  total: number;
  unassigned: number;
  assigned: number;
  called: number;
  interested: number;
  notInterested: number;
  callback: number;
  dncOrInvalid: number;
  consumed: number;
  cities: string[];
};

type CallingOverview = {
  totals: {
    attempts: number;
    calledContacts: number;
    pending: number;
    callbacks: number;
    active: number;
    removed: number;
    interested: number;
    qualified: number;
    outcomes: Record<string, number>;
  };
  agents: {
    agentId: string;
    agentName: string;
    active: number;
    pending: number;
    callbacks: number;
    removed: number;
    attempts: number;
    calledContacts: number;
    interested: number;
    qualified: number;
  }[];
  deletionReasons: { reason: string; label: string; count: number }[];
};

type QualifiedOverview = {
  leads: number;
  hot: number;
  conversionPercent: number;
  stages: { stage: string; count: number }[];
  items: {
    leadCode: string;
    name: string;
    phone: string | null;
    agentName: string | null;
    qualifiedAt: string | null;
  }[];
};

const OUTCOME_LABELS: { key: string; label: string }[] = [
  { key: "interested", label: "Interested" },
  { key: "not_interested", label: "Not interested" },
  { key: "callback", label: "Callback" },
  { key: "no_answer", label: "No answer" },
  { key: "busy", label: "Busy" },
  { key: "invalid", label: "Invalid" },
  { key: "dnc", label: "DNC" },
];

type Batch = {
  batchId: string;
  batchName: string;
  fileName: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  duplicateRecords: number;
  invalidRecords: number;
  priority: number;
  uploadedAt: string;
};

type PoolItem = {
  contactId: string;
  name: string;
  phone: string;
  city: string | null;
  budgetLabel: string | null;
  budget: string | null;
  propertyType: string | null;
  status: string;
  assignedToAgentId: string | null;
};

export default function CallingDataPage() {
  const { ready, isAdmin } = usePermissions();
  const [tab, setTab] = useState<Tab>("overview");
  if (!ready) return null;
  if (!isAdmin) return <AccessDeniedEmptyState />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "upload", label: "Upload" },
    { id: "batches", label: "Batches" },
    { id: "pool", label: "Pool" },
    { id: "agents", label: "Agents" },
    { id: "leads", label: "Leads" },
    { id: "controls", label: "Controls" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Calling data</h1>
        <p className="text-sm text-slate-500">
          Upload the shared pool, then agents pull a locked calling list. Interested contacts become
          leads. Everything else leaves the calling list.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {tab === "overview" ? <Overview /> : null}
      {tab === "upload" ? <UploadPanel /> : null}
      {tab === "batches" ? <Batches /> : null}
      {tab === "pool" ? <PoolTable /> : null}
      {tab === "agents" ? <Agents /> : null}
      {tab === "leads" ? <LeadsPanel /> : null}
      {tab === "controls" ? <Controls /> : null}
    </div>
  );
}

function Overview() {
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const stats = useQuery({
    queryKey: ["pool-stats"],
    queryFn: () => apiGet<PoolStats>("/api/admin/pool-stats"),
  });
  const calling = useQuery({
    queryKey: ["calling-overview"],
    queryFn: () => apiGet<CallingOverview>("/api/admin/calling-overview"),
  });
  const leads = useQuery({
    queryKey: ["leads-overview"],
    queryFn: () => apiGet<QualifiedOverview>("/api/admin/leads-overview"),
  });
  const activity = useQuery({
    queryKey: ["overall-report", range],
    queryFn: () =>
      apiGet<{
        totalCalls: number;
        totalInterested: number;
        averageDurationSeconds: number;
        costPerLead: number | null;
      }>(`/api/admin/overall-report?range=${range}`),
  });
  const pool = useQuery({
    queryKey: ["pool-report"],
    queryFn: () =>
      apiGet<{
        assignedLast7Days: number;
        unassigned: number;
        daysUntilEmpty: number | null;
      }>("/api/admin/pool-report"),
  });
  const data = stats.data;
  const totals = calling.data?.totals;
  const qualified = leads.data?.items ?? [];
  const pct = data && data.total > 0 ? Math.round((data.consumed / data.total) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={data?.total} />
        <Stat label="Pool remaining" value={data?.unassigned} />
        <Stat label="Assigned" value={data?.assigned} />
        <Stat label="Called" value={totals?.calledContacts} />
        <Stat label="Interested" value={data?.interested} />
        <Stat label="DNC / Invalid" value={data?.dncOrInvalid} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Call attempts" value={totals?.attempts} />
        <Stat label="Active" value={totals?.active} />
        <Stat label="Pending" value={totals?.pending} />
        <Stat label="Callbacks" value={totals?.callbacks} />
        <Stat label="Qualified leads" value={leads.data?.leads ?? totals?.qualified} />
        <Stat label="Removed" value={totals?.removed} />
      </div>
      <div>
        <div className="mb-1 text-sm text-slate-600">Pool consumed {pct}%</div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-[#204060]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Pool remaining {pool.data?.unassigned ?? data?.unassigned ?? 0}. Assigned in the last 7
          days {pool.data?.assignedLast7Days ?? 0}.
          {pool.data?.daysUntilEmpty == null
            ? " Not enough assignment pace to estimate when the pool runs out."
            : ` About ${pool.data.daysUntilEmpty} days until the pool is empty.`}
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Calls</h2>
          <div className="flex gap-2">
            {(["day", "week", "month"] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={range === item ? "default" : "outline"}
                onClick={() => setRange(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-600">
          {totals?.attempts ?? 0} call attempts logged in total, across{" "}
          {totals?.calledContacts ?? 0} contacts. This {range}: {activity.data?.totalCalls ?? 0}{" "}
          calls, {activity.data?.totalInterested ?? 0} interested, average duration{" "}
          {activity.data?.averageDurationSeconds ?? 0}s
          {activity.data?.costPerLead != null ? `, cost per lead ${activity.data.costPerLead}` : ""}
          .
        </p>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOME_LABELS.map((item) => (
            <li key={item.key}>
              {item.label}: {totals?.outcomes?.[item.key] ?? 0}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Not interested (pool) {data?.notInterested ?? 0} · Callbacks still in the pool{" "}
          {data?.callback ?? 0}
        </p>
      </section>
      <section className="overflow-x-auto rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold">Calling data by agent</h2>
        <p className="mb-3 text-xs text-slate-500">
          Removed rows stay in the audit log. Called counts are logged attempts, including contacts
          that have left the list.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th>Agent</th>
              <th>Active</th>
              <th>Pending</th>
              <th>Callbacks</th>
              <th>Attempts</th>
              <th>Called</th>
              <th>Interested</th>
              <th>Qualified</th>
              <th>Removed</th>
            </tr>
          </thead>
          <tbody>
            {(calling.data?.agents ?? []).map((agent) => (
              <tr key={agent.agentId} className="border-t">
                <td className="py-1">{agent.agentName}</td>
                <td>{agent.active}</td>
                <td>{agent.pending}</td>
                <td>{agent.callbacks}</td>
                <td>{agent.attempts}</td>
                <td>{agent.calledContacts}</td>
                <td>{agent.interested}</td>
                <td>{agent.qualified}</td>
                <td>{agent.removed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-4 text-sm font-semibold">Deletion reasons</h3>
        <ul className="text-sm">
          {(calling.data?.deletionReasons ?? []).map((reason) => (
            <li key={reason.reason}>
              {reason.label}: {reason.count}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold">Qualified leads</h2>
        <p className="text-sm text-slate-600">
          {leads.data?.leads ?? 0} qualified · {leads.data?.hot ?? 0} hot ·{" "}
          {leads.data?.conversionPercent ?? 0}% of assigned contacts converted
        </p>
        {(leads.data?.stages ?? []).length > 0 ? (
          <ul className="mt-3 text-sm">
            {leads.data?.stages.map((stage) => (
              <li key={stage.stage}>
                {stage.stage}: {stage.count}
              </li>
            ))}
          </ul>
        ) : null}
        {(leads.data?.leads ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No leads yet. None of the assigned contacts converted.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Agent</th>
                  <th>Qualified</th>
                </tr>
              </thead>
              <tbody>
                {qualified.map((lead) => (
                  <tr key={lead.leadCode} className="border-t">
                    <td className="py-1">{lead.leadCode}</td>
                    <td>{lead.name}</td>
                    <td>{lead.phone ?? "—"}</td>
                    <td>{lead.agentName ?? "—"}</td>
                    <td>{lead.qualifiedAt ? new Date(lead.qualifiedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}

function UploadPanel() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [batchName, setBatchName] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setRowCount(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRowCount(null);
      return;
    }
    void file.text().then((text) => {
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      setRowCount(Math.max(0, lines.length - 1));
    });
  }, [file]);

  const progress = useQuery({
    queryKey: ["upload-batch", batchId],
    queryFn: () => apiGet<Batch>(`/api/admin/upload-batches/${batchId}`),
    enabled: Boolean(batchId),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file");
      const body = new FormData();
      body.append("file", file);
      if (batchName.trim()) body.append("batchName", batchName.trim());
      return apiUpload<{ batchId: string }>("/api/admin/upload-contacts", body);
    },
    onSuccess: (data) => {
      setBatchId(data.batchId);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["upload-batches"] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const batch = progress.data;
  return (
    <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 p-4">
      <label className="block text-sm">
        Batch tag
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="Bangalore Leads June 2025"
          value={batchName}
          onChange={(event) => setBatchName(event.target.value)}
        />
      </label>
      <input
        type="file"
        accept=".csv,.xlsx"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <p className="text-sm text-slate-600">
        Include a name column, or first name and last name. Phone is required.
      </p>
      {file ? (
        <p className="text-sm text-slate-600">
          {file.name}
          {rowCount != null ? ` · ${rowCount.toLocaleString()} rows` : " · Excel file selected"}
        </p>
      ) : null}
      <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
        Upload & Process
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {batch ? (
        <div className="space-y-2 text-sm">
          <p>
            {batch.status === "processing"
              ? `Processing... ${batch.processedRecords}/${batch.totalRecords}`
              : `Status: ${batch.status}`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-emerald-600"
              style={{
                width: `${batch.totalRecords ? (batch.processedRecords / batch.totalRecords) * 100 : 0}%`,
              }}
            />
          </div>
          {batch.status === "completed" ? (
            <ul>
              <li>Valid & imported: {batch.validRecords}</li>
              <li>Duplicates skipped: {batch.duplicateRecords}</li>
              <li>Invalid (bad phone): {batch.invalidRecords}</li>
            </ul>
          ) : null}
          {batch.invalidRecords > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void apiDownload(
                  `/api/admin/upload-batches/${batch.batchId}/invalid`,
                  "invalid-rows.csv",
                )
              }
            >
              Download invalid rows
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Batches() {
  const queryClient = useQueryClient();
  const batches = useQuery({
    queryKey: ["upload-batches"],
    queryFn: () => apiGet<Batch[]>("/api/admin/upload-batches"),
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Name</th>
            <th>File</th>
            <th>Status</th>
            <th>Valid</th>
            <th>Dupes</th>
            <th>Invalid</th>
            <th>Priority</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(batches.data ?? []).map((batch) => (
            <tr key={batch.batchId} className="border-t">
              <td className="py-2">{batch.batchName}</td>
              <td>{batch.fileName}</td>
              <td>{batch.status}</td>
              <td>{batch.validRecords}</td>
              <td>{batch.duplicateRecords}</td>
              <td>{batch.invalidRecords}</td>
              <td>
                <input
                  className="w-16 rounded border px-2 py-1"
                  type="number"
                  defaultValue={batch.priority}
                  onBlur={(event) => {
                    void apiPut(`/api/admin/upload-batches/${batch.batchId}`, {
                      priority: Number(event.target.value),
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["upload-batches"] }));
                  }}
                />
              </td>
              <td>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void apiDelete(`/api/admin/upload-batches/${batch.batchId}`).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["upload-batches"] }),
                    )
                  }
                >
                  Delete unassigned
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PoolTable() {
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (status) query.set("status", status);
    if (city) query.set("city", city);
    if (search) query.set("search", search);
    return query.toString();
  }, [status, city, search, page]);
  const list = useQuery({
    queryKey: ["contact-pool", params],
    queryFn: () =>
      apiGet<{ items: PoolItem[]; total: number }>(`/api/admin/contact-pool?${params}`),
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Search name or phone"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="City"
          value={city}
          onChange={(event) => {
            setCity(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["unassigned", "assigned", "called", "interested", "callback", "dnc", "invalid"].map(
            (item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ),
          )}
        </select>
        <Button
          variant="outline"
          onClick={() =>
            void apiDownload(`/api/admin/export-contacts?${params}`, "contact-pool.csv")
          }
        >
          Export CSV
        </Button>
      </div>
      <p className="text-sm text-slate-500">{list.data?.total ?? 0} contacts</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Name</th>
            <th>Phone</th>
            <th>City</th>
            <th>Budget</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(list.data?.items ?? []).map((item) => (
            <tr key={item.contactId} className="border-t">
              <td className="py-1">{item.name}</td>
              <td>{item.phone}</td>
              <td>{item.city}</td>
              <td>{item.budgetLabel ?? item.budget}</td>
              <td>{item.propertyType}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function Agents() {
  const agents = useQuery({
    queryKey: ["agent-stats"],
    queryFn: () =>
      apiGet<
        {
          agent_id: string;
          agent_name: string;
          contacts_assigned_today: number;
          contacts_called_today: number;
          interested_today: number;
          total_assigned: number;
          total_called: number;
          conversion_rate: number;
          last_active: string | null;
        }[]
      >("/api/admin/agent-stats"),
  });
  const queryClient = useQueryClient();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500">
          <th>Agent</th>
          <th>Today</th>
          <th>Called</th>
          <th>Interested</th>
          <th>All assigned</th>
          <th>All called</th>
          <th>Conv %</th>
          <th>Last active</th>
          <th>Daily cap</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {(agents.data ?? []).map((agent) => (
          <tr key={agent.agent_id} className="border-t">
            <td className="py-2">{agent.agent_name}</td>
            <td>{agent.contacts_assigned_today}</td>
            <td>{agent.contacts_called_today}</td>
            <td>{agent.interested_today}</td>
            <td>{agent.total_assigned}</td>
            <td>{agent.total_called}</td>
            <td>{agent.conversion_rate}</td>
            <td>{agent.last_active ? new Date(agent.last_active).toLocaleString() : "—"}</td>
            <td>
              <input
                className="w-16 rounded border px-2 py-1"
                type="number"
                min={1}
                max={100}
                defaultValue={100}
                onBlur={(event) => {
                  void apiPut(`/api/admin/agent-limit/${agent.agent_id}`, {
                    maxDailyLimit: Number(event.target.value),
                  });
                }}
              />
            </td>
            <td>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void apiPost("/api/admin/reclaim-contacts", { agentId: agent.agent_id }).then(
                    () => queryClient.invalidateQueries({ queryKey: ["agent-stats"] }),
                  )
                }
              >
                Reclaim
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LeadsPanel() {
  const leads = useQuery({
    queryKey: ["qualified-leads"],
    queryFn: () =>
      apiGet<
        {
          id: string;
          leadCode: string;
          name: string;
          phone: string | null;
          pipelineStage: string;
          priority: string;
          assignedTo: string | null;
          agentName: string | null;
          qualifiedAt: string | null;
        }[]
      >("/api/admin/qualified-leads"),
  });
  const [agentId, setAgentId] = useState("");
  const [leadId, setLeadId] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Lead id"
          value={leadId}
          onChange={(event) => setLeadId(event.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Reassign to agent id"
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
        />
        <Button
          onClick={() => void apiPost("/api/admin/reassign-lead", { leadId, agentId })}
          disabled={!leadId || !agentId}
        >
          Reassign lead
        </Button>
        <Button
          variant="outline"
          onClick={() => void apiDownload("/api/admin/export-leads", "leads.csv")}
        >
          Export leads
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Code</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Agent</th>
            <th>Qualified</th>
            <th>Stage</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          {(leads.data ?? []).length === 0 ? (
            <tr>
              <td className="py-2 text-slate-600" colSpan={7}>
                No leads yet. None of the assigned contacts converted.
              </td>
            </tr>
          ) : (
            (leads.data ?? []).map((lead) => (
              <tr key={lead.id} className="border-t">
                <td className="py-1">{lead.leadCode}</td>
                <td>{lead.name}</td>
                <td>{lead.phone}</td>
                <td>{lead.agentName ?? "—"}</td>
                <td>{lead.qualifiedAt ? new Date(lead.qualifiedAt).toLocaleString() : "—"}</td>
                <td>{lead.pipelineStage}</td>
                <td>{lead.priority}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Controls() {
  const settings = useQuery({
    queryKey: ["pool-settings"],
    queryFn: () =>
      apiGet<{ requestsPaused: boolean; lowPoolThreshold: number; costPerContact: string | null }>(
        "/api/admin/pool-settings",
      ),
  });
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [cost, setCost] = useState("");
  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm">
        Requests are {settings.data?.requestsPaused ? "paused" : "open"}. Low-pool alert at{" "}
        {settings.data?.lowPoolThreshold ?? 500} unassigned contacts.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void apiPost("/api/admin/pause-requests", {
              paused: !settings.data?.requestsPaused,
            }).then(() => queryClient.invalidateQueries({ queryKey: ["pool-settings"] }))
          }
        >
          {settings.data?.requestsPaused ? "Resume requests" : "Pause requests"}
        </Button>
      </div>
      <label className="block text-sm">
        Cost per contact (for cost-per-lead)
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
        />
      </label>
      <Button
        variant="outline"
        onClick={() =>
          void apiPut("/api/admin/pool-settings", {
            costPerContact: cost ? Number(cost) : null,
          }).then(() => queryClient.invalidateQueries({ queryKey: ["pool-settings"] }))
        }
      >
        Save cost
      </Button>
      <label className="block text-sm">
        Blacklist phone (DNC)
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <Button
        variant="outline"
        onClick={() => void apiPost("/api/admin/blacklist", { phone, reason: "Admin blacklist" })}
      >
        Add to DNC
      </Button>
    </div>
  );
}
