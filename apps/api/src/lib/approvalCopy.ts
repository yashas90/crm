import { formatINR } from "@propninja/types/money";
import { formatEffectiveDate, formatMonthLabel } from "./approvalCalendar.js";

export function monthlyIncentiveAdminMessage(input: {
  monthKey: string;
  eligibleEmployees: number;
  totalPayout: number;
}) {
  const month = formatMonthLabel(input.monthKey);
  return [
    `📊 ${month} incentives calculated for ${input.eligibleEmployees} employees.`,
    "Review and approve in Admin Panel.",
    "",
    "📊 Monthly incentives calculated.",
    `${input.eligibleEmployees} employees eligible | Total payout: ${formatINR(input.totalPayout)}`,
    "Tap to review and approve.",
  ].join("\n");
}

export function quarterlyAppraisalAdminMessage(input: {
  quarterName: string;
  employees: number;
  eligible: number;
}) {
  return [
    `📋 ${input.quarterName} appraisals ready for ${input.employees} employees.`,
    `${input.eligible} eligible for hike. Review in Admin Panel.`,
    "",
    "📋 Quarterly appraisals ready.",
    `${input.eligible} employees eligible for 10% hike.`,
    "Tap to review and approve.",
  ].join("\n");
}

export function staleIncentiveReminder(count: number) {
  return `⚠️ Reminder: ${count} incentive approvals pending for 7+ days.`;
}

export function salaryAppliedAdminMessage(count: number) {
  return `✅ Salary hike applied for ${count} employees today.`;
}

export function monthEndPendingMessage(count: number) {
  return `🚨 End of month: ${count} incentive approvals still pending!`;
}

export function incentiveApprovedMessage(input: {
  total: number;
  cash: number;
  esop: number;
  quarterName: string;
}) {
  return [
    `✅ Your incentive of ${formatINR(input.total)} has been approved!`,
    `Cash: ${formatINR(input.cash)} | ESOPs: ${formatINR(input.esop)}`,
    `Disbursement: ${input.quarterName}`,
  ].join("\n");
}

export function incentiveRejectedMessage(input: { monthKey: string; reason: string }) {
  return [
    `❌ Your incentive for ${formatMonthLabel(input.monthKey)} was not approved.`,
    `Reason: ${input.reason}`,
    "Contact HR for details.",
  ].join("\n");
}

export function incentiveDisbursedMessage(input: { quarterName: string; total: number }) {
  return `💰 Your ${input.quarterName} incentive of ${formatINR(input.total)} has been disbursed to your account!`;
}

export function appraisalApprovedMessage(input: {
  currentSalary: number;
  newSalary: number;
  effectiveFrom: string;
  hikePercent: number;
}) {
  const hike = Math.round(input.hikePercent * 100);
  return [
    "🎉 Congratulations! Your appraisal is approved.",
    `Salary hike: ${hike}%`,
    `Current salary: ${formatINR(input.currentSalary)}`,
    `New salary: ${formatINR(input.newSalary)}`,
    `Effective from: ${formatEffectiveDate(input.effectiveFrom)}`,
  ].join("\n");
}

export function appraisalRejectedMessage(input: { quarterName: string; reason: string }) {
  return [
    `Your appraisal for ${input.quarterName} was reviewed.`,
    `Reason: ${input.reason}`,
    "Contact HR for details.",
  ].join("\n");
}
