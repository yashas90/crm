"use client";

import { EmptyState } from "@/components/common/empty-state";
import { LeadNoteModal } from "@/components/leads/lead-note-modal";
import { LeadsTablePagination } from "@/components/leads/leads-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadRow } from "@/hooks/use-leads";
import { formatLeadSourceDisplay } from "@/lib/lead-sources";
import { getLeadStatusDisplay } from "@/lib/lead-status-display";
import type { LeadsColumnVisibility } from "@/lib/leads-table-columns";
import {
  DEFAULT_LEADS_COLUMN_VISIBILITY,
  visibleLeadsColumnCount,
} from "@/lib/leads-table-columns";
import { cn } from "@propninja/ui/lib/utils";
import {
  Eye,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  StickyNote,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, memo, useCallback, useMemo, useState } from "react";

type LeadsTableProps = {
  leads: LeadRow[];
  onEdit: (lead: LeadRow) => void;
  onAddLead?: () => void;
  isLoading?: boolean;
  columnsToShow?: LeadsColumnVisibility;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
};

type ActionIconButtonProps = {
  icon: ReactNode;
  label: string;
  className: string;
  onClick?: () => void;
  disabled?: boolean;
};

function ActionIconButton({ icon, label, className, onClick, disabled }: ActionIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-white shadow-sm transition-opacity",
        className,
        disabled ? "cursor-not-allowed opacity-45" : "hover:opacity-90",
      )}
    >
      {icon}
    </button>
  );
}

