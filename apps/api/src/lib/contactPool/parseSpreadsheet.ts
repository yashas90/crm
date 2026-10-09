import { inflateRawSync } from "node:zlib";
import { MAX_UPLOAD_ROWS, sanitizeText } from "./sanitize.js";

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseContactFile(filename: string, buffer: Buffer): ParsedSheet {
  const name = filename.toLowerCase();
  const matrix = name.endsWith(".xlsx") ? parseXlsx(buffer) : parseCsv(buffer.toString("utf8"));
  if (matrix.length === 0) {
    throw new Error("The file has no rows");
  }
  const headers = (matrix[0] ?? []).map((cell) => sanitizeText(cell, 80).toLowerCase());
  const body = matrix.slice(1).filter((row) => row.some((cell) => sanitizeText(cell, 200)));
  if (body.length > MAX_UPLOAD_ROWS) {
    throw new Error(`Maximum ${MAX_UPLOAD_ROWS} contacts per upload`);
  }
  const rows = body.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = row[index] ?? "";
    });
    return record;
  });
  return { headers, rows };
}

export function headerValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct);
  }
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(
      ([header]) => header.replace(/[\s_-]+/g, "") === key.replace(/[\s_-]+/g, ""),
    );
    if (found?.[1].trim()) return found[1];
  }
  return "";
}

function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseXlsx(buffer: Buffer): string[][] {
  const files = readZip(buffer);
  const sharedXml = files.get("xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml.toString("utf8")) : [];
  const sheetName =
    [...files.keys()].find((name) => name === "xl/worksheets/sheet1.xml") ??
    [...files.keys()].find((name) => /xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error("Excel file has no worksheet");
  const sheet = files.get(sheetName);
  if (!sheet) throw new Error("Excel file has no worksheet");
  return parseSheet(sheet.toString("utf8"), shared);
}

function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid Excel file");
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString("utf8");
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) files.set(name, Buffer.from(comp));
    else if (method === 8) files.set(name, inflateRawSync(comp));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const texts = [...(match[1] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) =>
      decodeXml(part[1] ?? ""),
    );
    out.push(texts.join(""));
  }
  return out;
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const index = ref ? columnIndex(ref) : cells.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const body = cell[2] ?? "";
      let value = "";
      if (type === "s") {
        const pointer = Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
        value = shared[pointer] ?? "";
      } else if (type === "inlineStr") {
        value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((part) => decodeXml(part[1] ?? ""))
          .join("");
      } else {
        value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }
      cells[index] = value;
    }
    rows.push(cells.map((value) => value ?? ""));
  }
  return rows;
}
