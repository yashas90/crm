"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDownloadLeadImportReport, useLeadImportBatches } from "@/hooks/use-bulk-leads";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

type LeadsImportTrackerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewBatch?: (batch: { id: string; fileName: string | null; createdAt: string }) => void;
};

function formatUploadTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Initiated";
}

function statusClass(status: string) {
  if (status === "completed") return "text-emerald-600 font-semibold";
  if (status === "failed") return "text-red-600 font-semibold";
  return "text-amber-600 font-semibold";
}

export function LeadsImportTrackerDialog({
  open,
  onOpenChange,
  onViewBatch,
}: LeadsImportTrackerDialogProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const batches = useLeadImportBatches(page, pageSize, { enabled: open });
  const downloadReport = useDownloadLeadImportReport();

  const total = batches.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
          <h2 className="text-base font-semibold">Leads — CSV upload tracker</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => void batches.refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", batches.isFetching && "animate-spin")} />
          </Button>
        </div>

        <div className="overflow-auto p-4">
          {batches.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading upload history…</p>
          ) : batches.isError ? (
            <p className="text-sm text-destructive">Could not load upload history.</p>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground">
              No CSV uploads yet. Use Import leads to upload your first file.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Done By</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Unique</TableHead>
                  <TableHead className="text-right">Uploaded</TableHead>
                  <TableHead className="text-right">Duplicate</TableHead>
                  <TableHead className="text-right">Invalid</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Hot</TableHead>
                  <TableHead className="text-right">Cold</TableHead>
                  <TableHead className="text-right">Dropped</TableHead>
                  <TableHead className="text-right">Not Interested</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.data?.items.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className={statusClass(batch.status)}>
                      {statusLabel(batch.status)}
                    </TableCell>
                    <TableCell className="max-w-[10rem]">
                      <p className="truncate font-medium">{batch.uploadedBy.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        At {formatUploadTime(batch.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{batch.totalCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.uniqueCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.totalUploaded}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {batch.duplicateCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{batch.invalidCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.visitsBooked}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.hotCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.coldCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.droppedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {batch.notInterestedCount}
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate" title={batch.fileName ?? ""}>
                      {batch.fileName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {onViewBatch ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto justify-start p-0"
                            onClick={() => {
                              onViewBatch({
                                id: batch.id,
                                fileName: batch.fileName,
                                createdAt: batch.createdAt,
                              });
                              onOpenChange(false);
                            }}
                          >
                            View leads
                          </Button>
                        ) : null}
                        {batch.status === "completed" ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto justify-start p-0"
                            disabled={downloadReport.isPending}
                            onClick={() =>
                              void downloadReport.mutateAsync({
                                batchId: batch.id,
                                fileName: `${batch.fileName?.replace(/\.[^.]+$/, "") ?? "lead-import"}-report.csv`,
                              })
                            }
                          >
                            <Download className="mr-1 inline h-3.5 w-3.5" />
                            Download report
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {total > 0 ? (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              {start} - {end} of {total} entries
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[5rem] text-center tabular-nums">
                Page {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
