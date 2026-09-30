/**
 * Email sender — Resend API (primary) with nodemailer SMTP fallback.
 * Uses Resend REST API when RESEND_API_KEY is set, otherwise falls back to SMTP.
 */

import nodemailer from "nodemailer";
import { logger } from "../core/logger.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: "resend" | "smtp";
}

// ─── Resend API ─────────────────────────────────────────────────────

async function sendViaResend(opts: SendEmailOptions): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SMTP_FROM ?? "weed@edouardautomations.engineering";

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Weed Kerwing Edouard <${from}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      reply_to: opts.replyTo ?? from,
    }),
  });

  const data = (await resp.json()) as { id?: string; message?: string; statusCode?: number };

  if (data.id) {
    logger.info("Email sent via Resend", { to: opts.to, id: data.id }, "mailer");
    return { success: true, messageId: data.id, provider: "resend" };
  }

  throw new Error(data.message ?? `Resend API ${resp.status}`);
}

// ─── SMTP Fallback ──────────────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) throw new Error("SMTP_USER and SMTP_PASS required in .env");

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

async function sendViaSmtp(opts: SendEmailOptions): Promise<SendResult> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new Error("No SMTP_FROM configured");

  const info = await getTransporter().sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    replyTo: opts.replyTo ?? from,
  });

  logger.info("Email sent via SMTP", { to: opts.to, messageId: info.messageId }, "mailer");
  return { success: true, messageId: info.messageId, provider: "smtp" };
}

// ─── Public API ─────────────────────────────────────────────────────

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  try {
    // Try Resend first
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(opts);
    }
    // Fallback to SMTP
    return await sendViaSmtp(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // If Resend fails, try SMTP fallback
    if (process.env.RESEND_API_KEY && process.env.SMTP_USER) {
      logger.warn(`Resend failed, trying SMTP fallback: ${msg}`, {}, "mailer");
      try {
        return await sendViaSmtp(opts);
      } catch (smtpErr) {
        const smtpMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        logger.error("Both Resend and SMTP failed", { resend: msg, smtp: smtpMsg }, "mailer");
        return { success: false, error: `Resend: ${msg} | SMTP: ${smtpMsg}`, provider: "smtp" };
      }
    }

    logger.error("Email send failed", { to: opts.to, error: msg }, "mailer");
    return { success: false, error: msg, provider: process.env.RESEND_API_KEY ? "resend" : "smtp" };
  }
}

export async function verifyConnection(): Promise<boolean> {
  // Test Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (resp.ok || resp.status === 401) {
        // 401 means key is send-only but valid
        logger.info("Resend API key valid", {}, "mailer");
        return true;
      }
    } catch {}
  }

  // Test SMTP
  try {
    await getTransporter().verify();
    logger.info("SMTP connection verified", {}, "mailer");
    return true;
  } catch (err) {
    logger.error("Connection verification failed", { error: String(err) }, "mailer");
    return false;
  }
}
