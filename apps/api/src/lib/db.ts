import { type Database, createDb } from "@propninja/db";
import { env } from "./env.js";

export const db = createDb(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });

export type { Database };

export function getDb(): Database {
  return db;
}
