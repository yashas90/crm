import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type CreateDbOptions = {
  /** Max Postgres connections in the pool (default 10). Raise for 20+ concurrent agents. */
  max?: number;
  idleTimeoutSeconds?: number;
};

export function createDb(connectionString: string, options: CreateDbOptions = {}) {
  const client = postgres(connectionString, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 30,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema/index.js";
export * from "./schema/types.js";
export {
  BackfillRahulVermaniError,
  backfillRahulVermani,
  isRahulVermaniLead,
  type BackfillRahulVermaniResult,
} from "./backfillRahulVermani.js";
