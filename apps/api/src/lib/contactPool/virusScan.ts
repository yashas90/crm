const MAX_BYTES = 15 * 1024 * 1024;
const EICAR_MARKER = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

export type ScanResult = { ok: true } | { ok: false; reason: string };

/** Reject executables, scripts, macros, and the EICAR test signature before parsing. */
export function scanUploadBuffer(filename: string, buffer: Buffer): ScanResult {
  const name = filename.trim().toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
    return { ok: false, reason: "Only CSV and Excel (.xlsx) files are allowed" };
  }
  if (buffer.length === 0) return { ok: false, reason: "Empty file" };
  if (buffer.length > MAX_BYTES) return { ok: false, reason: "File exceeds 15MB" };

  const head = buffer.subarray(0, 4).toString("latin1");
  if (head.startsWith("MZ") || head.startsWith("\u007fELF")) {
    return { ok: false, reason: "Executable content rejected" };
  }
  if (buffer.subarray(0, 2).toString("utf8") === "#!") {
    return { ok: false, reason: "Script content rejected" };
  }

  const sample = buffer.toString("latin1");
  if (sample.includes(EICAR_MARKER)) {
    return { ok: false, reason: "Malware signature detected" };
  }

  if (name.endsWith(".xlsx")) {
    if (!head.startsWith("PK")) return { ok: false, reason: "Invalid Excel file" };
    if (sample.toLowerCase().includes("vbaproject.bin")) {
      return { ok: false, reason: "Macros are not allowed" };
    }
  }

  if (name.endsWith(".csv") && buffer.includes(0)) {
    return { ok: false, reason: "Binary content rejected" };
  }

  return { ok: true };
}
