import PDFDocument from "pdfkit";

export type VisitSummaryPdfInput = {
  visitDate: string;
  visitTime: string;
  durationMinutes: number | null;
  property: string;
  customerName: string;
  customerPhone: string | null;
  leadCode: string | null;
  feedbackSummary: string[];
  outcome: string | null;
  nextStep: string | null;
  agentName: string;
  signature: string | null;
};

function formatWhen(date: string, time: string) {
  return `${date} ${time.slice(0, 5)} IST`;
}

export function buildVisitSummaryPdf(input: VisitSummaryPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("Site visit summary", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(11).font("Helvetica");

    const rows: Array<[string, string]> = [
      ["Date", formatWhen(input.visitDate, input.visitTime)],
      ["Duration", input.durationMinutes != null ? `${input.durationMinutes} min` : "—"],
      ["Property", input.property],
      ["Customer", input.customerName],
      ["Phone", input.customerPhone ?? "—"],
      ["Lead code", input.leadCode ?? "—"],
      ["Outcome", input.outcome ?? "—"],
      ["Next step", input.nextStep ?? "—"],
      ["Agent", input.agentName],
    ];

    for (const [label, value] of rows) {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value);
      doc.moveDown(0.35);
    }

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Feedback");
    doc.moveDown(0.3);
    doc.font("Helvetica");
    if (input.feedbackSummary.length === 0) {
      doc.text("No feedback recorded.");
    } else {
      for (const line of input.feedbackSummary) {
        doc.text(`• ${line}`);
        doc.moveDown(0.15);
      }
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text("Signature");
    doc.moveDown(0.3);
    const signature = input.signature ?? "";
    const image = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(signature);
    if (image?.[2]) {
      try {
        doc.image(Buffer.from(image[2], "base64"), { fit: [220, 90] });
      } catch {
        doc.font("Helvetica").text("Customer signature on file");
      }
    } else if (signature.trim()) {
      doc.font("Helvetica").text("Customer signature on file");
    } else {
      doc.font("Helvetica").text("Not captured");
    }

    doc.end();
  });
}
