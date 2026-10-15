/** Keep the first row for each lead id and restore page order. Different ids stay separate. */
export function orderRowsByIds<T extends { id: string }>(ids: readonly string[], rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    if (!row?.id || byId.has(row.id)) continue;
    byId.set(row.id, row);
  }

  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}
