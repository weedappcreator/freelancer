/**
 * Operator Context Loader
 * Reads OPERATOR_CONTEXT.md and makes it available to agents.
 */

import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.js";

let cachedContext: string | null = null;

export function loadOperatorContext(projectRoot: string): string {
  if (cachedContext) return cachedContext;

  const candidates = [
    path.join(projectRoot, "docs", "OPERATOR_CONTEXT.md"),
    path.join(projectRoot, "OPERATOR_CONTEXT.md"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cachedContext = fs.readFileSync(p, "utf-8");
      logger.info("Loaded operator context", { path: p, length: cachedContext.length });
      return cachedContext;
    }
  }

  logger.warn("OPERATOR_CONTEXT.md not found — agents will operate with limited context");
  return "OPERATOR_CONTEXT.md not found. Mark operator details as UNKNOWN.";
}

export function getOperatorContext(): string {
  return cachedContext ?? "Operator context not loaded.";
}
