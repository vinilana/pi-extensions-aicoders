---
type: doc
name: data-flow
description: How data, state and control move through the system
generated: 2026-05-29
status: generated
---

# Data Flow

## Inputs

- User slash-command arguments handled by registered commands.
- Pi lifecycle and tool events handled by extension hooks.
- package.json scripts, dependencies, keywords and pi manifest.
- README.md and repository documentation used for generated context.
- Source files scanned for registrations, modules and constants.

## Transformations

- Slash commands receive user text, inspect repository files and report through ctx.ui.notify.
- before_agent_start hooks append contextual instructions/messages to the next agent turn.
- resources_discover exposes generated .context skills/prompts/themes to pi resource loading.
- /dotcontext init writes .context docs, agent playbooks, skills and codebase-map.json from repository analysis.
- PREVC stores workflow state in session entries and can commit during the confirmation stage.
- Context extension classifies tasks, selects docs/agents/skills and truncates loaded files to fit the system prompt budget.
- Guardrails evaluate paths and shell commands into allow/block decisions.
- PREVC converts workflow tool actions into persisted stage transitions and validation evidence.

## Outputs and Side Effects

- Generated .context/docs, .context/agents, .context/skills and codebase-map.json.
- System prompt appendices and hidden custom messages injected before agent turns.
- UI notifications for command results and status previews.
- Blocked tool/user-bash results when explicit permission is not granted.
- Optional git commits during PREVC confirmation.

## Persistence

- .context/ files persist generated knowledge in the target repository.
- PREVC workflow state is reconstructed from custom session entries.
- Theme JSON is static package data discovered by pi.
