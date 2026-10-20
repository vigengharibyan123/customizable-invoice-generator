import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "./paths";

const port = z.coerce.number().int().min(1).max(65535);

const envSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: port.default(3001),
    DATABASE_PATH: z
      .string()
      .default("./data/invoices.db")
      .transform((value) => (value === ":memory:" ? value : path.resolve(REPO_ROOT, value))),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: port.default(465),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(true),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default("Lumen & Oak Studio <onboarding@resend.dev>"),
    EMAIL_MODE: z.enum(["smtp", "ethereal", "json"]).optional(),
  })
  .refine((env) => env.EMAIL_MODE !== "smtp" || Boolean(env.SMTP_HOST), {
    path: ["SMTP_HOST"],
    message: "EMAIL_MODE=smtp needs SMTP_HOST",
  });

export type Env = z.output<typeof envSchema>;

/** Parses configuration from any env-like record; empty values (`SMTP_PASS=`) count as unset. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const values = Object.fromEntries(
    Object.entries(source)
      .map(([key, value]) => [key, value?.trim()] as const)
      .filter(([, value]) => value !== undefined && value !== ""),
  );
  const result = envSchema.safeParse(values);
  // The message names the invalid keys but never echoes their values (they may be secrets).
  if (!result.success) throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  return result.data;
}

/** Reads `.env` at the repository root (real environment variables win), then parses. */
export function loadEnv(): Env {
  const envFile = path.join(REPO_ROOT, ".env");
  if (process.env.NODE_ENV !== "test" && existsSync(envFile)) process.loadEnvFile(envFile);
  return parseEnv(process.env);
}
