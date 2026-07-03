"use client";

import { currentMonthIsoRange, openBookingPdf, useBookings } from "@/hooks/use-bookings";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  reserved: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sold: "bg-muted text-muted-foreground",
};

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function BookingsPageContent() {
  const { isAdmin, isManager } = usePermissions();
  const canFilterAgents = isAdmin || isManager;
  const defaultRange = useMemo(() => currentMonthIsoRange(), []);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom.slice(0, 10));
  const [dateTo, setDateTo] = useState(defaultRange.dateTo.slice(0, 10));

  const bookings = useBookings({
    page,
    pageSize: 25,
    search: search.trim() || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
  });

  const items = bookings.data?.items ?? [];
  const total = bookings.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (bookings.data?.pageSize ?? 25)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Units marked booked generate a booking reference and PDF summary automatically.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search ref, project, unit, lead…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Input
            type="date"
            className="w-auto"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            className="w-auto"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            {total} booking{total === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading bookings…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Reference</th>
                    <th className="pb-2 pr-4 font-medium">Project / Unit</th>
                    <th className="pb-2 pr-4 font-medium">Lead</th>
                    {canFilterAgents ? <th className="pb-2 pr-4 font-medium">Agent</th> : null}
                    <th className="pb-2 pr-4 font-medium">Price</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Booked</th>
                    <th className="pb-2 font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-mono text-xs">{row.bookingRef}</td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/projects/${row.projectId}?step=inventory&status=${row.status}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.projectName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.unitNumber} · F{row.floor} · {row.bedrooms}BHK
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        {row.leadId ? (
                          <Link
                            href={`/leads/${row.leadId}`}
                            className="text-primary hover:underline"
                          >
                            {row.leadName}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canFilterAgents ? (
                        <td className="py-2 pr-4 text-muted-foreground">{row.agentName}</td>
                      ) : null}
                      <td className="py-2 pr-4">
                        {row.priceFinalRs != null
                          ? formatPrice(row.priceFinalRs)
                          : formatPrice(row.priceListedRs)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[row.status] ?? ""}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {new Date(row.generatedAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Download booking PDF"
                          onClick={() => void openBookingPdf(row.projectId, row.unitId)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
