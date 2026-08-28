import { describe, expect, it } from "vitest";
import {
  LEAD_PURGE_AFTER_MS,
  NA_LEAD_PURGE_AFTER_MS,
  SOFT_DELETED_LEAD_PURGE_AFTER_MS,
  naLeadExpiredSql,
} from "./purgeExpiredLeads.js";

function collectSqlText(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return out;
  }
  if (!value || typeof value !== "object") return out;

  const record = value as Record<string, unknown>;
  if (typeof record.name === "string") out.push(record.name);
  if (Array.isArray(record.queryChunks)) {
    for (const chunk of record.queryChunks) collectSqlText(chunk, out);
  }
  if (Array.isArray(record.value)) {
    for (const chunk of record.value) collectSqlText(chunk, out);
  }
  if ("value" in record && (typeof record.value === "string" || typeof record.value === "number")) {
    out.push(String(record.value));
  }
  return out;
}

describe("lead purge retention", () => {
  it("hard-deletes NA leads after 1 week in not_interested or dropped", () => {
    expect(NA_LEAD_PURGE_AFTER_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(LEAD_PURGE_AFTER_MS).toBe(NA_LEAD_PURGE_AFTER_MS);
  });

  it("hard-deletes soft-deleted leads after 48 hours", () => {
    expect(SOFT_DELETED_LEAD_PURGE_AFTER_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe("naLeadExpiredSql", () => {
  it("binds the cutoff as timestamptz ISO, not Date.toString()", () => {
    const cutoff = new Date("2026-08-21T05:00:00.000Z");
    const sqlText = collectSqlText(naLeadExpiredSql(cutoff)).join(" ");

    expect(sqlText).toContain("2026-08-21T05:00:00.000Z");
    expect(sqlText).toContain("timestamptz");
    expect(sqlText).not.toContain("Fri Aug 21");
    expect(sqlText).not.toContain(cutoff.toString());
  });

  it("keeps the indexed na_since_at path and the status-change fallback", () => {
    const sqlText = collectSqlText(naLeadExpiredSql(new Date("2026-08-21T05:00:00.000Z"))).join(
      " ",
    );

    expect(sqlText).toContain("is null");
    expect(sqlText).toContain("status_change");
    expect(sqlText).toContain("not_interested");
    expect(sqlText).toContain("dropped");
    expect(sqlText).toContain("COALESCE");
  });
});
