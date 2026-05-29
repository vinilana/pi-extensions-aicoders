# Documentation Index

Knowledge base for **@aicoders-academy/pi-extensions** generated from repository analysis by the AICoders Context extension.

## Project Snapshot

- **Project**: @aicoders-academy/pi-extensions
- **Type**: pi-extension
- **Primary language**: TypeScript
- **Package manager**: npm
- **Detection**: pi package manifest or pi extension/theme keywords detected

## Detected Public Surface

- **CLI flag** `--dotcontext-feedforward` — Inject .context docs/agents/skills before each agent turn (`extensions/context/index.ts`)
- **custom session message** `aicoders-context-feedforward` — Custom message type emitted into the pi session. (`extensions/context/index.ts`)
- **custom session message** `aicoders-guardrails-context` — Custom message type emitted into the pi session. (`extensions/guardrails/index.ts`)
- **custom session message** `prevc-context` — Custom message type emitted into the pi session. (`extensions/prevc/application/register-events.ts`)
- **LLM tool** `prevc_workflow` — Registra e avança etapas do workflow PREVC: P planejar, R revisar, E executar, V validar, C confirmar/commit. (`extensions/prevc/application/register-tool.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/context/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/guardrails/index.ts`)
- **pi event hook** `before_agent_start` — Extension subscribes to this pi lifecycle/event hook. (`extensions/prevc/application/register-events.ts`)

## Core Guides

- [Project Overview](./project-overview.md) — High-level overview, purpose, stack and entry points
- [Architecture](./architecture.md) — System architecture, boundaries, modules and design decisions
- [Data Flow](./data-flow.md) — How data, state and control move through the system
- [API Reference](./api.md) — Public interfaces, APIs, commands and integration contracts
- [Getting Started](./getting-started.md) — Local setup, installation and onboarding path
- [Development Workflow](./development-workflow.md) — Branching, PREVC, contribution flow and delivery rules
- [Testing Strategy](./testing-strategy.md) — Test commands, coverage expectations and validation approach
- [Tooling](./tooling.md) — Scripts, package manager, automation and productivity tools
- [Security](./security.md) — Security assumptions, secrets, permissions and threat surfaces
- [Deployment](./deployment.md) — Build, release, deployment and rollback process
- [Contributing](./contributing.md) — Code standards, review expectations and team conventions
- [Glossary](./glossary.md) — Domain terms, acronyms and project vocabulary

## Codebase Map

- [codebase-map.json](./codebase-map.json) — machine-readable snapshot generated during initialization.

## Usage

- Use `/dotcontext feed <task>` to preview which files would be injected for a task.
- The extension automatically injects relevant docs/agents/skills before every agent turn.
- Run `/dotcontext init --force` only when you intentionally want to regenerate generated context files, including manually edited files.
