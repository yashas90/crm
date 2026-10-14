import PDFDocument from "pdfkit";

export function buildLeaderboardPdf(
  headers: string[],
  rows: string[][],
  periodKey: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold").text("PropNinja Leaderboard");
    doc.moveDown(0.25);
    doc.fontSize(10).font("Helvetica").text(`Period ${periodKey}`);
    doc.moveDown(0.75);

    for (const row of rows) {
      if (doc.y > 520) doc.addPage();
      const lines = headers.map((header, index) => `${header}: ${row[index] ?? ""}`);
      doc.fontSize(9).font("Helvetica").text(lines.join("  |  "), { width: 760 });
      doc.moveDown(0.4);
    }
    if (rows.length === 0) {
      doc.fontSize(11).text("No ranked agents for this period.");
    }
    doc.end();
  });
}
