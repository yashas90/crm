export function parseVisitStart(visitDate: string, visitTime: string): Date {
  const [year, month, day] = visitDate.split("-").map(Number);
  const [hours, minutes] = visitTime.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
}

export function visitEndDate(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}
