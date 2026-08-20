"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { EmptyState } from "@/components/common/empty-state";
import { QuickFilterTabs } from "@/components/common/quick-filter-tabs";
import { UserCreateDialog } from "@/components/users/user-create-dialog";
import { UserDeleteDialog } from "@/components/users/user-delete-dialog";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { UsersBulkActionsBar } from "@/components/users/users-bulk-actions-bar";
import { UsersListToolbar } from "@/components/users/users-list-toolbar";
import { UsersTable } from "@/components/users/users-table";
import { usePermissions } from "@/hooks/use-permissions";
import {
  USERS_PAGE_SIZES,
  type UserRow,
  type UserStatusFilter,
  type UsersPageSize,
  downloadUsersExport,
  isForbiddenError,
  useUserScopeCounts,
  useUsersList,
} from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { getQueryClient } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { AlertCircle, Download, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STATUS_TABS: { id: UserStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const SEARCH_DEBOUNCE_MS = 300;

export default function UsersPage() {
  const { session, ready, isAdmin, canUpdateUser, canDeleteUser, canViewUsers } = usePermissions();
  const listEnabled = ready && canViewUsers;

  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<UsersPageSize>(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [status, search, pageSize]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status,
      page,
      pageSize,
    }),
    [search, status, page, pageSize],
  );

  const listQuery = useUsersList(listParams, { enabled: listEnabled });
  const scopeCounts = useUserScopeCounts(search || undefined, { enabled: listEnabled });

  const tableLoading = !listQuery.data && (listQuery.isLoading || listQuery.isFetching);
  const users = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  const scopeTabCounts = useMemo(
    () => ({
      all: scopeCounts.data?.all ?? 0,
      active: scopeCounts.data?.active ?? 0,
      inactive: scopeCounts.data?.inactive ?? 0,
    }),
    [scopeCounts.data],
  );

  function handleSearchSubmit() {
    setSearch(searchDraft.trim());
  }

  function handleRetry() {
    void getQueryClient().invalidateQueries({ queryKey: ["users"] });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadUsersExport({ search: search || undefined, status });
      toast.success("Users exported");
    } catch (error) {
      toast.error(getErrorMessage(error, "Export failed"));
    } finally {
      setIsExporting(false);
    }
  }

  if (ready && !canViewUsers) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-sm text-muted-foreground">
            Team members and roles for your organization.
          </p>
        </div>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-sm text-muted-foreground">
            Team members and roles for your organization.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {listEnabled ? (
            <Button
              type="button"
              variant="outline"
              disabled={isExporting}
              onClick={() => void handleExport()}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          ) : null}
          {ready && isAdmin ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add user
            </Button>
          ) : null}
        </div>
      </div>

      <QuickFilterTabs
        tabs={STATUS_TABS}
        value={status}
        onChange={setStatus}
        counts={scopeTabCounts}
        isLoadingCounts={scopeCounts.isLoading && !scopeCounts.data}
        variant="pill"
        ariaLabel="User status"
      />

      <UsersListToolbar
        searchDraft={searchDraft}
        onSearchDraftChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
        pageSize={pageSize}
        onPageSizeChange={(size) => setPageSize(size as UsersPageSize)}
        pageSizeOptions={USERS_PAGE_SIZES}
      />

      <UsersBulkActionsBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        canUpdate={canUpdateUser}
      />

      {listQuery.isError ? (
        isForbiddenError(listQuery.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <EmptyState
            title="Unable to load users"
            description="The user list could not be loaded. Check your connection and try again."
            actionLabel="Retry"
            onActionClick={handleRetry}
            icon={<AlertCircle className="h-7 w-7 text-destructive" />}
          />
        )
      ) : (
        <UsersTable
          users={users}
          isLoading={tableLoading}
          canUpdate={canUpdateUser}
          canDelete={canDeleteUser}
          currentUserId={session?.id}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onAddUser={isAdmin ? () => setCreateOpen(true) : undefined}
          onEditUser={canUpdateUser ? (user) => setEditingUser(user) : undefined}
          onDeleteUser={canDeleteUser ? (user) => setDeletingUser(user) : undefined}
        />
      )}

      <UserCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserEditDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        currentUserId={session?.id}
      />
      <UserDeleteDialog
        user={deletingUser}
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
      />
    </div>
  );
}
