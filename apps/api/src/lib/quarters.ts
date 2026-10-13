export const QUARTER_CODES = ["JFM", "AMJ", "JAS", "OND"] as const;
export type QuarterCode = (typeof QUARTER_CODES)[number];

const QUARTER_INDEX: Record<QuarterCode, number> = { JFM: 1, AMJ: 2, JAS: 3, OND: 4 };

export type QuarterRef = {
  year: number;
  code: QuarterCode;
  /** Q1-2026 */
  label: string;
  /** JFM 2026 */
  name: string;
};

export function quarterFromDate(value: string | Date | null | undefined): QuarterRef | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  const code: QuarterCode = month < 3 ? "JFM" : month < 6 ? "AMJ" : month < 9 ? "JAS" : "OND";
  return quarterRef(year, code);
}

export function quarterRef(year: number, code: QuarterCode): QuarterRef {
  return {
    year,
    code,
    label: `Q${QUARTER_INDEX[code]}-${year}`,
    name: `${code} ${year}`,
  };
}

export function currentQuarter(now = new Date()): QuarterRef {
  return quarterFromDate(now) ?? quarterRef(now.getUTCFullYear(), "JFM");
}

export function parseQuarterKey(value: string | undefined, now = new Date()): QuarterRef {
  const match = /^(\d{4})-(JFM|AMJ|JAS|OND)$/.exec(value ?? "");
  if (!match) return currentQuarter(now);
  return quarterRef(Number(match[1]), match[2] as QuarterCode);
}

export function quarterKey(quarter: QuarterRef): string {
  return `${quarter.year}-${quarter.code}`;
}

export function dateInQuarter(value: string | null | undefined, quarter: QuarterRef): boolean {
  const found = quarterFromDate(value);
  return found?.year === quarter.year && found.code === quarter.code;
}
