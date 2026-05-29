# Arquitetura da extensão PREVC

A extensão PREVC passa a seguir uma organização inspirada em arquitetura hexagonal, separando regras de negócio puras de integrações com o runtime do pi.

## Camadas

```text
index.ts                         # composition root
application/                     # casos de uso e orquestração
  register-command.ts            # adapter inbound: /prevc
  register-events.ts             # adapter inbound: eventos do pi
  register-tool.ts               # adapter inbound: ferramenta prevc_workflow
  workflow-service.ts            # application service
adapters/                        # adapters outbound para runtime/infra
  git.ts                         # commits via pi.exec
  guardrails.ts                  # política para tool_call/bash
  tools.ts                       # seleção/restauração de ferramentas ativas
  ui.ts                          # status/widget/notify helpers
  session.ts                     # persistência/restauração em session entries
domain/                          # modelo e regras puras
  constants.ts                   # labels, instruções e nomes estáveis
  format.ts                      # formatação do estado/plano
  state.ts                       # criação, clonagem e seleção de fase
  types.ts                       # Stage, WorkflowState, WorkflowPhase
```

## Direção das dependências

- `domain/*` não importa APIs do pi.
- `application/*` conhece o serviço de workflow e recebe o `ExtensionAPI`/`ExtensionContext` apenas nas bordas de registro.
- `adapters/*` encapsula detalhes do pi, git, UI e políticas de ferramentas.
- `index.ts` apenas compõe e registra a extensão.

## Objetivos do refactor

1. Tornar transições e formatação testáveis sem carregar o pi.
2. Manter comandos, ferramenta e eventos em arquivos menores.
3. Isolar guardrails de bash/tool_call da orquestração do workflow.
4. Preservar comportamento público: `/prevc`, ferramenta `prevc_workflow`, estados persistidos e instruções injetadas.
