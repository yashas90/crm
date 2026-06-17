import { describe, expect, it } from "vitest";
import { buildReportSummaryHtml, buildReportSummarySubject } from "./reportSummary.js";

describe("reportSummary email template", () => {
  const input = {
    recipientName: "Manager User",
    periodLabel: "2025-06-15",
    comparisonLabel: "2025-06-14",
    unsubscribeUrl: "https://api.example.com/api/auth/unsubscribe-reports?token=abc",
    metrics: [
      {
        label: "New leads",
        value: 12,
        previousValue: 8,
        changePercent: 50,
      },
      {
        label: "Calls made",
        value: 40,
        previousValue: 40,
        changePercent: 0,
      },
    ],
    topAgents: [
      { name: "Ravi", callsMade: 18 },
      { name: "Priya", callsMade: 15 },
    ],
  };

  it("renders subject for daily and weekly reports", () => {
    expect(buildReportSummarySubject("2025-06-15", false)).toBe(
      "PropNinja daily report — 2025-06-15",
    );
    expect(buildReportSummarySubject("1 Jun — 7 Jun", true)).toBe(
      "PropNinja weekly report — 1 Jun — 7 Jun",
    );
  });

  it("renders responsive HTML with metrics, CTA, and unsubscribe", () => {
    const html = buildReportSummaryHtml(input);

    expect(html).toContain("PropNinja CRM");
    expect(html).toContain("New leads");
    expect(html).toContain("+50%");
    expect(html).toContain("View full report");
    expect(html).toContain("https://www.ninjamarketing.in/analytics");
    expect(html).toContain(input.unsubscribeUrl);
    expect(html).toContain("Top agents by calls");
    expect(html).toContain("Ravi");
    expect(html).not.toContain("<link ");
    expect(html).not.toContain("stylesheet");
  });
});
