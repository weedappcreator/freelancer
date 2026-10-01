/**
 * LLM Provider Abstraction Layer
 *
 * Supports: Anthropic (Claude), OpenRouter, OpenAI-compatible endpoints.
 * All providers use a unified message interface so agents are provider-agnostic.
 */

import { type Config, type LLMProvider } from "../core/config.js";
import { logger } from "../core/logger.js";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";

// ─── Unified Message Types ──────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  stop?: string[];
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  latencyMs: number;
}

// ─── Provider Interface ─────────────────────────────────────────────

export interface LLMProviderAdapter {
  name: LLMProvider;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  isConfigured(): boolean;
}

// ─── Anthropic Provider ─────────────────────────────────────────────

function createAnthropicProvider(config: Config): LLMProviderAdapter {
  return {
    name: "anthropic",
    isConfigured: () => !!config.anthropicApiKey,
    async complete(req) {
      const start = Date.now();
      const model = req.model ?? config.anthropicModel;

      // Separate system message from conversation
      const systemMsg = req.messages.find((m) => m.role === "system");
      const conversationMsgs = req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 4096,
        messages: conversationMsgs,
      };
      if (systemMsg) body.system = systemMsg.content;
      if (req.temperature !== undefined) body.temperature = req.temperature;
      if (req.stop) body.stop_sequences = req.stop;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.anthropicApiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Anthropic API error ${resp.status}: ${err}`);
      }

      const data = (await resp.json()) as {
        content: Array<{ type: string; text: string }>;
        model: string;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string;
      };

      return {
        content: data.content.map((c) => c.text).join(""),
        model: data.model,
        provider: "anthropic",
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        finishReason: data.stop_reason,
        latencyMs: Date.now() - start,
      };
    },
  };
}

// ─── OpenAI-Compatible Provider (OpenRouter, OpenAI, local, etc.) ───

function createOpenAICompatibleProvider(
  config: Config,
  providerName: "openrouter" | "openai"
): LLMProviderAdapter {
  const isOpenRouter = providerName === "openrouter";
  const apiKey = isOpenRouter ? config.openrouterApiKey : config.openaiApiKey;
  const baseUrl = isOpenRouter ? config.openrouterBaseUrl : config.openaiBaseUrl;
  const defaultModel = isOpenRouter ? config.openrouterModel : config.openaiModel;

  return {
    name: providerName,
    isConfigured: () => !!apiKey,
    async complete(req) {
      const start = Date.now();
      const model = req.model ?? defaultModel;

      const messages = req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: req.maxTokens ?? 4096,
      };
      if (req.temperature !== undefined) body.temperature = req.temperature;
      if (req.stop) body.stop = req.stop;
      if (req.jsonMode) body.response_format = { type: "json_object" };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      if (isOpenRouter) {
        headers["HTTP-Referer"] = "https://freelance-revenue-os.local";
        headers["X-Title"] = "Freelance Revenue OS";
      }

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`${providerName} API error ${resp.status}: ${err}`);
      }

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      if (!data.choices || !data.choices[0]) {
        throw new Error(
          `${providerName} API returned no choices (model: ${model}, HTTP ${resp.status}): ${raw.slice(0, 500)}`
        );
      }

      if (typeof data.choices[0].message?.content !== "string") {
        throw new Error(
          `${providerName} API returned null content (model: ${model}, HTTP ${resp.status}): ${raw.slice(0, 500)}`
        );
      }

      const choice = data.choices[0];
      return {
        content: choice.message.content,
        model: data.model,
        provider: providerName,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: choice.finish_reason,
        latencyMs: Date.now() - start,
      };
    },
  };
}

// ─── Ollama Provider (local models) ─────────────────────────────────

function createOllamaProvider(config: Config): LLMProviderAdapter {
  return {
    name: "ollama",
    isConfigured: () => true, // Ollama is local, always "available" if running
    async complete(req) {
      const start = Date.now();
      const model = req.model ?? config.ollamaModel;
      const baseUrl = config.ollamaBaseUrl;

      const messages = req.messages.map((m) => ({ role: m.role, content: m.content }));
      const body: Record<string, unknown> = {
        model,
        messages,
        stream: false,
      };
      if (req.temperature !== undefined) body.temperature = req.temperature;

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Ollama API error ${resp.status}: ${err}`);
      }

      const data = (await resp.json()) as {
        choices: Array<{ message: { content: string }; finish_reason: string }>;
        model: string;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const choice = data.choices[0];
      return {
        content: choice.message.content,
        model: data.model,
        provider: "ollama" as LLMProvider,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: choice.finish_reason,
        latencyMs: Date.now() - start,
      };
    },
  };
}

