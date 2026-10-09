import { contactPool, dncPhones, uploadBatches, uploadInvalidRows } from "@propninja/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { contactNameFromRow, isMissingContactName } from "../lib/contactPool/contactName.js";
import { headerValue, parseContactFile } from "../lib/contactPool/parseSpreadsheet.js";
import {
  chunkRows,
  normalizeBedrooms,
  normalizePoolPhone,
  normalizePropertyType,
  parseBudget,
  phoneHash,
  sanitizeText,
} from "../lib/contactPool/sanitize.js";
import { scanUploadBuffer } from "../lib/contactPool/virusScan.js";
import { type Database, getDb } from "../lib/db.js";
import { badRequest } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

type PreparedRow = {
  rowNumber: number;
  name: string;
  phone: string;
  phoneHash: string;
  alternatePhone: string | null;
  email: string | null;
  city: string | null;
  locality: string | null;
  budget: string | null;
  budgetLabel: string | null;
  propertyType: string | null;
  bedrooms: string | null;
  source: string | null;
  notes: string | null;
};

export async function acceptContactUpload(input: {
  adminId: string;
  filename: string;
  buffer: Buffer;
  batchName?: string;
}) {
  const scan = scanUploadBuffer(input.filename, input.buffer);
  if (!scan.ok) throw badRequest(scan.reason, undefined, "UPLOAD_REJECTED");

  let parsed: ReturnType<typeof parseContactFile>;
  try {
    parsed = parseContactFile(input.filename, input.buffer);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Could not read the file");
  }

  const db = getDb();
  const batchName = sanitizeText(input.batchName, 120) || sanitizeText(input.filename, 120);
  const [batch] = await db
    .insert(uploadBatches)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      batchName,
      uploadedBy: input.adminId,
      fileName: sanitizeText(input.filename, 200),
      totalRecords: parsed.rows.length,
      status: "processing",
    })
    .returning();

  if (!batch) throw badRequest("Could not start upload");

  void processUpload(batch.batchId, parsed.rows).catch((error) => {
    logger.error("Contact upload failed", {
      batchId: batch.batchId,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    batchId: batch.batchId,
    batchName: batch.batchName,
    fileName: batch.fileName,
    totalRecords: batch.totalRecords,
    status: "processing" as const,
  };
}

async function processUpload(batchId: string, rows: Record<string, string>[]) {
  const db = getDb();
  let valid = 0;
  let duplicates = 0;
  let invalid = 0;
  let processed = 0;
  const seen = new Set<string>();

  try {
    for (const chunk of chunkRows(rows)) {
      const prepared: PreparedRow[] = [];
      const invalidRows: { rowNumber: number; raw: Record<string, unknown>; reason: string }[] = [];

      chunk.forEach((row, index) => {
        const rowNumber = processed + index + 2;
        const phone = normalizePoolPhone(
          headerValue(row, ["phone", "mobile", "phone_number", "phonenumber", "contact"]),
        );
        if (!phone) {
          invalidRows.push({ rowNumber, raw: row, reason: "Invalid phone number" });
          return;
        }
        if (seen.has(phone)) {
          duplicates += 1;
          return;
        }
        seen.add(phone);
        const name = contactNameFromRow(row);
        const budget = parseBudget(headerValue(row, ["budget", "budget_range"]));
        const email = sanitizeText(headerValue(row, ["email", "email_address"]), 160);
        prepared.push({
          rowNumber,
          name,
          phone,
          phoneHash: phoneHash(phone),
          alternatePhone: normalizePoolPhone(
            headerValue(row, ["alternate_phone", "alt_phone", "secondary_phone"]),
          ),
          email: email.includes("@") ? email : null,
          city: sanitizeText(headerValue(row, ["city"]), 80) || null,
          locality: sanitizeText(headerValue(row, ["locality", "area", "location"]), 80) || null,
          budget: budget.amount != null ? String(budget.amount) : null,
          budgetLabel: budget.label,
          propertyType: normalizePropertyType(
            headerValue(row, ["property_type", "property", "type"]),
          ),
          bedrooms: normalizeBedrooms(headerValue(row, ["bedrooms", "bhk", "bedroom"])),
          source: sanitizeText(headerValue(row, ["source", "lead_source"]), 80) || null,
          notes: sanitizeText(headerValue(row, ["notes", "note", "remarks"]), 1000) || null,
        });
      });

      if (prepared.length > 0) {
        const phones = prepared.map((row) => row.phone);
        const [existing, blocked] = await Promise.all([
          db
            .select({ phone: contactPool.phone })
            .from(contactPool)
            .where(
              and(eq(contactPool.orgId, SINGLE_TENANT_ORG_ID), inArray(contactPool.phone, phones)),
            ),
          db
            .select({ phone: dncPhones.phone })
            .from(dncPhones)
            .where(
              and(eq(dncPhones.orgId, SINGLE_TENANT_ORG_ID), inArray(dncPhones.phone, phones)),
            ),
        ]);
        const existingPhones = new Set(existing.map((row) => row.phone));
        const blockedPhones = new Set(blocked.map((row) => row.phone));
        const renamed = prepared.filter(
          (row) => existingPhones.has(row.phone) && !isMissingContactName(row.name),
        );
        if (renamed.length > 0) await fillMissingNames(db, renamed);
        const insertable = prepared.filter((row) => {
          if (blockedPhones.has(row.phone)) {
            invalidRows.push({
              rowNumber: row.rowNumber,
              raw: { phone: row.phone, name: row.name },
              reason: "Phone is on the DNC list",
            });
            return false;
          }
          if (existingPhones.has(row.phone)) {
            duplicates += 1;
            return false;
          }
          return true;
        });

        if (insertable.length > 0) {
          const inserted = await db
            .insert(contactPool)
            .values(
              insertable.map((row) => ({
                orgId: SINGLE_TENANT_ORG_ID,
                uploadBatchId: batchId,
                name: row.name,
                phone: row.phone,
                phoneHash: row.phoneHash,
                alternatePhone: row.alternatePhone,
                email: row.email,
                city: row.city,
                locality: row.locality,
                budget: row.budget,
                budgetLabel: row.budgetLabel,
                propertyType: row.propertyType,
                bedrooms: row.bedrooms,
                source: row.source,
                notes: row.notes,
                status: "unassigned" as const,
                uploadedByAdminId: null,
              })),
            )
            .onConflictDoNothing({ target: [contactPool.orgId, contactPool.phone] })
            .returning({ phone: contactPool.phone });
          const insertedPhones = new Set(inserted.map((row) => row.phone));
          valid += insertedPhones.size;
          duplicates += insertable.length - insertedPhones.size;
        }
      }

      if (invalidRows.length > 0) {
        invalid += invalidRows.length;
        await db.insert(uploadInvalidRows).values(
          invalidRows.map((row) => ({
            batchId,
            rowNumber: row.rowNumber,
            raw: row.raw,
            reason: row.reason,
          })),
        );
      }

      processed += chunk.length;
      await db
        .update(uploadBatches)
        .set({
          processedRecords: processed,
          validRecords: valid,
          duplicateRecords: duplicates,
          invalidRecords: invalid,
        })
        .where(eq(uploadBatches.batchId, batchId));
    }

    const [batch] = await db
      .select({ uploadedBy: uploadBatches.uploadedBy })
      .from(uploadBatches)
      .where(eq(uploadBatches.batchId, batchId))
      .limit(1);

    await db
      .update(uploadBatches)
      .set({
        status: "completed",
        processedRecords: rows.length,
        validRecords: valid,
        duplicateRecords: duplicates,
        invalidRecords: invalid,
      })
      .where(eq(uploadBatches.batchId, batchId));

    if (batch?.uploadedBy) {
      await db
        .update(contactPool)
        .set({ uploadedByAdminId: batch.uploadedBy })
        .where(eq(contactPool.uploadBatchId, batchId));
    }
  } catch (error) {
    await db
      .update(uploadBatches)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Upload failed",
        processedRecords: processed,
        validRecords: valid,
        duplicateRecords: duplicates,
        invalidRecords: invalid,
      })
      .where(eq(uploadBatches.batchId, batchId));
    throw error;
  }
}

/** Re-uploads keep the phone, so a later file can fill a name that was stored as Unknown. */
function textArray(values: string[]) {
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;
}

async function fillMissingNames(db: Database, rows: PreparedRow[]) {
  for (const chunk of chunkRows(rows, 200)) {
    const phoneList = chunk.map((row) => row.phone);
    const nameList = chunk.map((row) => row.name);
    await db.execute(sql`
      UPDATE contact_pool AS p
      SET name = v.name
      FROM unnest(${textArray(phoneList)}, ${textArray(nameList)}) AS v(phone, name)
      WHERE p.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND p.phone = v.phone
        AND (p.name = 'Unknown' OR btrim(p.name) = '')
    `);
    await db.execute(sql`
      UPDATE agent_calling_data AS ac
      SET name = v.name
      FROM unnest(${textArray(phoneList)}, ${textArray(nameList)}) AS v(phone, name)
      WHERE ac.org_id = ${SINGLE_TENANT_ORG_ID}::uuid
        AND ac.phone = v.phone
        AND (ac.name = 'Unknown' OR btrim(ac.name) = '')
    `);
  }
}
