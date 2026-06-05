import { type Database, createDb } from "@propninja/db";
import { env } from "./env.js";

export const db = createDb(env.DATABASE_URL);

export type { Database };

export function getDb(): Database {
  return db;
}
