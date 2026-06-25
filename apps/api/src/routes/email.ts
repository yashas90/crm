import { emailLogs, leads } from "@propninja/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { sendEmail } from "../services/emailService.js";

export const emailRoutes = new Hono();

const sendEmailSchema = z.object({
  leadId: z.string().uuid().optional(),
  toEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

emailRoutes.post("/send", writeRateLimit, validate("json", sendEmailSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const { leadId, toEmail, subject, body } = c.req.valid("json");

  const result = await sendEmail({ to: toEmail, subject, body });

  await db.insert(emailLogs).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId: leadId ?? null,
    sentBy: authUser.id,
    toEmail,
    subject,
    body,
    status: result.success ? "sent" : "failed",
    error: result.error ?? null,
  });

  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: { code: "EMAIL_SEND_FAILED", message: result.error ?? "Failed to send email" },
      },
      500,
    );
  }

  return c.json({ ok: true, data: { message: "Email sent successfully" } });
});

emailRoutes.get("/lead/:leadId", async (c) => {
  const db = c.get("db");
  const leadId = c.req.param("leadId");

  const logs = await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.leadId, leadId))
    .orderBy(emailLogs.sentAt);

  return c.json({ ok: true, data: logs });
});
