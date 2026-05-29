---
type: doc
name: project-overview
description: High-level overview, purpose, stack and entry points
generated: 2026-05-29
status: generated
---

# Project Overview

- **Project**: @aicoders-academy/pi-extensions
- **Type**: pi-extension
- **Primary language**: TypeScript
- **Package manager**: npm
- **Detection**: pi package manifest or pi extension/theme keywords detected

## Purpose

Extensões oficiais da aicoders.academy para a comunidade do pi coding agent.

Repositório open source oficial da aicoders.academy com extensões para a comunidade do pi coding agent.

⚠️ Segurança: extensões do pi executam código na sua máquina com as permissões do seu usuário. Instale apenas extensões de fontes confiáveis e revise o código antes de usar.

## What This Codebase Provides

- **extensions/prevc** — PREVC workflow extension: manages plan/review/execute/validate/confirm state, tools, events and git confirmation. Highlights: 14 source file(s); 2 documentation file(s); entry point(s): extensions/prevc/index.ts; contracts: custom session message prevc-context, LLM tool prevc_workflow, pi event hook before_agent_start, pi event hook session_start, pi event hook tool_call.
- **extensions/guardrails** — Guardrails extension: blocks or confirms sensitive file, shell, git and package operations. Highlights: 2 source file(s); entry point(s): extensions/guardrails/index.ts; contracts: custom session message aicoders-guardrails-context, pi event hook before_agent_start, pi event hook tool_call, pi event hook user_bash, slash command /guardrails.
- **extensions/context** — AICoders Context/dotcontext extension: analyzes the repository, generates .context knowledge files and injects selected feedforward context. Highlights: 1 source file(s); entry point(s): extensions/context/index.ts; contracts: CLI flag --dotcontext-feedforward, custom session message aicoders-context-feedforward, pi event hook before_agent_start, pi event hook resources_discover, slash command /dotcontext.
- **project-root** — Package metadata, README and top-level documentation for installing and loading the pi package. Highlights: 2 documentation file(s); entry point(s): README.md, package.json.
- **themes** — Theme assets discoverable by pi for the terminal UI.

## Key Entry Points

- `./extensions/*.ts`
- `./extensions/*/index.ts`
- `./themes`
- `README.md`
- `extensions/context/index.ts`
- `extensions/guardrails/index.ts`
- `extensions/prevc/index.ts`
- `package.json`

## Public Surface

- **CLI flag** `--dotcontext-feedforward` — Inject .context docs/agents/skills before each agent turn (`extensions/context/index.ts`)
- **custom session message** `aicoders-context-feedforward` — Custom message type emitted into the pi session. (`extensions/context/index.ts`)
- **custom session message** `aicoders-guardrails-context` — Custom message type emitted into the pi session. (`extensions/guardrails/index.ts`)
- **custom session message** `prevc-context` — Custom message type emitted into the pi session. (`extensions/prevc/application/register-events.ts`)
- **LLM tool** `prevc_workflow` — Registra e avança etapas do workflow PREVC: P planejar, R revisar, E executar, V validar, C confirmar/commit. (`extensions/prevc/application/register-tool.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `resources_discover` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `session_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `tool_call` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `tool_call` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)

## Next Reading

- [Architecture](./architecture.md)
- [API Reference](./api.md)
- [Testing Strategy](./testing-strategy.md)
