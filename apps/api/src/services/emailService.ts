import nodemailer from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      success: false,
      error: "Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM in environment.",
    };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      html: input.body.replace(/\n/g, "<br>"),
      text: input.body,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