// ─── opencode CLI Provider (free models, zero cost) ───────────────────

const OPENCODE_FALLBACK_PATH = "/Users/macbookpro/.opencode/bin/opencode";
const OPENCODE_JSON_INSTRUCTION = "Reply with ONLY valid JSON, no other text, no tool calls.";

function resolveOpencodeBinary(): string | null {
  try {
    const found = execSync("which opencode", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
      .split("\n")[0]
      ?.trim();
    if (found && fs.existsSync(found)) return found;
  } catch {
    // not on PATH — fall through to absolute path
  }
  if (fs.existsSync(OPENCODE_FALLBACK_PATH)) return OPENCODE_FALLBACK_PATH;
  return null;
}

function createOpencodeCliProvider(config: Config): LLMProviderAdapter {
  return {
    name: "opencode",
    isConfigured: () => resolveOpencodeBinary() !== null,
    async complete(req) {
      const start = Date.now();
      const binary = resolveOpencodeBinary();
      if (!binary) {
        throw new Error(
          `opencode CLI binary not found. Install opencode or ensure 'opencode' is on PATH (looked for 'opencode' on PATH and ${OPENCODE_FALLBACK_PATH}).`
        );
      }
      const model = req.model ?? config.opencodeModel;

      // `opencode run` takes a single message — join as ROLE lines.
      let prompt = req.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
      if (req.jsonMode) {
        const systems = req.messages
          .filter((m) => m.role === "system")
          .map((m) => m.content)
          .join("\n");
        prompt =
          (systems ? systems + "\n\n" : "") + prompt + "\n\n" + OPENCODE_JSON_INSTRUCTION;
      }

      let stdout: string;
      try {
        // NOTE: uses spawn (not execFile) with stdin ignored. execFile holds
        // the child's stdin pipe open, and `opencode run` blocks waiting for
        // stdin EOF in that case — the call would hang until timeout.
        // stdio ['ignore', 'pipe', 'pipe'] gives it /dev/null (immediate EOF).
        stdout = await new Promise<string>((resolve, reject) => {
          const child = spawn(
            binary,
            ["run", prompt, "-m", model, "--format", "json", "--dir", "/tmp"],
            { stdio: ["ignore", "pipe", "pipe"] }
          );
          let out = "";
          let err = "";
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`opencode CLI call timed out after 300s (model: ${model})`));
          }, 300_000);
          timer.unref?.();
          child.stdout.on("data", (d: Buffer) => {
            out += d.toString();
            if (out.length > 16 * 1024 * 1024) {
              clearTimeout(timer);
              child.kill("SIGKILL");
              reject(new Error("opencode CLI output exceeded 16MB"));
            }
          });
          child.stderr.on("data", (d: Buffer) => {
            err += d.toString();
          });
          child.on("error", (e: Error) => {
            clearTimeout(timer);
            reject(new Error(`opencode CLI call failed: ${e.message}`));
          });
          child.on("close", (code: number | null, signal: string | null) => {
            clearTimeout(timer);
            if (code === 0) {
              resolve(out);
            } else {
              reject(
                new Error(
                  `opencode CLI call failed (code ${code ?? signal}): ${(err || out).slice(0, 2000)}`
                )
              );
            }
          });
        });
      } catch (err: unknown) {
        throw err instanceof Error ? err : new Error(`opencode CLI call failed: ${String(err)}`);
      }

      // stdout is JSON-lines: text parts, step_finish usage, error events.
      let content = "";
      let inputTokens = 0;
      let outputTokens = 0;
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          continue; // ignore non-JSON lines
        }
        const type = event.type as string | undefined;
        if (type === "text") {
          const part = event.part as { text?: unknown } | undefined;
          if (typeof part?.text === "string") content += part.text;
        } else if (type === "step_finish") {
          const part = event.part as { tokens?: Record<string, unknown> } | undefined;
          const tokens = part?.tokens ?? {};
          const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
          inputTokens += toNum(tokens.input);
          outputTokens += toNum(tokens.output);
        } else if (type === "error") {
          const errInfo = event.error as { message?: unknown } | undefined;
          throw new Error(
            `opencode CLI error: ${typeof errInfo?.message === "string" ? errInfo.message : JSON.stringify(event.error ?? event)}`
          );
        }
      }

      return {
        content,
        model,
        provider: "opencode" as LLMProvider,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        finishReason: "stop",
        latencyMs: Date.now() - start,
      };
    },
  };
}

