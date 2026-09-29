/**
 * Structured logger for Freelance Revenue OS.
 * All agent actions, API calls, and state transitions are logged.
 */

import fs from "node:fs";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  agent?: string;
  correlationId?: string;
}

class Logger {
  private minLevel: LogLevel = "info";
  private logDir: string | null = null;

  setLevel(level: LogLevel) {
    this.minLevel = level;
  }

  setLogDir(dir: string) {
    this.logDir = dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private emit(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return;

    // Console output (human-readable)
    const color = LEVEL_COLORS[entry.level];
    const prefix = `${color}[${entry.level.toUpperCase().padEnd(5)}]${RESET}`;
    const time = entry.timestamp.split("T")[1]?.slice(0, 8) ?? "";
    const agent = entry.agent ? ` [${entry.agent}]` : "";
    let line = `${prefix} ${time}${agent} ${entry.message}`;
    if (entry.data && Object.keys(entry.data).length > 0) {
      line += ` ${JSON.stringify(entry.data)}`;
    }
    if (entry.level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }

    // File output (structured JSON)
    if (this.logDir) {
      const date = entry.timestamp.split("T")[0];
      const filePath = path.join(this.logDir, `${date}.jsonl`);
      fs.appendFileSync(filePath, JSON.stringify(entry) + "\n");
    }
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>, agent?: string) {
    this.emit({
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? this.redactSecrets(data) : undefined,
      agent,
    });
  }

  debug(msg: string, data?: Record<string, unknown>, agent?: string) {
    this.log("debug", msg, data, agent);
  }
  info(msg: string, data?: Record<string, unknown>, agent?: string) {
    this.log("info", msg, data, agent);
  }
  warn(msg: string, data?: Record<string, unknown>, agent?: string) {
    this.log("warn", msg, data, agent);
  }
  error(msg: string, data?: Record<string, unknown>, agent?: string) {
    this.log("error", msg, data, agent);
  }

  /** Redact keys that look like secrets */
  private redactSecrets(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (/key|token|secret|password|pass|auth/i.test(key) && typeof value === "string") {
        redacted[key] = value.slice(0, 4) + "****";
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }
}

export const logger = new Logger();
