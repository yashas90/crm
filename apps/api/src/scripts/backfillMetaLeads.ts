import { backfillMetaLeads } from "../services/metaLeadBackfillService.js";

const sinceDays = Number(process.env.META_BACKFILL_DAYS ?? "7");
console.log(`Starting Meta lead backfill (sinceDays=${sinceDays})...`);
const result = await backfillMetaLeads(undefined, { sinceDays });
console.log(JSON.stringify(result, null, 2));
process.exit(result.failed > 0 && result.ingested === 0 ? 1 : 0);
