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
- **slash command** `/judges` — Inspeciona config, define SPEC ativa, executa avaliação manual e reseta estado dos judges (`extensions/judges/application/register-command.ts`)
- **slash command** `/prevc` — Controla o workflow PREVC (P planeja, R revisa, E executa, V valida, C confirma/commit) (`extensions/prevc/application/register-command.ts`)

## LLM Tools and Flags

- **CLI flag** `--dotcontext-feedforward` — Inject .context docs/agents/skills before each agent turn (`extensions/context/index.ts`)
- **LLM tool** `prevc_workflow` — Registra e avança etapas do workflow PREVC: P planejar, R revisar, E executar, V validar, C confirmar/commit. (`extensions/prevc/application/register-tool.ts`)
- **LLM tool** `judges_evaluate` — Avalia SPEC versus resultado/evidências usando judges configuráveis e scripts opcionais; retorna `passed`, `missing` e `pendingSpec`. (`extensions/judges/application/register-tool.ts`)

## Events and Session Messages

- **custom session message** `aicoders-context-feedforward` — Custom message type emitted into the pi session. (`extensions/context/index.ts`)
- **custom session message** `aicoders-guardrails-context` — Custom message type emitted into the pi session. (`extensions/guardrails/index.ts`)
- **custom session message** `aicoders-judges-context` — Hidden context message emitted when judges are active. (`extensions/judges/application/register-events.ts`)
- **custom session message** `aicoders-judges-result` — Judge evaluation result message. (`extensions/judges/application/register-events.ts`)
- **custom session message** `prevc-context` — Custom message type emitted into the pi session. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `before_agent_start` — Context extension injects selected feedforward docs/agents/skills. (`extensions/context/index.ts`)
- **pi event hook** `before_agent_start` — Guardrails appends safety instructions. (`extensions/guardrails/index.ts`)
- **pi event hook** `before_agent_start` — Judges captures active SPEC and injects validation guidance. (`extensions/judges/application/register-events.ts`)
- **pi event hook** `before_agent_start` — PREVC injects current workflow instructions. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `message_end` — Judges evaluates final assistant completion claims before accepting them. (`extensions/judges/application/register-events.ts`)
- **pi event hook** `resources_discover` — Context extension exposes generated resources. (`extensions/context/index.ts`)
- **pi event hook** `session_start` — Judges restores active SPEC and last result. (`extensions/judges/application/register-events.ts`)
- **pi event hook** `session_start` — PREVC restores workflow state. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `tool_call` — Guardrails evaluates sensitive tool calls. (`extensions/guardrails/index.ts`)
- **pi event hook** `tool_call` — PREVC blocks tools outside the current stage policy. (`extensions/prevc/application/register-events.ts`)
- **pi event hook** `user_bash` — Guardrails evaluates user shell commands. (`extensions/guardrails/index.ts`)
- **pi event bus** `aicoders:judges:evaluated` — Judges emits structured evaluation results for other extensions to observe. (`extensions/judges/application/judges-service.ts`)

## Package Integration

- **pi extension entry** `./extensions/*.ts` — Declared in package.json pi.extensions. (`package.json`)
- **pi extension entry** `./extensions/*/index.ts` — Declared in package.json pi.extensions. (`package.json`)
- **pi theme entry** `./themes` — Declared in package.json pi.themes. (`package.json`)

## Examples

- `/dotcontext init` analyzes the repository and creates .context docs/agents/skills.
- `/dotcontext feed implementar feature` previews selected feedforward files for a task.
- `/guardrails` shows the active safety rules.
- `/judges status` shows loaded judges configuration and last evaluation.
- `judges_evaluate` returns `pendingSpec` when a task is not fully complete.
- `/prevc start <objetivo>` starts the PREVC workflow; PREVC V should call `judges_evaluate` before `passed=true`.
