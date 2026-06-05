export function defaultDateRange(days = 7) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function toApiDateFrom(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function toApiDateTo(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
