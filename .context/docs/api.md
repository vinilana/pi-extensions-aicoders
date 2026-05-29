---
type: doc
name: api
description: Public interfaces, APIs, commands and integration contracts
generated: 2026-05-29
status: generated
---

# API Reference

## Slash Commands

- **slash command** `/dotcontext` — Inicializa e inspeciona o contexto .context da AICoders (`extensions/context/index.ts`)
- **slash command** `/guardrails` — Mostra as regras de segurança dos guardrails AICoders (`extensions/guardrails/index.ts`)
- **slash command** `/prevc` — Controla o workflow PREVC (P planeja, R revisa, E executa, V valida, C confirma/commit) (`extensions/prevc/application/register-command.ts`)

## LLM Tools and Flags

- **CLI flag** `--dotcontext-feedforward` — Inject .context docs/agents/skills before each agent turn (`extensions/context/index.ts`)
- **LLM tool** `prevc_workflow` — Registra e avança etapas do workflow PREVC: P planejar, R revisar, E executar, V validar, C confirmar/commit. (`extensions/prevc/application/register-tool.ts`)

## Events and Session Messages

- **custom session message** `aicoders-context-feedforward` — Custom message type emitted into the pi session. (`extensions/context/index.ts`)
- **custom session message** `aicoders-guardrails-context` — Custom message type emitted into the pi session. (`extensions/guardrails/index.ts`)
- **custom session message** `prevc-context` — Custom message type emitted into the pi session. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `resources_discover` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `session_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `tool_call` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `tool_call` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `user_bash` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)

## Package Integration

- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `resources_discover` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `session_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `tool_call` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `tool_call` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `user_bash` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi extension entry** `./extensions/*.ts` — Declared in package.json pi.extensions. (`package.json`)
- **pi extension entry** `./extensions/*/index.ts` — Declared in package.json pi.extensions. (`package.json`)
- **pi theme entry** `./themes` — Declared in package.json pi.themes. (`package.json`)

## Examples

- `/dotcontext init` analyzes the repository and creates .context docs/agents/skills.
- `/dotcontext feed implementar feature` previews selected feedforward files for a task.
- `/guardrails` shows the active safety rules.
- `/prevc start <objetivo>` starts the PREVC workflow.
