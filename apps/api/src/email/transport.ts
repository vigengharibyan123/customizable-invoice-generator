import {
  createTestAccount,
  createTransport,
  getTestMessageUrl,
  type Transporter,
} from "nodemailer";
import type { Env } from "../env";

/**
 * - smtp: real delivery through SMTP_HOST (e.g. Resend)
 * - ethereal: a throwaway Ethereal inbox; nothing is delivered, each send returns a preview URL
 * - json: the message is only rendered, never sent (tests)
 */
export type EmailMode = "smtp" | "ethereal" | "json";

export interface EmailMessage {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

export interface Mailer {
  mode: EmailMode;
  /** One-line, secret-free summary for the startup log. */
  description: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export function resolveEmailMode(env: Env): EmailMode {
  if (env.EMAIL_MODE) return env.EMAIL_MODE;
  if (env.NODE_ENV === "test") return "json";
  if (env.SMTP_HOST && env.SMTP_PASS) return "smtp";
  return "ethereal";
}

// Fail fast instead of keeping the HTTP request waiting for minutes on an unreachable server.
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 };

function createSmtpTransport(env: Env): Transporter {
  return createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_PASS ? { user: env.SMTP_USER ?? "", pass: env.SMTP_PASS } : undefined,
    ...TIMEOUTS,
  });
}

async function createEtherealTransport(): Promise<Transporter> {
  const account = await createTestAccount().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't create an Ethereal test inbox (${reason}). Are you online?`, {
      cause: error,
    });
  });
  return createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
    ...TIMEOUTS,
  });
}

/** Returns a function that resolves the transport, creating the Ethereal account only once. */
function transportProvider(mode: EmailMode, env: Env): () => Promise<Transporter> {
  if (mode === "json") {
    const transport = createTransport({ jsonTransport: true });
    return async () => transport;
  }
  if (mode === "smtp") {
    const transport = createSmtpTransport(env);
    return async () => transport;
  }
  let pending: Promise<Transporter> | null = null;
  return () => {
    pending ??= createEtherealTransport().catch((error: unknown) => {
      pending = null; // let the next send retry
      throw error;
    });
    return pending;
  };
}

function describeMode(mode: EmailMode, env: Env): string {
  switch (mode) {
    case "smtp":
      return `smtp (${env.SMTP_HOST}:${env.SMTP_PORT}, from ${env.EMAIL_FROM})`;
    case "ethereal":
      return "ethereal (test inbox: nothing is delivered, each send returns a preview link)";
    case "json":
      return "json (emails are rendered but not sent)";
  }
}

export function createMailer(env: Env): Mailer {
  const mode = resolveEmailMode(env);
  const getTransport = transportProvider(mode, env);

  return {
    mode,
    description: describeMode(mode, env),
    async send(message) {
      const transport = await getTransport();
      const info = await transport.sendMail(message);
      const previewUrl = mode === "ethereal" ? getTestMessageUrl(info) || null : null;
      return { messageId: info.messageId, previewUrl };
    },
  };
}
