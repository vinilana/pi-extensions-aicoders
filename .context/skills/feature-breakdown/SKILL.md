---
name: feature-breakdown
description: Use when decomposing feature requests into implementation phases.
phases: [P]
---

# Feature Breakdown

## Procedure

1. Confirm the task scope and active PREVC phase.
2. Load the relevant project docs from `.context/docs/`.
3. Apply the checklist below to the specific files in scope.
4. Capture validation evidence and unresolved risks.

## Checklist

- Use repository-specific conventions, not generic defaults.
- Reference concrete files, commands and outputs.
- Keep recommendations actionable and prioritized.
- If information is missing, inspect the codebase first, then ask a focused question only when needed.

## Project Notes

- Use this skill against a pi-extension codebase with TypeScript as the primary language.
- Likely feature impact area: extensions/prevc — PREVC workflow extension: manages plan/review/execute/validate/confirm state, tools, events and git confirmation.
- Likely feature impact area: extensions/guardrails — Guardrails extension: blocks or confirms sensitive file, shell, git and package operations.
- Likely feature impact area: extensions/context — AICoders Context/dotcontext extension: analyzes the repository, generates .context knowledge files and injects selected feedforward context.
- Likely feature impact area: project-root — Package metadata, README and top-level documentation for installing and loading the pi package.
- Likely feature impact area: themes — Theme assets discoverable by pi for the terminal UI.

## Useful Context

- `.context/docs/project-overview.md`
- `.context/docs/development-workflow.md`
- `.context/docs/architecture.md`
- `.context/docs/glossary.md`
