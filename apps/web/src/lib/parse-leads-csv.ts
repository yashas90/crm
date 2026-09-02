import { normalizeLeadSourceValue } from "@/lib/lead-sources";
import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@propninja/types/enums";

export type BulkLeadImportRow = {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  leadSource?: string;
  leadStatus?: string;
  temperature?: string;
  notes?: string;
  tags?: string[];
  projectName?: string;
  projectId?: string;
};

export type ParseLeadsCsvResult = {
  rows: BulkLeadImportRow[];
  parseErrors: { row: number; message: string }[];
};

export const LEADS_CSV_TEMPLATE = `firstName,lastName,phone,email,city,state,leadSource,temperature,notes,tags
John,Doe,9876543210,john@example.com,Mumbai,MH,Website,warm,Interested in 2BHK,"priority,follow-up"
Jane,Smith,+919876543211,,Delhi,DL,Referral,hot,,`;

const HEADER_ALIASES: Record<string, string> = {
  firstname: "firstName",
  first_name: "firstName",
  "first name": "firstName",
  fname: "firstName",
  lastname: "lastName",
  last_name: "lastName",
  "last name": "lastName",
  lname: "lastName",
  name: "name",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  phonenumber: "phone",
  contact: "phone",
  email: "email",
  "e-mail": "email",
  city: "city",
  state: "state",
  source: "leadSource",
  leadsource: "leadSource",
  "lead source": "leadSource",
  status: "leadStatus",
  leadstatus: "leadStatus",
  "lead status": "leadStatus",
  temperature: "temperature",
  temp: "temperature",
  notes: "notes",
  note: "notes",
  tags: "tags",
  tag: "tags",
  project: "projectName",
  projectname: "projectName",
  "project name": "projectName",
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function parseTags(value: unknown): string[] | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const tags = text
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function parseLeadStatus(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return undefined;
  return (LEAD_STATUSES as readonly string[]).includes(text) ? text : undefined;
}

function parseTemperature(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return undefined;
  return (LEAD_TEMPERATURES as readonly string[]).includes(text) ? text : undefined;
}

/** Minimal RFC-style CSV parser (quoted fields, commas). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      if (char === "\r") i++;
      continue;
    }

    if (char === "\r") {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function mapRecord(headers: string[], values: string[]) {
  const record: Record<string, string> = {};
  for (let index = 0; index < headers.length; index++) {
    const key =
      HEADER_ALIASES[normalizeHeader(headers[index] ?? "")] ??
      normalizeHeader(headers[index] ?? "");
    if (!key || record[key]) continue;
    record[key] = (values[index] ?? "").trim();
  }
  return record;
}

function recoverExcelPhone(raw: string): string {
  const trimmed = raw.replace(/\s+/g, "");
  if (/^\d+\.0+$/.test(trimmed)) {
    return trimmed.replace(/\.0+$/, "");
  }

  const sci = trimmed.match(/^(\d+(?:\.\d+)?)[eE]\+(\d+)$/);
  if (!sci) return trimmed;

  const coefficient = sci[1] ?? "";
  const exponent = Number(sci[2]);
  const significant = coefficient.replace(".", "");
  if (significant.length < 10 || !Number.isFinite(exponent) || exponent > 15) {
    return trimmed;
  }

  const decimalPlaces = coefficient.includes(".") ? (coefficient.split(".")[1]?.length ?? 0) : 0;
  const zeros = exponent - decimalPlaces;
  if (zeros < 0) return trimmed;
  return `${significant}${"0".repeat(zeros)}`;
}

function recordToLeadRow(record: Record<string, string>): BulkLeadImportRow | null {
  let firstName = record.firstName;
  let lastName: string | undefined = record.lastName;

  if (!firstName && record.name) {
    const parts = record.name.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ") || undefined;
  }

  const phone = recoverExcelPhone(record.phone ?? "");
  if (!firstName || !phone) return null;

  const leadSource = record.leadSource
    ? normalizeLeadSourceValue(record.leadSource) || undefined
    : undefined;

  return {
    firstName,
    lastName: lastName || undefined,
    phone,
    email: optionalString(record.email),
    city: optionalString(record.city),
    state: optionalString(record.state),
    leadSource,
    leadStatus: parseLeadStatus(record.leadStatus),
    temperature: parseTemperature(record.temperature),
    notes: optionalString(record.notes),
    tags: parseTags(record.tags),
    projectName: optionalString(record.projectName),
  };
}

export function parseLeadsCsv(text: string): ParseLeadsCsvResult {
  const grid = parseCsvText(text.replace(/^\uFEFF/, ""));
  if (grid.length === 0) {
    return { rows: [], parseErrors: [{ row: 1, message: "CSV file is empty" }] };
  }

  const [headerRow, ...dataRows] = grid;
  const rows: BulkLeadImportRow[] = [];
  const parseErrors: ParseLeadsCsvResult["parseErrors"] = [];

  for (let index = 0; index < dataRows.length; index++) {
    const rowNumber = index + 2;
    const record = mapRecord(headerRow ?? [], dataRows[index] ?? []);
    const lead = recordToLeadRow(record);

    if (!lead) {
      parseErrors.push({
        row: rowNumber,
        message: "Missing required firstName and phone columns",
      });
      continue;
    }

    if (lead.phone.length < 5) {
      parseErrors.push({
        row: rowNumber,
        message: "Phone number must be at least 5 characters",
      });
      continue;
    }

    rows.push(lead);
  }

  return { rows, parseErrors };
}

export function downloadLeadsCsvTemplate() {
  const blob = new Blob([LEADS_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "leads-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
