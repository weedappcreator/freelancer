/**
 * LLM Provider Abstraction Layer
 *
 * Supports: Anthropic (Claude), OpenRouter, OpenAI-compatible endpoints.
 * All providers use a unified message interface so agents are provider-agnostic.
 */

import { type Config, type LLMProvider } from "../core/config.js";
import { logger } from "../core/logger.js";

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

      const data = (await resp.json()) as {
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

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
