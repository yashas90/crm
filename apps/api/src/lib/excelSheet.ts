function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** SpreadsheetML workbook Excel opens directly. Money cells are preformatted INR text. */
export function excelWorkbook(sheetName: string, headers: string[], rows: string[][]) {
  const headerCells = headers
    .map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${escapeXml(sheetName)}">
<Table>
<Row>${headerCells}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`;
}
