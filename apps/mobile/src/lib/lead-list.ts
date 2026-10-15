type LeadIdRow = { id?: string | null };

export type LeadListPage<T extends LeadIdRow> = {
  items?: T[] | null;
  page?: number;
  pageSize?: number;
  total?: number;
};

/**
 * One row per lead id, first occurrence wins.
 * Later pages that repeat an id (refetch of page 1, overlapping offset) are ignored.
 * Different ids stay separate even when they share a display code.
 */
export function flattenLeadPages<T extends LeadIdRow>(
  pages: Array<LeadListPage<T> | null | undefined> | null | undefined,
  options?: { omit?: (lead: T) => boolean },
): T[] {
  if (!pages?.length) return [];
  const seen = new Set<string>();
  const flat: T[] = [];
  for (const page of pages) {
    if (!Array.isArray(page?.items)) continue;
    for (const lead of page.items) {
      const id = lead?.id;
      if (!id || seen.has(id)) continue;
      if (options?.omit?.(lead)) continue;
      seen.add(id);
      flat.push(lead);
    }
  }
  return flat;
}

function pageAddsNewLeadIds(pages: Array<{ items?: LeadIdRow[] | null }>): boolean {
  if (pages.length <= 1) return true;
  const seen = new Set<string>();
  for (const page of pages.slice(0, -1)) {
    for (const lead of page.items ?? []) {
      if (lead?.id) seen.add(lead.id);
    }
  }
  return (pages[pages.length - 1]?.items ?? []).some((lead) => {
    const id = lead?.id;
    return typeof id === "string" && id.length > 0 && !seen.has(id);
  });
}

/**
 * Next offset page, or undefined when another fetch would only re-append ids
 * already loaded (or the server already returned a short page).
 */
export function resolveNextLeadPage<T extends LeadIdRow>(
  lastPage: LeadListPage<T> | null | undefined,
  allPages: Array<LeadListPage<T> | null | undefined>,
  allPageParams: readonly unknown[],
): number | undefined {
  if (!lastPage || typeof lastPage.total !== "number" || typeof lastPage.pageSize !== "number") {
    return undefined;
  }

  const pages = allPages.filter((page): page is LeadListPage<T> => page != null);
  if (pages.length > 1 && !pageAddsNewLeadIds(pages)) return undefined;

  const pageSize = Math.max(1, lastPage.pageSize);
  const itemCount = Array.isArray(lastPage.items) ? lastPage.items.length : 0;
  if (itemCount < pageSize) return undefined;

  const totalPages = Math.max(1, Math.ceil(lastPage.total / pageSize));
  const reported = Number(lastPage.page);
  const current = Number.isFinite(reported) && reported >= 1 ? reported : pages.length;
  if (current >= totalPages) return undefined;

  const next = current + 1;
  if (allPageParams.some((param) => Number(param) === next)) return undefined;
  return next;
}
