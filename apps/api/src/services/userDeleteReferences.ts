import { sql } from "drizzle-orm";
import { sqlRows } from "../lib/contactPool/sql.js";
import type { Database } from "../lib/db.js";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Rows that belong to the user and should disappear with the account. */
const DELETE_WITH_USER = new Set([
  "notifications",
  "agent_targets",
  "agent_calling_limits",
  "agent_daily_limits",
  "agent_data_requests",
  "agent_calling_data",
  "contact_call_logs",
]);

const DELETE_ORDER = [
  "contact_call_logs",
  "agent_calling_data",
  "agent_daily_limits",
  "agent_data_requests",
  "agent_calling_limits",
  "notifications",
  "agent_targets",
];

export type UserForeignKey = {
  schemaName: string;
  tableName: string;
  columnName: string;
  isNotNull: boolean;
  isPrimary: boolean;
};

/**
 * Nullable links are cleared. A user's own rows are deleted.
 * Required links on shared records are pointed at the admin performing the delete
 * so the user row can be removed.
 */
export function userForeignKeyAction(
  fk: Pick<UserForeignKey, "tableName" | "isNotNull" | "isPrimary">,
): "null" | "delete" | "reassign" {
  if (fk.isPrimary || DELETE_WITH_USER.has(fk.tableName)) return "delete";
  if (!fk.isNotNull) return "null";
  return "reassign";
}

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

function isSafeFk(fk: UserForeignKey): boolean {
  return (
    IDENTIFIER.test(fk.schemaName) &&
    IDENTIFIER.test(fk.tableName) &&
    IDENTIFIER.test(fk.columnName)
  );
}

function tableSql(fk: UserForeignKey) {
  return sql`${sql.identifier(fk.schemaName)}.${sql.identifier(fk.tableName)}`;
}

async function relationExists(db: Database, tableName: string): Promise<boolean> {
  const rows = sqlRows(await db.execute(sql`SELECT to_regclass(${`public.${tableName}`}) AS name`));
  const name = rows[0]?.name;
  return typeof name === "string" && name.length > 0;
}

async function listBlockingUserForeignKeys(db: Database): Promise<UserForeignKey[]> {
  const rows = sqlRows(
    await db.execute(sql`
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      a.attnotnull AS is_not_null,
      EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = con.conrelid
          AND i.indisprimary
          AND a.attnum = ANY (i.indkey)
      ) AS is_primary
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = c.oid
     AND a.attnum = con.conkey[1]
     AND NOT a.attisdropped
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND array_length(con.conkey, 1) = 1
      AND con.confdeltype NOT IN ('c', 'n')
      AND con.conrelid <> 'public.users'::regclass
  `),
  );

  return rows.map((row) => ({
    schemaName: String(row.schema_name),
    tableName: String(row.table_name),
    columnName: String(row.column_name),
    isNotNull: asBool(row.is_not_null),
    isPrimary: asBool(row.is_primary),
  }));
}

/**
 * Drop every foreign key that would reject deleting this user.
 * Calling-pool contacts still marked assigned are returned to the unassigned queue.
 */
export async function releaseBlockingUserReferences(
  db: Database,
  userId: string,
  actingUserId: string,
) {
  if (await relationExists(db, "contact_pool")) {
    await db.execute(sql`
      UPDATE contact_pool
      SET
        assigned_to_agent_id = NULL,
        assigned_at = NULL,
        status = CASE WHEN status = 'assigned' THEN 'unassigned' ELSE status END
      WHERE assigned_to_agent_id = ${userId}
    `);
    await db.execute(sql`
      UPDATE contact_pool
      SET uploaded_by_admin_id = NULL
      WHERE uploaded_by_admin_id = ${userId}
    `);
  }

  const hasCallLogs = await relationExists(db, "contact_call_logs");
  const hasCallingData = await relationExists(db, "agent_calling_data");
  if (hasCallLogs && hasCallingData) {
    await db.execute(sql`
      UPDATE contact_call_logs
      SET record_id = NULL
      WHERE record_id IN (
        SELECT record_id FROM agent_calling_data WHERE agent_id = ${userId}
      )
    `);
  }
  if (hasCallLogs) {
    await db.execute(sql`DELETE FROM contact_call_logs WHERE agent_id = ${userId}`);
  }
  if (hasCallingData) {
    await db.execute(sql`DELETE FROM agent_calling_data WHERE agent_id = ${userId}`);
  }
  if (await relationExists(db, "agent_daily_limits")) {
    await db.execute(sql`DELETE FROM agent_daily_limits WHERE agent_id = ${userId}`);
  }
  if (await relationExists(db, "agent_data_requests")) {
    await db.execute(sql`DELETE FROM agent_data_requests WHERE agent_id = ${userId}`);
  }
  if (await relationExists(db, "agent_calling_limits")) {
    await db.execute(sql`DELETE FROM agent_calling_limits WHERE agent_id = ${userId}`);
  }

  const blocking = (await listBlockingUserForeignKeys(db)).filter(isSafeFk);
  const deleteRank = (tableName: string) => {
    const index = DELETE_ORDER.indexOf(tableName);
    return index === -1 ? DELETE_ORDER.length : index;
  };

  for (const fk of blocking) {
    if (userForeignKeyAction(fk) !== "null") continue;
    if (fk.tableName === "contact_pool" && fk.columnName === "assigned_to_agent_id") continue;
    if (fk.tableName === "contact_pool" && fk.columnName === "uploaded_by_admin_id") continue;
    await db.execute(sql`
      UPDATE ${tableSql(fk)}
      SET ${sql.identifier(fk.columnName)} = NULL
      WHERE ${sql.identifier(fk.columnName)} = ${userId}
    `);
  }

  const deleted = new Set<string>();
  for (const fk of blocking
    .filter((row) => userForeignKeyAction(row) === "delete")
    .sort((a, b) => deleteRank(a.tableName) - deleteRank(b.tableName))) {
    const key = `${fk.schemaName}.${fk.tableName}`;
    if (deleted.has(key)) continue;
    deleted.add(key);
    await db.execute(sql`
      DELETE FROM ${tableSql(fk)}
      WHERE ${sql.identifier(fk.columnName)} = ${userId}
    `);
  }

  for (const fk of blocking) {
    if (userForeignKeyAction(fk) !== "reassign") continue;
    await db.execute(sql`
      UPDATE ${tableSql(fk)}
      SET ${sql.identifier(fk.columnName)} = ${actingUserId}
      WHERE ${sql.identifier(fk.columnName)} = ${userId}
    `);
  }
}
