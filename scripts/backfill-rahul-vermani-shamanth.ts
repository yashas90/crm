/**
 * Idempotent production backfill for Rahul Vermani:
 * assign to agent Shamanth, record ~1 month of follow-ups, book site visit 16 Aug 2026.
 *
 * Required env:
 *   DATABASE_URL — Postgres connection string (Railway public URL, not railway.internal)
 *
 * Run:
 *   pnpm db:backfill:rahul-vermani
 */
import "dotenv/config";
import {
  BackfillRahulVermaniError,
  backfillRahulVermani,
  createDb,
} from "../packages/db/src/index.js";

function fail(message: string): never {
  console.error(`[backfill-rahul-vermani] ERROR: ${message}`);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail("DATABASE_URL is not set");
  }

  const db = createDb(databaseUrl);

  try {
    const result = await backfillRahulVermani(db);
    console.log("[backfill-rahul-vermani] OK");
    console.log(`  lead:     ${result.leadName} (${result.leadId})`);
    console.log(`  owner:    ${result.agentName} (${result.agentId})`);
    console.log(`  follow-ups: ${result.followUpCount} since 18 Jul 2026`);
    console.log(
      `  site visit: ${result.siteVisitDate} ${result.siteVisitTime} IST (${result.projectName})`,
    );
    process.exit(0);
  } catch (error) {
    if (error instanceof BackfillRahulVermaniError) {
      fail(error.message);
    }
    const message = error instanceof Error ? error.message : String(error);
    fail(message);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
