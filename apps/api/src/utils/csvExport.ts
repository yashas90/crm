import { escapeCsvCell } from "../lib/csv.js";

export type CsvCell = string | number | boolean | null | undefined;

const encoder = new TextEncoder();

export function csvRow(values: CsvCell[]) {
  return values.map((cell) => escapeCsvCell(cell)).join(",");
}

export function stringToCsvStream(csv: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(csv));
      controller.close();
    },
  });
}

export function asyncLinesToCsvStream(lines: AsyncIterable<string>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const line of lines) {
          controller.enqueue(encoder.encode(`${line}\n`));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
