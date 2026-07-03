export const DEFAULT_ORG_LOCALE = "en-IN";
export const DEFAULT_ORG_CURRENCY = "INR";
export const DEFAULT_ORG_DATE_FORMAT = "DD/MM/YYYY";
export const DEFAULT_ORG_TIMEZONE = "Asia/Kolkata";

export const ORG_LOCALE_OPTIONS = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
] as const;

export const ORG_CURRENCY_OPTIONS = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "GBP", label: "GBP — British Pound" },
] as const;

export const ORG_DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
] as const;

export const ORG_TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

export function readOrgStringSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const value = settings[key];
  return typeof value === "string" ? value : fallback;
}

export function readOrgBooleanSetting(settings: Record<string, unknown>, key: string): boolean {
  const value = settings[key];
  return value === true || value === "true";
}

export type OrgFormatting = {
  locale: string;
  currency: string;
  dateFormat: string;
  timezone: string;
};

export function resolveOrgFormatting(
  settings: Record<string, unknown> | null | undefined,
): OrgFormatting {
  const source = settings ?? {};
  return {
    locale: readOrgStringSetting(source, "locale", DEFAULT_ORG_LOCALE),
    currency: readOrgStringSetting(source, "currency", DEFAULT_ORG_CURRENCY),
    dateFormat: readOrgStringSetting(source, "dateFormat", DEFAULT_ORG_DATE_FORMAT),
    timezone: readOrgStringSetting(source, "timezone", DEFAULT_ORG_TIMEZONE),
  };
}
