"use client";

import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UsersTablePagination } from "@/components/users/users-table-pagination";
import type { UserRow } from "@/hooks/use-users";
import { useUpdateUser } from "@/hooks/use-users";
import {
  formatUserEmail,
  formatUserFullName,
  getRoleLabelClass,
  getUserRoleLabel,
} from "@/lib/user-display";
import { cn } from "@propninja/ui/lib/utils";
import { Eye, Pencil, Power, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, memo, useCallback, useMemo, useState } from "react";

const HEADER_CELL = "bg-slate-900 font-semibold text-slate-50";

type UsersTableProps = {
  users: UserRow[];
  isLoading?: boolean;
  canUpdate?: boolean;
  currentUserId?: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onAddUser?: () => void;
  onEditUser?: (user: UserRow) => void;
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
        "flex h-8 w-8 items-center justify-center rounded-md text-white shadow-[2px_2px_0_0_#000] transition-opacity",
        className,
        disabled ? "cursor-not-allowed opacity-45" : "hover:opacity-90",
      )}
    >
      {icon}
    </button>
  );
}

function UsersTableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={`user-skeleton-${rowIndex}`}>
          {Array.from({ length: 4 }, (__, cellIndex) => (
            <TableCell key={`user-skeleton-${rowIndex}-${cellIndex}`}>
              <Skeleton className="h-5 w-full max-w-[12rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

type UsersTableRowProps = {
  user: UserRow;
  index: number;
  canUpdate: boolean;
  isSelf: boolean;
  isSelected: boolean;
  isToggling: boolean;
  onToggleSelect: (userId: string) => void;
  onEdit: (userId: string) => void;
  onView: (userId: string) => void;
  onToggleActive: (user: UserRow) => void;
};

const UsersTableRow = memo(function UsersTableRow({
  user,
  index,
  canUpdate,
  isSelf,
  isSelected,
  isToggling,
  onToggleSelect,
  onEdit,
  onView,
  onToggleActive,
}: UsersTableRowProps) {
  const fullName = formatUserFullName(user);
  const email = formatUserEmail(user);
  const roleLabel = user.roleLabel?.trim() || getUserRoleLabel(user);

  return (
    <TableRow
      className={cn(
        "border-b transition-colors",
        index % 2 === 1 ? "bg-muted/15" : "bg-background",
        "hover:bg-primary/5",
        isSelected && "bg-primary/10",
      )}
    >
      <TableCell>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={isSelected}
          onChange={() => onToggleSelect(user.id)}
          aria-label={`Select ${fullName}`}
        />
      </TableCell>
      <TableCell>
        <div className="min-w-[10rem]">
          <p className="font-medium">{fullName}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
            getRoleLabelClass(roleLabel),
          )}
        >
          {roleLabel}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-1.5">
          <ActionIconButton
            icon={<Pencil className="h-3.5 w-3.5" />}
            label={`Edit ${fullName}`}
            className="bg-emerald-500"
            disabled={!canUpdate}
            onClick={() => onEdit(user.id)}
          />
          <ActionIconButton
            icon={<Power className="h-3.5 w-3.5" />}
            label={
              user.isLastAdmin && user.isActive
                ? `Cannot deactivate ${fullName} — last admin`
                : user.isActive
                  ? `Deactivate ${fullName}`
                  : `Activate ${fullName}`
            }
            className={user.isActive ? "bg-rose-500" : "bg-emerald-600"}
            disabled={!canUpdate || isSelf || isToggling || (user.isLastAdmin && user.isActive)}
            onClick={() => onToggleActive(user)}
          />
          <ActionIconButton
            icon={<Eye className="h-3.5 w-3.5" />}
            label={`View ${fullName}`}
            className="bg-blue-500"
            onClick={() => onView(user.id)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
});

export const UsersTable = memo(function UsersTable({
  users,
  isLoading = false,
  canUpdate = false,
  currentUserId,
  page,
  pageSize,
  total,
  onPageChange,
  selectedIds,
  onSelectionChange,
  onAddUser,
  onEditUser,
}: UsersTableProps) {
  const router = useRouter();
  const updateUser = useUpdateUser();
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const selectionControlled = selectedIds !== undefined && onSelectionChange !== undefined;
  const selected = selectionControlled ? selectedIds : internalSelected;
  const setSelected = selectionControlled ? onSelectionChange : setInternalSelected;

  const allOnPageSelected = users.length > 0 && users.every((user) => selected.includes(user.id));
  const showEmpty = !isLoading && users.length === 0;

  const visibleIds = useMemo(() => new Set(users.map((user) => user.id)), [users]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleOne = useCallback(
    (userId: string) => {
      setSelected(
        selectedSet.has(userId) ? selected.filter((id) => id !== userId) : [...selected, userId],
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
    for (const user of users) {
      merged.add(user.id);
    }
    setSelected([...merged]);
  }, [allOnPageSelected, users, selected, setSelected, visibleIds]);

  const handleEdit = useCallback(
    (userId: string) => {
      const user = users.find((row) => row.id === userId);
      if (user && onEditUser) {
        onEditUser(user);
        return;
      }
      router.push(`/users/${userId}`);
    },
    [users, onEditUser, router],
  );
  const handleView = useCallback(
    (userId: string) => router.push(`/users/${userId}?view=1`),
    [router],
  );

  const handleToggleActive = useCallback(
    (user: UserRow) => {
      setTogglingId(user.id);
      updateUser.mutate(
        { userId: user.id, payload: { isActive: !user.isActive } },
        { onSettled: () => setTogglingId(null) },
      );
    },
    [updateUser],
  );

  if (showEmpty) {
    return (
      <EmptyState
        title="No users found"
        description="Try adjusting your search or status filter, or add a new team member."
        actionLabel={onAddUser ? "Add user" : undefined}
        onActionClick={onAddUser}
        icon={<Users className="h-7 w-7" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden border-2 border-black">
        <div className="max-h-[calc(100vh-16rem)] overflow-auto">
          <Table aria-busy={isLoading} aria-label="Users">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-0 bg-slate-900 hover:bg-slate-900">
                <TableHead className={cn(HEADER_CELL, "w-10")}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={allOnPageSelected}
                    disabled={users.length === 0}
                    onChange={toggleAllOnPage}
                    aria-label="Select all users on this page"
                  />
                </TableHead>
                <TableHead className={HEADER_CELL}>Full Name</TableHead>
                <TableHead className={HEADER_CELL}>Role</TableHead>
                <TableHead className={cn(HEADER_CELL, "text-right")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <UsersTableSkeleton rows={pageSize} />
              ) : (
                users.map((user, index) => (
                  <UsersTableRow
                    key={user.id}
                    user={user}
                    index={index}
                    canUpdate={canUpdate}
                    isSelf={user.id === currentUserId}
                    isSelected={selectedSet.has(user.id)}
                    isToggling={togglingId === user.id}
                    onToggleSelect={toggleOne}
                    onEdit={handleEdit}
                    onView={handleView}
                    onToggleActive={handleToggleActive}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <UsersTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
});
