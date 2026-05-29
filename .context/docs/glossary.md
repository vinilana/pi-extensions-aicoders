---
type: doc
name: glossary
description: Domain terms, acronyms and project vocabulary
generated: 2026-05-29
status: generated
---

# Glossary

## Terms

- **PREVC** — Planejar, Revisar, Executar, Validar, Confirmar workflow used for non-trivial changes.
- **Feedforward** — repository context injected before work starts so the agent acts with local knowledge.
- **dotcontext** — AICoders Context command family that generates and loads the .context knowledge base.
- **Guardrails** — extension rules that block or ask permission for sensitive paths and commands.
- **Pi package** — package.json manifest with pi.extensions and/or pi.themes loaded by the pi coding agent.
- **--dotcontext-feedforward** — CLI flag in `extensions/context/index.ts`. Inject .context docs/agents/skills before each agent turn
- **prevc_workflow** — LLM tool in `extensions/prevc/application/register-tool.ts`. Registra e avança etapas do workflow PREVC: P planejar, R revisar, E executar, V validar, C confirmar/commit.
- **/dotcontext** — slash command in `extensions/context/index.ts`. Inicializa e inspeciona o contexto .context da AICoders
- **/guardrails** — slash command in `extensions/guardrails/index.ts`. Mostra as regras de segurança dos guardrails AICoders
- **/prevc** — slash command in `extensions/prevc/application/register-command.ts`. Controla o workflow PREVC (P planeja, R revisa, E executa, V valida, C confirma/commit)
