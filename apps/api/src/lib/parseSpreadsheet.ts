import { inflateRawSync } from "node:zlib";
import { parseDelimitedTable } from "@propninja/types/whatsapp-blaster";

const LOCAL_FILE_SIG = 0x04034b50;

function readU16(buf: Buffer, offset: number) {
  return buf.readUInt16LE(offset);
}

function readU32(buf: Buffer, offset: number) {
  return buf.readUInt32LE(offset);
}

function extractZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 30 < buffer.length) {
    if (readU32(buffer, offset) !== LOCAL_FILE_SIG) {
      offset += 1;
      continue;
    }
    const method = readU16(buffer, offset + 8);
    const compressedSize = readU32(buffer, offset + 18);
    const nameLen = readU16(buffer, offset + 26);
    const extraLen = readU16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      data = inflateRawSync(compressed);
    } else {
      offset = dataStart + compressedSize;
      continue;
    }
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }

  return entries;
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siBlocks = xml.split(/<si[>\s]/).slice(1);
  for (const block of siBlocks) {
    const texts = [...block.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) =>
      decodeXmlEntities(m[1] ?? ""),
    );
    strings.push(texts.join(""));
  }
  return strings;
}

function columnIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) {
    n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  }
  return n - 1;
}

function parseSheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowBlocks = xml.split(/<row[\s>]/).slice(1);
  for (const block of rowBlocks) {
    const cells: string[] = [];
    const cellRe = /<c([^>]*)>([\s\S]*?)<\/c>/g;
    let match: RegExpExecArray | null = cellRe.exec(block);
    while (match) {
      const attrs = match[1] ?? "";
      const inner = match[2] ?? "";
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/t="([^"]+)"/)?.[1];
      const value = inner.match(/<v[^>]*>([^<]*)<\/v>/)?.[1] ?? "";
      let text = value;
      if (type === "s") {
        const idx = Number(value);
        text = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
      } else if (type === "inlineStr") {
        text = inner.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? "";
      }
      const col = ref ? columnIndex(ref) : cells.length;
      while (cells.length < col) cells.push("");
      cells[col] = decodeXmlEntities(text).trim();
      match = cellRe.exec(block);
    }
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  filename = "upload.csv",
): { headers: string[]; rows: string[][] } {
  const lower = filename.toLowerCase();
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (isZip || lower.endsWith(".xlsx")) {
    const entries = extractZipEntries(buffer);
    const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
    const sheetXml =
      entries.get("xl/worksheets/sheet1.xml")?.toString("utf8") ??
      [...entries.entries()]
        .find(([name]) => name.startsWith("xl/worksheets/sheet"))?.[1]
        ?.toString("utf8") ??
      "";
    if (!sheetXml) {
      throw new Error("Could not read Excel worksheet");
    }
    const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
    const table = parseSheetRows(sheetXml, shared);
    const headers = table[0] ?? [];
    return { headers, rows: table.slice(1) };
  }

  return parseDelimitedTable(buffer.toString("utf8"));
}
