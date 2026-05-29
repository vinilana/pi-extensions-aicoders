---
type: agent
name: test-writer
description: Creates and updates tests that prove behavior and prevent regressions
role: qa
generated: 2026-05-29
status: generated
---

# Test Writer

## Role

Creates and updates tests that prove behavior and prevent regressions.

## Load First

- `.context/docs/testing-strategy.md`
- `.context/docs/architecture.md`
- `.context/docs/api.md`

## Responsibilities

- Understand the active PREVC phase and task scope before acting.
- Prefer project docs and existing patterns over generic assumptions.
- Keep changes small, reviewable and backed by validation evidence.
- Update docs or handoff notes when behavior, APIs or workflows change.

## Workflow

1. Read the selected feedforward docs and this playbook.
2. Inspect the relevant source files before proposing or editing code.
3. Execute only the current approved scope.
4. Validate with the repository's documented commands.
5. Report evidence, risks and follow-up work.

## Project-Specific Notes

- Project is detected as pi-extension with primary language TypeScript.
- No automated validation scripts detected; add lint/typecheck/test scripts when the project grows.
- Smoke-test extension loading with `pi -e .` in a disposable session.
- Exercise `/dotcontext init` and `/dotcontext feed <task>` against a temporary repository before release.
- Test allow/block decisions for sensitive paths and destructive commands.
- Validate PREVC stage transitions with prevc_workflow actions and command flows.

## Relevant Files

- `.context/docs/testing-strategy.md`
- `.context/docs/architecture.md`
- `.context/docs/api.md`
- `extensions/prevc/adapters/git.ts`
- `extensions/prevc/adapters/guardrails.ts`
- `extensions/prevc/adapters/session.ts`
- `extensions/guardrails/index.ts`
- `extensions/guardrails/rules.ts`
- `extensions/context/index.ts`
- `package.json`
- `README.md`
- `THEME-AICODERS-CLAUDE.md`
- `themes/aicoders-claude.json`
