/**
 * Email sender using nodemailer (Gmail SMTP).
 * Sends approved drafts and updates message status.
 */

import nodemailer from "nodemailer";
import { logger } from "../core/logger.js";

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
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) return { success: false, error: "No SMTP_FROM configured" };

  try {
    const info = await getTransporter().sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo ?? from,
    });

    logger.info("Email sent", { to: opts.to, messageId: info.messageId }, "mailer");
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Email send failed", { to: opts.to, error: msg }, "mailer");
    return { success: false, error: msg };
  }
}

export async function verifyConnection(): Promise<boolean> {
  try {
    await getTransporter().verify();
    logger.info("SMTP connection verified", {}, "mailer");
    return true;
  } catch (err) {
    logger.error("SMTP verification failed", { error: String(err) }, "mailer");
    return false;
  }
}
