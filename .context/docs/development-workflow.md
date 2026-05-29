---
type: doc
name: development-workflow
description: Branching, PREVC, contribution flow and delivery rules
generated: 2026-05-29
status: generated
---

# Development Workflow

## Workflow

Use PREVC for non-trivial work:

1. **P — Planejar**: investigate in read-only mode and define scope, requirements, artifacts and checks.
2. **R — Revisar**: validate approach, risks, architecture and acceptance criteria before editing.
3. **E — Executar**: implement one approved phase at a time with focused file changes.
4. **V — Validar**: run checks and capture objective evidence.
5. **C — Confirmar**: summarize, hand off and commit only when appropriate.

## Repository Commands

No package scripts detected yet.

## Change Rules Inferred From The Codebase

- Use PREVC for non-trivial work and keep implementation phases small.
- Do not overwrite user-edited .context files unless the user passes --force or the file is still a generated placeholder.
- Ask for explicit permission before sensitive path, shell, git or dependency operations.
- No package scripts are currently declared; document ad-hoc validation commands in handoff notes.
