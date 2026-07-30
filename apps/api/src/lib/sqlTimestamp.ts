import { sql } from "drizzle-orm";

/**
 * Bind a JS Date as timestamptz for raw/nested Drizzle SQL.
 * Bare `${date}` becomes Date.toString() ("Mon Jul 27...") which Postgres rejects.
 */
export function sqlTimestamptz(date: Date | string) {
  const iso = typeof date === "string" ? new Date(date).toISOString() : date.toISOString();
  return sql`${iso}::timestamptz`;
}
