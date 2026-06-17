import postgres, { type Sql } from "postgres";

export type SlowQueryPayload = {
  elapsedMs: number;
  plan?: unknown;
  error?: string;
};

export type PostgresPoolOptions = {
  max?: number;
  min?: number;
  idleTimeoutSeconds?: number;
  slowQueryThresholdMs?: number;
  onSlowQuery?: (payload: SlowQueryPayload) => void;
};

async function warmPool(sql: Sql, min: number) {
  await Promise.all(Array.from({ length: min }, () => sql`SELECT 1`));
}

type SqlQuery = (strings: TemplateStringsArray, ...values: never[]) => ReturnType<Sql>;

function instrumentSql(
  base: Sql,
  thresholdMs: number,
  onSlowQuery: (p: SlowQueryPayload) => void,
): Sql {
  const query = base as SqlQuery;

  const wrapped = ((strings: TemplateStringsArray, ...values: never[]) => {
    const start = performance.now();
    const pending = query(strings, ...values);

    if (!pending || typeof (pending as Promise<unknown>).then !== "function") {
      return pending;
    }

    return (pending as Promise<unknown>).then(async (result) => {
      const elapsedMs = performance.now() - start;
      if (elapsedMs > thresholdMs) {
        onSlowQuery({ elapsedMs });
      }
      return result;
    });
  }) as Sql;

  return Object.assign(wrapped, base);
}

export function createPostgresClient(
  connectionString: string,
  options: PostgresPoolOptions = {},
): Sql {
  const sql = postgres(connectionString, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 30,
  });

  if (options.min && options.min > 0) {
    void warmPool(sql, options.min).catch(() => {
      // Pool warm-up is best-effort; first requests will open connections.
    });
  }

  if (options.slowQueryThresholdMs && options.onSlowQuery) {
    return instrumentSql(sql, options.slowQueryThresholdMs, options.onSlowQuery);
  }

  return sql;
}
