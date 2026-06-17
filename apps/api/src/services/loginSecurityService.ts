import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { sendHtmlEmail } from "../lib/resendEmail.js";

let cachedAdminEmail: string | null | undefined;

async function getAdminAlertEmail(): Promise<string | null> {
  if (cachedAdminEmail !== undefined) {
    return cachedAdminEmail;
  }

  const db = getDb();
  const [admin] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  cachedAdminEmail = admin?.email ?? null;
  return cachedAdminEmail;
}

export async function sendBruteForceAlertEmail(email: string): Promise<void> {
  const adminEmail = await getAdminAlertEmail();
  if (!adminEmail) return;

  await sendHtmlEmail({
    to: adminEmail,
    subject: "PropNinja security alert: possible brute force",
    html: `<p>Possible brute force on <strong>${email}</strong>.</p><p>More than 10 failed login attempts were recorded in the last 15 minutes.</p>`,
    text: `Possible brute force on ${email}. More than 10 failed login attempts were recorded in the last 15 minutes.`,
  });
}

/** @internal Test helper */
export function resetAdminAlertEmailCacheForTests(): void {
  cachedAdminEmail = undefined;
}
