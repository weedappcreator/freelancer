# Freelance Revenue OS

## What This Is
AI-powered freelance client acquisition system. Terminal-first, LLM-agnostic.
Finds businesses with real problems, qualifies them, crafts relevant outreach,
follows up intelligently, and tracks the pipeline to closed revenue.

## Quick Start
```bash
npm run build          # Compile TypeScript
node dist/cli/index.js status   # System health check
node dist/cli/index.js doctor   # Diagnose configuration
```

## Project Structure
```
src/
  core/       — Config, schemas, logger, operator context
  providers/  — LLM abstraction (Anthropic, OpenRouter, OpenAI, Ollama)
  agents/     — Base agent framework + specialized agents
  db/         — SQLite database layer
  events/     — Event bus for observability
  cli/        — Commander.js CLI entry point
  skills/     — Skill loader (reads from .skills/)
  integrations/ — HubSpot, email, browser, social adapters
  dashboard/  — Paperclip integration bridge

.skills/repos/ — Cloned skill repositories (gitignored)
docs/          — Master prompt + operator context
data/          — SQLite DB + local data (gitignored)
```

## LLM Providers
Set `LLM_PROVIDER` in `.env` to switch between:
- `anthropic` — Claude API direct
- `openrouter` — Multi-model gateway (200+ models)
- `openai` — OpenAI or any compatible endpoint
- `ollama` — Local models (Qwen, Llama, etc.)

All agents use the `LLMRegistry` abstraction — zero code changes to switch.

## Integrated Tools & Skills
See `docs/TOOLS_MANIFEST.md` for the full inventory.

## Key Principles
- Evidence before outreach — never contact without research
- Quality over volume — optimize conversations, not message count
- Draft mode by default — external actions require approval
- Every action is observable and logged
- No hardcoded secrets — everything in `.env`
