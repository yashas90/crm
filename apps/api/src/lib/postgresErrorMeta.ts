export type PostgresErrorMeta = {
  code?: string;
  constraint?: string;
  column?: string;
  table?: string;
  severity?: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/**
 * Extract safe PostgreSQL driver fields for logs/diagnostics.
 * Never includes detail, query text, parameters, or connection strings.
 */
export function extractPostgresErrorMeta(err: unknown): PostgresErrorMeta | undefined {
  if (!err || typeof err !== "object") return undefined;

  const record = err as Record<string, unknown>;
  const code = asNonEmptyString(record.code);
  // postgres.js / node-postgres use slightly different field names.
  const constraint =
    asNonEmptyString(record.constraint_name) ?? asNonEmptyString(record.constraint);
  const column = asNonEmptyString(record.column_name) ?? asNonEmptyString(record.column);
  const table = asNonEmptyString(record.table_name) ?? asNonEmptyString(record.table);
  const severity = asNonEmptyString(record.severity);

  // Require a PGSQLSTATE-looking code so generic Errors are ignored.
  if (!code || !/^[0-9A-Z]{5}$/.test(code)) {
    return undefined;
  }

  return {
    code,
    ...(constraint ? { constraint } : {}),
    ...(column ? { column } : {}),
    ...(table ? { table } : {}),
    ...(severity ? { severity } : {}),
  };
}
