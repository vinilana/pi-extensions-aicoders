type ExtensionAPI = {
  on(
    eventName: "before_agent_start",
    handler: (event: { systemPrompt: string }) =>
      | { systemPrompt: string }
      | Promise<{ systemPrompt: string }>,
  ): void;
  registerCommand(
    name: string,
    command: {
      description: string;
      handler: (
        args: string,
        ctx: { ui: { notify(message: string, level: "info" | "error" | "warn"): void } },
      ) => void | Promise<void>;
    },
  ): void;
};

const PREVC_SYSTEM_PROMPT = String.raw`
## Extensão AICoders PREVC

Quando o usuário pedir uma tarefa de implementação, manutenção,
documentação, automação ou alteração de arquivos, conduza o trabalho pelo
workflow PREVC:

- P — Planejar
- R — Revisar/aprovar o plano com o usuário
- E — Executar somente uma fase por ciclo
- V — Validar a fase executada com evidências objetivas
- C — Confirmar a fase, criando commit quando aplicável e após validação

### Etapa P — Spec obrigatória antes do plano

Antes de iniciar execução ou alterar arquivos, apresente ao usuário uma
"Spec PREVC" detalhada e objetiva. A spec deve conter:

1. Objetivo final esperado.
2. Escopo incluído e, quando útil, fora de escopo.
3. Pergunta explícita sobre output Markdown:
   "Você quer que eu gere um arquivo .md como output ao final?"
   - Se sim, peça ou sugira caminho/nome do arquivo.
   - Se não, registre que não haverá artefato Markdown final.
   - Se o usuário já informou isso, apenas confirme a decisão.
4. Artefatos previstos, incluindo o status do output .md: sim, não ou pendente.
5. Etapas de execução propostas, com pelo menos:
   - nome da fase;
   - ações previstas;
   - arquivos/áreas prováveis de impacto;
   - validações/checks da fase;
   - critério de confirmação/commit;
   - riscos ou pontos de atenção.
6. Critérios de aceite finais.
7. Pergunta clara solicitando aprovação do plano antes de prosseguir.

### Regra de aprovação

Não avance para execução enquanto a spec/plano não estiver aprovada pelo
usuário. Se a preferência sobre output .md estiver pendente e for relevante
para a entrega, pergunte antes de executar.

### Execução por fases

Após aprovação, execute apenas uma fase por vez. Para cada fase:

1. E: implemente somente a fase atual.
2. V: rode checks objetivos e reporte evidências.
3. C: confirme a fase; só faça commit se a validação passou.

Ao concluir tudo, reporte fases concluídas, checks, commits, bloqueios e
riscos residuais.
`;

const PREVC_SPEC_TEMPLATE = String.raw`Spec PREVC — modelo de planejamento

1. Objetivo
   - Resultado final esperado.

2. Output Markdown
   - Pergunta: você quer que eu gere um arquivo .md como output ao final?
   - Opções: sim, com caminho/nome; não; ou pendente.

3. Escopo
   - Incluído.
   - Fora de escopo, se aplicável.

4. Etapas de execução
   - Fase 1: ações, arquivos afetados, validação, confirmação/commit e riscos.
   - Fase 2: ações, arquivos afetados, validação, confirmação/commit e riscos.
   - Demais fases conforme necessário.

5. Critérios de aceite
   - Checks finais esperados.
   - Evidências que comprovam conclusão.

6. Aprovação
   - Aguardar confirmação do usuário antes de executar.
`;

export default function prevcExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${PREVC_SYSTEM_PROMPT}`,
    };
  });

  pi.registerCommand("prevc-spec", {
    description: "Mostra o modelo de Spec PREVC usado na etapa de planejamento.",
    handler: async (_args, ctx) => {
      ctx.ui.notify(PREVC_SPEC_TEMPLATE, "info");
    },
  });
}
