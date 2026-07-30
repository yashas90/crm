import { createDecipheriv, createHash } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const ENCRYPTED_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decryptSecret(value) {
  if (!value || !String(value).startsWith(ENCRYPTED_PREFIX)) return value;
  const keySource = process.env.TOKEN_ENCRYPTION_KEY?.trim() || process.env.AUTH_JWT_SECRET;
  const key = createHash("sha256").update(keySource).digest();
  const payload = Buffer.from(String(value).slice(ENCRYPTED_PREFIX.length), "base64url");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

try {
  const forms = await sql`
    select f.form_id, f.name as form_name, p.page_id as meta_page_id, p.name as page_name, p.access_token_encrypted
    from facebook_forms f
    join facebook_pages p on p.id = f.page_id
    where f.is_active and f.is_selected and p.access_token_encrypted is not null
  `;

  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const filtering = encodeURIComponent(
    JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
  );

  let total = 0;
  const withLeads = [];
  const errors = [];

  for (const form of forms) {
    const token = decryptSecret(form.access_token_encrypted);
    const url = `https://graph.facebook.com/v21.0/${form.form_id}/leads?fields=id,created_time&limit=50&filtering=${filtering}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const body = await res.json();
    if (body.error) {
      errors.push({ form: form.form_name, page: form.page_name, error: body.error.message });
      continue;
    }
    const n = Array.isArray(body.data) ? body.data.length : 0;
    total += n;
    if (n > 0) {
      withLeads.push({
        form: form.form_name,
        page: form.page_name,
        formId: form.form_id,
        count: n,
        newest: body.data[0]?.created_time,
        oldest: body.data[body.data.length - 1]?.created_time,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        formsChecked: forms.length,
        totalLeadsLast7d: total,
        formsWithLeads: withLeads.sort((a, b) => b.count - a.count).slice(0, 20),
        errors: errors.slice(0, 10),
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end({ timeout: 5 });
}
