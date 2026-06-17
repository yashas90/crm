export function sanitiseCsvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.length > 0 && /^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = sanitiseCsvCell(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvCell(cell)).join(","));
  }
  return lines.join("\n");
}
