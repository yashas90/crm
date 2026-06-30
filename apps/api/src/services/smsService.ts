import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult = {
  provider: "twilio";
  messageId: string;
  status: string;
};

export function isSmsConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

function normalizeSmsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

/** Send SMS via Twilio REST API. */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!isSmsConfigured()) {
    throw new Error("SMS provider is not configured");
  }

  const to = normalizeSmsPhone(input.to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: env.TWILIO_FROM_NUMBER!,
      Body: input.body.slice(0, 1600),
    }),
  });

  const payload = (await response.json()) as {
    sid?: string;
    status?: string;
    message?: string;
    code?: number;
  };

  if (!response.ok) {
    logger.warn("Twilio SMS failed", {
      status: response.status,
      code: payload.code,
      message: payload.message,
    });
    throw new Error(payload.message ?? "Failed to send SMS");
  }

  return {
    provider: "twilio",
    messageId: payload.sid ?? "",
    status: payload.status ?? "queued",
  };
}
