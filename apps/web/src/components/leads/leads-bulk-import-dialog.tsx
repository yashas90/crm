"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBulkImportLeads } from "@/hooks/use-bulk-leads";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { useUsers } from "@/hooks/use-users";
import {
  type BulkLeadImportRow,
  downloadLeadsCsvTemplate,
  parseLeadsCsv,
} from "@/lib/parse-leads-csv";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { AlertCircle, Download, FileUp, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LeadsBulkImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

export function LeadsBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: LeadsBulkImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkLeadImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [assignToUserId, setAssignToUserId] = useState<string>("");

  const { hasPermission, canAssignLead } = usePermissions();
  const { session } = useSession();
  const canImport = hasPermission("leads:bulk_upload");
  const bulkImport = useBulkImportLeads();
  const { data: users } = useUsers();

  useEffect(() => {
    if (open && session?.id) {
      setAssignToUserId(session.id);
    }
  }, [open, session?.id]);

  function resetState() {
    setFileName(null);
    setRows([]);
    setParseErrors([]);
    setSkipDuplicates(true);
    setAssignToUserId(session?.id ?? "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;

    const text = await file.text();
    const parsed = parseLeadsCsv(text);
    setFileName(file.name);
    setRows(parsed.rows);
    setParseErrors(parsed.parseErrors);
  }

  async function handleImport() {
    if (rows.length === 0) return;

    const result = await bulkImport.mutateAsync({
      leads: rows,
      skipDuplicates,
      assignToUserId: assignToUserId || session?.id,
    });

    if (result.createdCount > 0) {
      onImported?.();
    }
    handleOpenChange(false);
  }

  const previewRows = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet with at least <strong>firstName</strong> and <strong>phone</strong>{" "}
            columns. Up to 500 leads per file. Duplicate phone numbers can be skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!canImport ? (
          <p className="text-sm text-muted-foreground">
            You do not have permission to import leads.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadLeadsCsvTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose CSV file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
              />
            </div>

            {fileName ? (
              <p className="text-sm text-muted-foreground">
                <FileUp className="mr-1 inline h-4 w-4" />
                {fileName} — {rows.length} valid row{rows.length === 1 ? "" : "s"}
                {parseErrors.length > 0 ? `, ${parseErrors.length} row issue(s)` : ""}
              </p>
            ) : null}

            {canAssignLead ? (
              <div className="space-y-2">
                <Label htmlFor="assign-to">Assign imported leads to</Label>
                <select
                  id="assign-to"
                  className={selectClass}
                  value={assignToUserId}
                  onChange={(event) => setAssignToUserId(event.target.value)}
                >
                  {(users ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                      {user.id === session?.id ? " (you)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Leads are assigned on import so they appear under My Leads and in the mobile app.
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <input
                id="skip-duplicates"
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="skip-duplicates" className="font-normal">
                Skip rows with duplicate phone numbers
              </Label>
            </div>

            {parseErrors.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  CSV parsing issues
                </p>
                <ul className="space-y-1 text-amber-900/90 dark:text-amber-100/90">
                  {parseErrors.slice(0, 8).map((error) => (
                    <li key={`${error.row}-${error.message}`}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                  {parseErrors.length > 8 ? <li>…and {parseErrors.length - 8} more</li> : null}
                </ul>
              </div>
            ) : null}

            {previewRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, index) => (
                      <TableRow key={`${row.phone}-${index}`}>
                        <TableCell>
                          {row.firstName} {row.lastName ?? ""}
                        </TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell>{row.city ?? "—"}</TableCell>
                        <TableCell>{row.leadSource ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > previewRows.length ? (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Showing first {previewRows.length} of {rows.length} rows
                  </p>
                ) : null}
              </div>
            ) : null}

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          {canImport ? (
            <Button
              onClick={() => void handleImport()}
              disabled={rows.length === 0 || bulkImport.isPending}
            >
              {bulkImport.isPending
                ? "Importing…"
                : `Import ${rows.length} lead${rows.length === 1 ? "" : "s"}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
