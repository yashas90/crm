import { createDecipheriv, createHash } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const ENCRYPTED_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decryptSecret(value) {
  if (!value || !String(value).startsWith(ENCRYPTED_PREFIX)) return value;
  const keySource = process.env.TOKEN_ENCRYPTION_KEY?.trim() || process.env.AUTH_JWT_SECRET;
  if (!keySource) throw new Error("TOKEN_ENCRYPTION_KEY/AUTH_JWT_SECRET missing");
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
  const appId = process.env.META_APP_ID;
  const pages = await sql`
    select page_id, name, access_token_encrypted
    from facebook_pages
    where is_active and is_selected and access_token_encrypted is not null
    order by name
    limit 3
  `;

  const results = [];
  for (const page of pages) {
    const token = decryptSecret(page.access_token_encrypted);
    const url = `https://graph.facebook.com/v21.0/${page.page_id}/subscribed_apps?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const body = await res.json();
    const apps = Array.isArray(body.data)
      ? body.data.map((a) => ({
          id: a.id,
          fields: a.subscribed_fields,
          isOurApp: String(a.id) === String(appId),
        }))
      : body;
    results.push({ page: page.name, pageId: page.page_id, http: res.status, apps });
  }

  console.log(JSON.stringify({ appId, results }, null, 2));

  const forms = await sql`
    select f.form_id, f.name, f.page_id, p.page_id as meta_page_id, p.name as page_name, p.access_token_encrypted
    from facebook_forms f
    join facebook_pages p on p.id = f.page_id
    where f.is_active and f.is_selected and p.access_token_encrypted is not null
    order by f.updated_at desc nulls last
    limit 5
  `;

  const formLeads = [];
  for (const form of forms) {
    const token = decryptSecret(form.access_token_encrypted);
    const since = Math.floor(Date.now() / 1000) - 3 * 86400;
    const filtering = encodeURIComponent(
      JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
    );
    const leadUrl = `https://graph.facebook.com/v21.0/${form.form_id}/leads?fields=id,created_time,ad_id,form_id&limit=10&filtering=${filtering}&access_token=${encodeURIComponent(token)}`;
    const lr = await fetch(leadUrl);
    const body = await lr.json();
    formLeads.push({
      formId: form.form_id,
      formName: form.name,
      page: form.page_name,
      http: lr.status,
      count: Array.isArray(body.data) ? body.data.length : null,
      error: body.error ?? null,
      sampleIds: Array.isArray(body.data) ? body.data.slice(0, 3).map((l) => l.id) : [],
    });
  }

  console.log(JSON.stringify({ formLeads }, null, 2));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
