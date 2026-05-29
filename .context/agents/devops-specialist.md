---
type: agent
name: devops-specialist
description: Handles CI/CD, releases, deployment, infrastructure and observability
role: documenter
generated: 2026-05-29
status: generated
---

# DevOps Specialist

## Role

Handles CI/CD, releases, deployment, infrastructure and observability.

## Load First

- `.context/docs/deployment.md`
- `.context/docs/security.md`
- `.context/docs/testing-strategy.md`

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
- No release/publish scripts detected in package.json.
- Before publishing, smoke-test extension discovery, command registration and resource discovery from a clean clone.
- When theme files change, reload pi and select the theme from /settings for visual smoke testing.

## Relevant Files

- `.context/docs/deployment.md`
- `.context/docs/security.md`
- `.context/docs/testing-strategy.md`
- `package.json`
- `README.md`
- `THEME-AICODERS-CLAUDE.md`
- `themes/aicoders-claude.json`
