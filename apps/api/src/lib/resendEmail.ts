import { env } from "./env.js";
import { logger } from "./logger.js";

type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

export function buildPasswordResetUrl(token: string): string {
  const base = env.WEB_APP_URL.replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void> {
  await sendHtmlEmail({
    to: input.to,
    subject: "Reset your PropNinja password",
    html: `
        <p>You requested a password reset for your PropNinja CRM account.</p>
        <p><a href="${input.resetUrl}">Reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      `,
    text: `Reset your PropNinja password: ${input.resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

type SendHtmlEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendHtmlEmail(input: SendHtmlEmailInput): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    logger.info("Email skipped (Resend not configured)", {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("Failed to send email", {
      status: response.status,
      body,
      to: input.to,
      subject: input.subject,
    });
    throw new Error("Failed to send email");
  }
}
