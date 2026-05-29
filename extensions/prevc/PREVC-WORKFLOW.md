# Extensão PREVC Workflow

Extensão local do pi para conduzir implementação no ciclo **P → R → E → V → C**.

A implementação está organizada em componentes menores seguindo uma arquitetura hexagonal leve. Consulte [PREVC-ARCHITECTURE.md](./PREVC-ARCHITECTURE.md) para a separação entre `domain/`, `application/` e `adapters/`.

- **P · Planejar**: investiga em modo read-only, pergunta se o usuário quer um arquivo `.md` como output final e produz uma SPEC completa (contexto, escopo, artefatos, requisitos, design técnico, etapas de execução, validação, riscos) antes de registrar o plano, sem alterar arquivos.
- **R · Revisar**: plano é aprovado ou volta para refinamento.
- **E · Executar**: implementa somente a fase atual.
- **V · Validar**: roda checks/testes da fase atual; se falhar, volta para E.
- **C · Confirmar/Commit**: confirma evidências e cria commit da fase, então avança para a próxima fase.

## SPEC da etapa P

Na etapa de planejamento, a SPEC apresentada ao usuário deve incluir:

1. objetivo e contexto;
2. escopo e fora de escopo;
3. decisão sobre output Markdown final, perguntando: “Você quer que eu gere um arquivo `.md` como output ao final?”;
4. artefatos previstos;
5. estado atual investigado;
6. requisitos funcionais e não funcionais;
7. design técnico proposto;
8. etapas de execução, com ações, arquivos impactados, entregáveis, validações, critério de confirmação/commit e riscos por fase;
9. critérios de aceite e riscos finais.

## Comandos

```text
/prevc start <objetivo>      inicia o workflow na etapa P
/prevc status                mostra estado atual
/prevc approve               aprova plano quando estiver em R
/prevc reject <motivo>       rejeita plano e volta para P
/prevc commit <mensagem>     cria commit manual na etapa C
/prevc stop                  para workflow e restaura ferramentas
```

## Ferramenta do agente

A extensão registra a ferramenta `prevc_workflow`, usada pelo agente para avançar o estado:

- `set_plan`: registra `summary` e `phases`, vai para R.
- `mark_executed`: registra evidência da execução e vai para V.
- `mark_validated`: registra checks/evidência; com `passed=false` volta para E, com `passed=true` vai para C.
- `mark_confirmed`: confirma a fase, opcionalmente cria commit, e avança para a próxima fase.
- `status`: retorna o estado atual.

## Guardrails

- P/R bloqueiam `edit`, `write` e comandos bash não-read-only.
- E permite edição, mas bloqueia `git commit/tag/push`.
- V bloqueia edição e comandos mutáveis.
- C bloqueia edição e só permite bash relacionado a `git status/diff/add/commit/rev-parse`.

Recarregue o pi com `/reload` após criar ou alterar a extensão.
