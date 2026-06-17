import { badRequest } from "./errors.js";

const UNIT_NUMBER_PATTERN = /^(.+?)(\d+)$/;

function parseUnitNumber(value: string) {
  const match = value.trim().match(UNIT_NUMBER_PATTERN);
  if (!match) {
    throw badRequest(`Invalid unit number format: ${value}`, undefined, "INVALID_UNIT_NUMBER");
  }
  return { prefix: match[1]!, num: Number.parseInt(match[2]!, 10), pad: match[2]!.length };
}

/** Expand a unit number range such as A-101 … A-115 into individual unit numbers. */
export function expandUnitNumberRange(from: string, to: string): string[] {
  const start = parseUnitNumber(from);
  const end = parseUnitNumber(to);

  if (start.prefix !== end.prefix) {
    throw badRequest("Unit number prefixes must match", undefined, "INVALID_UNIT_RANGE");
  }

  if (start.num > end.num) {
    throw badRequest(
      "Start unit number must be <= end unit number",
      undefined,
      "INVALID_UNIT_RANGE",
    );
  }

  const padLen = Math.max(start.pad, end.pad);
  const result: string[] = [];

  for (let n = start.num; n <= end.num; n += 1) {
    result.push(`${start.prefix}${String(n).padStart(padLen, "0")}`);
  }

  if (result.length > 500) {
    throw badRequest("Cannot add more than 500 units at once", undefined, "UNIT_RANGE_TOO_LARGE");
  }

  return result;
}