// ─── Provider Registry ──────────────────────────────────────────────

export class LLMRegistry {
  private providers = new Map<LLMProvider, LLMProviderAdapter>();
  private defaultProvider: LLMProvider;

  constructor(private config: Config) {
    this.defaultProvider = config.llmProvider;
    this.register(createAnthropicProvider(config));
    this.register(createOpenAICompatibleProvider(config, "openrouter"));
    this.register(createOpenAICompatibleProvider(config, "openai"));
    this.register(createOllamaProvider(config));
    this.register(createOpencodeCliProvider(config));
  }

  private register(provider: LLMProviderAdapter) {
    this.providers.set(provider.name, provider);
  }

  /** Add a custom OpenAI-compatible provider at runtime */
  addCustomProvider(name: string, baseUrl: string, apiKey: string, defaultModel: string) {
    const adapter: LLMProviderAdapter = {
      name: "openai", // uses openai-compatible protocol
      isConfigured: () => true,
      async complete(req) {
        const start = Date.now();
        const model = req.model ?? defaultModel;
        const messages = req.messages.map((m) => ({ role: m.role, content: m.content }));
        const body: Record<string, unknown> = { model, messages, max_tokens: req.maxTokens ?? 4096 };
        if (req.temperature !== undefined) body.temperature = req.temperature;

        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`${name} error ${resp.status}: ${await resp.text()}`);
        const data = (await resp.json()) as {
          choices: Array<{ message: { content: string }; finish_reason: string }>;
          model: string;
          usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };
        const choice = data.choices[0];
        return {
          content: choice.message.content,
          model: data.model,
          provider: "openai" as LLMProvider,
          usage: {
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
          finishReason: choice.finish_reason,
          latencyMs: Date.now() - start,
        };
      },
    };
    this.providers.set(name as LLMProvider, adapter);
  }

  get(provider?: LLMProvider): LLMProviderAdapter {
    const name = provider ?? this.defaultProvider;
    const p = this.providers.get(name);
    if (!p) throw new Error(`Unknown LLM provider: ${name}`);
    if (!p.isConfigured()) {
      throw new Error(`LLM provider '${name}' is not configured. Set the API key in .env`);
    }
    return p;
  }

  async complete(req: LLMCompletionRequest, provider?: LLMProvider): Promise<LLMCompletionResponse> {
    const p = this.get(provider);
    logger.debug(`LLM request to ${p.name}`, { model: req.model, msgCount: req.messages.length });
    const resp = await p.complete(req);
    logger.debug(`LLM response from ${p.name}`, {
      model: resp.model,
      tokens: resp.usage.totalTokens,
      latencyMs: resp.latencyMs,
    });
    return resp;
  }

  listConfigured(): LLMProvider[] {
    return [...this.providers.entries()]
      .filter(([, p]) => p.isConfigured())
      .map(([name]) => name);
  }
}
