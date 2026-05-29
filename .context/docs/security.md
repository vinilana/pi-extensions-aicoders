---
type: doc
name: security
description: Security assumptions, secrets, permissions and threat surfaces
generated: 2026-05-29
status: generated
---

# Security

## Sensitive Areas

- Secrets and environment files must not be read or echoed without explicit user permission.
- Tool-call and shell interception paths can block user/agent actions and should fail safe.
- Generated context may include codebase metadata; avoid collecting file contents that could contain secrets.
- PREVC confirmation can create commits; verify git status and commit message before enabling commit.
- Package dependencies and peer dependencies are part of the trusted runtime surface.
- Judges scripts execute local commands through `pi.exec`; keep them opt-in and review project-controlled config before enabling automation.

## Project-Specific Signals

- Guardrails extension protects .env files, generated/internal directories and destructive shell/package/git operations.
- The code intercepts tool calls or user shell commands; fail-safe behavior should block when explicit approval is unavailable.
- Custom LLM tools are public agent capabilities and must validate inputs, preserve state shape and avoid unintended side effects.
- `judges_evaluate` can call the active model and optional scripts; script execution is blocked unless `allowScripts=true` and may require UI confirmation.

## Review Gates

- Review any change that expands filesystem reads/writes, shell execution, package mutation or git operations.
- Review custom tool schemas, input preparation and returned details for compatibility and safety.
- Review event hooks for fail-open behavior and unintended prompt/session mutation.
- Review `.pi/judges.json` / `judges.config.json` before setting `confirmScripts=false` in trusted automation.
