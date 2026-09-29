import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

dotenv.config();

export const LLMProviderSchema = z.enum(["anthropic", "openrouter", "openai", "ollama"]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

export const ApprovalLevelSchema = z.coerce.number().int().min(0).max(4).default(1);

export const ConfigSchema = z.object({
  // LLM
  llmProvider: LLMProviderSchema.default("anthropic"),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().default("claude-sonnet-4-20250514"),
  openrouterApiKey: z.string().optional(),
  openrouterModel: z.string().default("anthropic/claude-sonnet-4-20250514"),
  openrouterBaseUrl: z.string().default("https://openrouter.ai/api/v1"),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().default("https://api.openai.com/v1"),
  openaiModel: z.string().default("gpt-4o"),

  // Ollama (local)
  ollamaBaseUrl: z.string().default("http://127.0.0.1:11434/v1"),
  ollamaModel: z.string().default("qwen3.5"),

  // CRM
  hubspotAccessToken: z.string().optional(),
  hubspotPortalId: z.string().optional(),

  // Email
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().default(587),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),

  // Dashboard
  dashboardPort: z.coerce.number().default(3000),
  dashboardSecret: z.string().optional(),

  // System
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  dbPath: z.string().default("./data/freelance-revenue-os.db"),
  approvalLevel: ApprovalLevelSchema,
  projectRoot: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function loadConfig(): Config {
  const root = findProjectRoot();
  return ConfigSchema.parse({
    llmProvider: process.env.LLM_PROVIDER,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL,
    openrouterBaseUrl: process.env.OPENROUTER_BASE_URL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    ollamaModel: process.env.OLLAMA_MODEL,
    hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    hubspotPortalId: process.env.HUBSPOT_PORTAL_ID,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM,
    dashboardPort: process.env.DASHBOARD_PORT,
    dashboardSecret: process.env.DASHBOARD_SECRET,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    dbPath: process.env.DB_PATH,
    approvalLevel: process.env.APPROVAL_LEVEL,
    projectRoot: root,
  });
}
