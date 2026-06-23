import { parseVisitStartIst } from "@propninja/types/ist";

export function parseVisitStart(visitDate: string, visitTime: string): Date {
  return parseVisitStartIst(visitDate, visitTime);
}

export function visitEndDate(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}
