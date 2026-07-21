import { describe, expect, it } from "vitest";
import { extractPostgresErrorMeta } from "./postgresErrorMeta.js";

describe("extractPostgresErrorMeta", () => {
  it("extracts safe postgres.js-style fields", () => {
    expect(
      extractPostgresErrorMeta({
        code: "42703",
        column_name: "confirmed_by_client",
        table_name: "site_visits",
        severity: "ERROR",
        detail: "secret row contents",
        query: "SELECT * FROM site_visits",
      }),
    ).toEqual({
      code: "42703",
      column: "confirmed_by_client",
      table: "site_visits",
      severity: "ERROR",
    });
  });

  it("extracts node-postgres-style constraint fields", () => {
    expect(
      extractPostgresErrorMeta({
        code: "23505",
        constraint: "leads_phone_unique",
        table: "leads",
      }),
    ).toEqual({
      code: "23505",
      constraint: "leads_phone_unique",
      table: "leads",
    });
  });

  it("ignores generic errors and non-SQLSTATE codes", () => {
    expect(extractPostgresErrorMeta(new Error("boom"))).toBeUndefined();
    expect(extractPostgresErrorMeta({ code: "ENOENT" })).toBeUndefined();
    expect(extractPostgresErrorMeta(null)).toBeUndefined();
  });
});
