export type ReportMetricRow = {
  label: string;
  value: number;
  previousValue: number;
  changePercent: number | null;
};

export type ReportSummaryEmailInput = {
  recipientName: string;
  periodLabel: string;
  comparisonLabel: string;
  metrics: ReportMetricRow[];
  topAgents?: { name: string; callsMade: number }[];
  analyticsUrl?: string;
  unsubscribeUrl: string;
};

function formatChange(changePercent: number | null): string {
  if (changePercent === null) return "—";
  if (changePercent > 0) return `+${changePercent}%`;
  if (changePercent < 0) return `${changePercent}%`;
  return "0%";
}

function changeColor(changePercent: number | null): string {
  if (changePercent === null) return "#64748b";
  if (changePercent > 0) return "#16a34a";
  if (changePercent < 0) return "#dc2626";
  return "#64748b";
}

export function buildReportSummarySubject(periodLabel: string, isWeekly: boolean): string {
  return isWeekly
    ? `PropNinja weekly report — ${periodLabel}`
    : `PropNinja daily report — ${periodLabel}`;
}

export function buildReportSummaryHtml(input: ReportSummaryEmailInput): string {
  const analyticsUrl = input.analyticsUrl ?? "https://www.ninjamarketing.in/analytics";
  const metricRows = input.metrics
    .map((metric) => {
      const change = formatChange(metric.changePercent);
      const color = changeColor(metric.changePercent);
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${metric.label}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${metric.value}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:${color};text-align:right;font-weight:600;">${change}</td>
        </tr>`;
    })
    .join("");

  const leaderboard =
    input.topAgents && input.topAgents.length > 0
      ? `
        <h2 style="margin:28px 0 12px;font-size:16px;color:#0f172a;">Top agents by calls</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;">
          ${input.topAgents
            .map(
              (agent, index) => `
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">#${index + 1} ${agent.name}</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${agent.callsMade} calls</td>
            </tr>`,
            )
            .join("")}
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PropNinja Report</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:28px 24px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">PropNinja CRM</p>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Performance summary for ${input.recipientName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${input.periodLabel}</p>
              <p style="margin:0 0 20px;font-size:14px;color:#475569;">Compared to ${input.comparisonLabel}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr>
                    <th align="left" style="padding:10px 16px;background:#f8fafc;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Metric</th>
                    <th align="right" style="padding:10px 16px;background:#f8fafc;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Value</th>
                    <th align="right" style="padding:10px 16px;background:#f8fafc;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Change</th>
                  </tr>
                </thead>
                <tbody>
                  ${metricRows}
                </tbody>
              </table>
              ${leaderboard}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
                <tr>
                  <td style="border-radius:10px;background:#0d9488;">
                    <a href="${analyticsUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View full report</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                You receive this email because report emails are enabled for your organization.<br />
                <a href="${input.unsubscribeUrl}" style="color:#64748b;">Unsubscribe from report emails</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildReportSummaryText(input: ReportSummaryEmailInput): string {
  const lines = [
    `PropNinja CRM — ${input.periodLabel}`,
    `Hello ${input.recipientName},`,
    "",
    ...input.metrics.map(
      (metric) =>
        `${metric.label}: ${metric.value} (${formatChange(metric.changePercent)} vs ${input.comparisonLabel})`,
    ),
  ];

  if (input.topAgents?.length) {
    lines.push("", "Top agents by calls:");
    for (const [index, agent] of input.topAgents.entries()) {
      lines.push(`${index + 1}. ${agent.name} — ${agent.callsMade} calls`);
    }
  }

  lines.push(
    "",
    `View full report: ${input.analyticsUrl ?? "https://www.ninjamarketing.in/analytics"}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  );

  return lines.join("\n");
}
