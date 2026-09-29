/**
 * Base Agent Framework
 * All agents extend this — provider-agnostic, observable, auditable.
 */

import { v4 as uuid } from "uuid";
import { type LLMRegistry, type LLMCompletionRequest, type LLMMessage } from "../providers/llm.js";
import { events } from "../events/emitter.js";
import { logger } from "../core/logger.js";
import { type LLMProvider } from "../core/config.js";

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  runId: string;
  agent: string;
  durationMs: number;
  tokensUsed: number;
}

export interface AgentOptions {
  name: string;
  description: string;
  systemPrompt: string;
  llm: LLMRegistry;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  approvalRequired?: boolean;
}

export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  public name: string;
  public description: string;
  public systemPrompt: string;
  public llm: LLMRegistry;
  public provider?: LLMProvider;
  public model?: string;
  public temperature: number;
  public maxTokens: number;
  public approvalRequired: boolean;

  constructor(opts: AgentOptions) {
    this.name = opts.name;
    this.description = opts.description;
    this.systemPrompt = opts.systemPrompt;
    this.llm = opts.llm;
    this.provider = opts.provider;
    this.model = opts.model;
    this.temperature = opts.temperature ?? 0.3;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.approvalRequired = opts.approvalRequired ?? false;
  }

  async run(input: TInput): Promise<AgentResult<TOutput>> {
    const runId = uuid();
    const start = Date.now();
    let tokensUsed = 0;

    logger.info(`Agent ${this.name} starting`, { runId }, this.name);

    await events.emit({
      eventType: "agent.started",
      actor: this.name,
      metadata: { runId, input: typeof input === "string" ? input : JSON.stringify(input) },
    });

    try {
      const result = await this.execute(input, runId);
      tokensUsed = result.tokensUsed ?? 0;

      await events.emit({
        eventType: "agent.completed",
        actor: this.name,
        metadata: { runId, tokensUsed, durationMs: Date.now() - start },
      });

      logger.info(`Agent ${this.name} completed`, { runId, durationMs: Date.now() - start }, this.name);

      return {
        success: true,
        data: result.data,
        runId,
        agent: this.name,
        durationMs: Date.now() - start,
        tokensUsed,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await events.emit({
        eventType: "agent.failed",
        actor: this.name,
        metadata: { runId, error: errorMsg },
      });

      logger.error(`Agent ${this.name} failed`, { runId, error: errorMsg }, this.name);

      return {
        success: false,
        error: errorMsg,
        runId,
        agent: this.name,
        durationMs: Date.now() - start,
        tokensUsed,
      };
    }
  }

  public abstract execute(
    input: TInput,
    runId: string
  ): Promise<{ data: TOutput; tokensUsed?: number }>;

  /** Helper: call the LLM with the agent's system prompt */
  public async chat(
    userMessages: LLMMessage[],
    opts?: { jsonMode?: boolean; temperature?: number }
  ) {
    const messages: LLMMessage[] = [
      { role: "system", content: this.systemPrompt },
      ...userMessages,
    ];

    return this.llm.complete(
      {
        messages,
        model: this.model,
        temperature: opts?.temperature ?? this.temperature,
        maxTokens: this.maxTokens,
        jsonMode: opts?.jsonMode,
      },
      this.provider
    );
  }
}