function LeadsTableBodySkeleton({
  rows,
  columnsToShow,
}: {
  rows: number;
  columnsToShow: LeadsColumnVisibility;
}) {
  const colCount = 1 + visibleLeadsColumnCount(columnsToShow);

  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow
          key={`lead-skeleton-${rowIndex}`}
          className={rowIndex % 2 === 1 ? "bg-slate-50/60" : "bg-white"}
        >
          {Array.from({ length: colCount }, (__, cellIndex) => (
            <TableCell key={`lead-skeleton-${rowIndex}-${cellIndex}`}>
              <Skeleton className="h-5 w-full max-w-[12rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

type LeadsTableRowProps = {
  lead: LeadRow;
  index: number;
  columnsToShow: LeadsColumnVisibility;
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
  onEdit: (lead: LeadRow) => void;
  onView: (leadId: string) => void;
  onNotes: (lead: LeadRow) => void;
};

const LeadsTableRow = memo(function LeadsTableRow({
  lead,
  index,
  columnsToShow,
  isSelected,
  onToggleSelect,
  onEdit,
  onView,
  onNotes,
}: LeadsTableRowProps) {
  const status = getLeadStatusDisplay(lead);
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();

  return (
    <TableRow
      className={cn(
        "cursor-pointer border-b transition-all duration-150",
        index % 2 === 1 ? "bg-slate-50/60" : "bg-white",
        "hover:bg-[#204060]/5 hover:shadow-sm",
        isSelected && "bg-[#204060]/10",
      )}
      onClick={() => onView(lead.id)}
    >
      <TableCell onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          aria-label={`Select ${fullName}`}
        />
      </TableCell>

      {columnsToShow.name ? (
        <TableCell>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#204060] to-[#2d5a8a] text-[11px] font-bold text-white shadow-sm">
              {fullName
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-800 dark:text-white">{fullName}</span>
              {lead.leadStatus === "new" ? (
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  New
                </span>
              ) : null}
            </div>
          </div>
        </TableCell>
      ) : null}

      {columnsToShow.assignedTo ? (
        <TableCell className="text-sm">{lead.assignedUser?.name ?? "Unassigned"}</TableCell>
      ) : null}

      {columnsToShow.source ? (
        <TableCell className="text-sm">{formatLeadSourceDisplay(lead.leadSource)}</TableCell>
      ) : null}

      {columnsToShow.status ? (
        <TableCell>
          <div className="space-y-0.5">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                status.primaryClass,
              )}
            >
              {status.primary}
            </span>
            {status.secondary ? (
              <p className={cn("text-xs font-medium", status.secondaryClass)}>{status.secondary}</p>
            ) : null}
          </div>
        </TableCell>
      ) : null}

      {columnsToShow.project ? (
        <TableCell className="text-sm">{lead.projectName ?? "—"}</TableCell>
      ) : null}

      {columnsToShow.actions ? (
        <TableCell className="text-right">
          <div className="flex flex-wrap justify-end gap-1.5">
            <ActionIconButton
              icon={<Pencil className="h-3.5 w-3.5" />}
              label={`Edit lead ${fullName}`}
              className="bg-emerald-500"
              onClick={() => onEdit(lead)}
            />
            <ActionIconButton
              icon={<Eye className="h-3.5 w-3.5" />}
              label={`View lead ${fullName}`}
              className="bg-blue-500"
              onClick={() => onView(lead.id)}
            />
            <ActionIconButton
              icon={<Phone className="h-3.5 w-3.5" />}
              label={`Call ${fullName} (available on mobile app)`}
              className="bg-amber-500"
              disabled
            />
            <ActionIconButton
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label={`SMS ${fullName} (available on mobile app)`}
              className="bg-cyan-500"
              disabled
            />
            <ActionIconButton
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label={`WhatsApp ${fullName} (available on mobile app)`}
              className="bg-green-600"
              disabled
            />
            <ActionIconButton
              icon={<Mail className="h-3.5 w-3.5" />}
              label={`Email ${fullName} (available on mobile app)`}
              className="bg-sky-500"
              disabled
            />
            <ActionIconButton
              icon={<StickyNote className="h-3.5 w-3.5" />}
              label={`Add note for ${fullName}`}
              className="bg-indigo-500"
              onClick={() => onNotes(lead)}
            />
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
});

function LeadsTableHeader({
  columnsToShow,
  allOnPageSelected,
  onToggleAll,
}: {
  columnsToShow: LeadsColumnVisibility;
  allOnPageSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
      <TableRow className="border-b hover:bg-muted/95">
        <TableHead className="w-10 bg-muted/95">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={allOnPageSelected}
            onChange={onToggleAll}
            aria-label="Select all leads on this page"
          />
        </TableHead>
        {columnsToShow.name ? <TableHead className="bg-muted/95">Lead Name</TableHead> : null}
        {columnsToShow.assignedTo ? (
          <TableHead className="bg-muted/95">Assigned To</TableHead>
        ) : null}
        {columnsToShow.source ? <TableHead className="bg-muted/95">Source</TableHead> : null}
        {columnsToShow.status ? <TableHead className="bg-muted/95">Status</TableHead> : null}
        {columnsToShow.project ? <TableHead className="bg-muted/95">Project(s)</TableHead> : null}
        {columnsToShow.actions ? (
          <TableHead className="bg-muted/95 text-right">Actions</TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  );
}

export const LeadsTable = memo(function LeadsTable({
  leads,
  onEdit,
  onAddLead,
  isLoading = false,
  columnsToShow = DEFAULT_LEADS_COLUMN_VISIBILITY,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  selectedIds,
  onSelectionChange,
}: LeadsTableProps) {
  const router = useRouter();
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [noteTarget, setNoteTarget] = useState<LeadRow | null>(null);

  const selectionControlled = selectedIds !== undefined && onSelectionChange !== undefined;
  const selected = selectionControlled ? selectedIds : internalSelected;
  const setSelected = selectionControlled ? onSelectionChange : setInternalSelected;

  const allOnPageSelected = leads.length > 0 && leads.every((lead) => selected.includes(lead.id));
  const totalCount = total ?? leads.length;
  const showEmpty = !isLoading && leads.length === 0;

  const visibleIds = useMemo(() => new Set(leads.map((lead) => lead.id)), [leads]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleOne = useCallback(
    (leadId: string) => {
      setSelected(
        selectedSet.has(leadId) ? selected.filter((id) => id !== leadId) : [...selected, leadId],
      );
    },
    [selected, selectedSet, setSelected],
  );

  const toggleAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      setSelected(selected.filter((id) => !visibleIds.has(id)));
      return;
    }
    const merged = new Set(selected);
    for (const lead of leads) {
      merged.add(lead.id);
    }
    setSelected([...merged]);
  }, [allOnPageSelected, leads, selected, setSelected, visibleIds]);

  const handleView = useCallback((leadId: string) => router.push(`/leads/${leadId}`), [router]);
  const handleNotes = useCallback((lead: LeadRow) => setNoteTarget(lead), []);

  if (showEmpty) {
    return (
      <EmptyState
        title="No leads yet"
        description="Create your first lead to start tracking calls and follow-ups."
        actionLabel="Add Lead"
        onActionClick={onAddLead}
        icon={<Users className="h-7 w-7" />}
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden border-2 border-black">
        <div className="max-h-[calc(100vh-14rem)] overflow-auto">
          <Table aria-busy={isLoading} aria-label="Leads">
            <LeadsTableHeader
              columnsToShow={columnsToShow}
              allOnPageSelected={allOnPageSelected}
              onToggleAll={toggleAllOnPage}
            />
            <TableBody>
              {isLoading ? (
                <LeadsTableBodySkeleton rows={pageSize} columnsToShow={columnsToShow} />
              ) : (
                leads.map((lead, index) => (
                  <LeadsTableRow
                    key={lead.id}
                    lead={lead}
                    index={index}
                    columnsToShow={columnsToShow}
                    isSelected={selectedSet.has(lead.id)}
                    onToggleSelect={toggleOne}
                    onEdit={onEdit}
                    onView={handleView}
                    onNotes={handleNotes}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {onPageChange ? (
          <div className="border-t border-black bg-muted/10 px-4 py-3">
            <LeadsTablePagination
              page={page}
              pageSize={pageSize}
              total={totalCount}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              pageSizeOptions={pageSizeOptions}
            />
          </div>
        ) : null}
      </div>

      {noteTarget ? (
        <LeadNoteModal
          lead={noteTarget}
          open
          onOpenChange={(open) => {
            if (!open) setNoteTarget(null);
          }}
        />
      ) : null}
    </>
  );
});
