import type { Stage } from "./types.ts";

export const CUSTOM_TYPE = "prevc-workflow";
export const TOOL_NAME = "prevc_workflow";
export const JUDGES_TOOL_NAME = "judges_evaluate";

export const READ_ONLY_TOOLS = ["read", "bash", "grep", "find", "ls", TOOL_NAME, JUDGES_TOOL_NAME];
export const DEFAULT_EXECUTE_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls", TOOL_NAME, JUDGES_TOOL_NAME];

export const STAGE_LABEL: Record<Stage, string> = {
  idle: "inativo",
  P: "P · planejar",
  R: "R · revisar plano",
  E: "E · executar fase",
  V: "V · validar fase",
  C: "C · confirmar/commit",
  done: "concluído",
};

export const STAGE_INSTRUCTIONS: Record<Exclude<Stage, "idle">, string> = {
  P: `Etapa P — Planejar como SPEC completa:
- Objetivo da etapa: transformar o pedido do usuário em uma especificação implementável e revisável antes de qualquer mudança.
- Trabalhe em modo investigação/read-only: leia arquivos necessários, entenda arquitetura, fluxos, contratos, testes, comandos disponíveis e riscos. Não altere arquivos e não execute comandos mutáveis.
- Se houver ambiguidade que possa mudar escopo, comportamento público, dados, segurança, migrações, UX ou compatibilidade, faça perguntas objetivas antes de fechar a spec. Se a incerteza for pequena, documente a suposição explicitamente.
- Produza uma SPEC completa no texto da resposta antes de registrar o plano. A spec deve conter, quando aplicável:
  1. Contexto e objetivo: problema, resultado esperado e motivação.
  2. Escopo: o que entra, o que fica fora e decisões assumidas.
  3. Output Markdown final: pergunte explicitamente “Você quer que eu gere um arquivo .md como output ao final?” antes de fechar o plano, exceto quando o usuário já tiver informado a preferência. Registre a decisão como:
     - sim: caminho/nome sugerido ou solicitado para o .md;
     - não: sem artefato Markdown final;
     - pendente: pergunta aberta aguardando resposta do usuário.
  4. Artefatos previstos: arquivos, comandos, documentação, commits e o status do output .md.
  5. Estado atual: arquivos/componentes/fluxos relevantes encontrados e evidências da investigação.
  6. Requisitos funcionais: comportamentos esperados, entradas/saídas, estados e casos de borda.
  7. Requisitos não funcionais: compatibilidade, segurança, performance, acessibilidade, observabilidade, i18n, manutenção ou restrições de stack.
  8. Design técnico proposto: módulos/arquivos a alterar/criar, APIs/contratos, dados, dependências, estratégia de migração/rollback se houver.
  9. Plano por fases / etapas de execução: fases pequenas e sequenciais. Para cada fase, detalhe:
     - objetivo da fase;
     - ações de execução previstas;
     - arquivos/áreas prováveis de impacto;
     - entregável esperado;
     - validações/checks da fase;
     - critério de confirmação/commit;
     - riscos ou pontos de atenção.
  10. Estratégia de validação: testes, checks, lint/typecheck/build, inspeção manual e critérios de aceite mensuráveis.
  11. Riscos, trade-offs e pontos que exigem confirmação humana.
- Se a preferência sobre output .md estiver pendente e for relevante para a entrega, faça a pergunta e aguarde resposta antes de chamar prevc_workflow action="set_plan".
- A lista phases enviada ao prevc_workflow deve ser derivada da seção “Plano por fases / etapas de execução”, com títulos curtos e verificáveis.
- O summary enviado ao prevc_workflow deve resumir a SPEC, incluindo escopo, abordagem, decisão sobre output .md e critérios de aceite principais; não apenas repetir o pedido.
- Não avance para implementação. Ao finalizar a SPEC detalhada e o plano, chame prevc_workflow com action="set_plan", summary e phases.`,
  R: `Etapa R — Revisar o plano:
- Aguarde aprovação do plano ou ajuste conforme feedback.
- Não implemente nada.
- Se o usuário pedir mudanças, revise e chame prevc_workflow action="set_plan" novamente.`,
  E: `Etapa E — Executar uma fase:
- Trabalhe somente na fase atual.
- Faça a menor mudança completa para essa fase.
- Não rode commit nesta etapa.
- Ao terminar a implementação da fase, chame prevc_workflow action="mark_executed" com evidência objetiva.`,
  V: `Etapa V — Validar a fase:
- Rode checks/testes/revisões relevantes para a fase atual.
- Chame judges_evaluate confrontando a SPEC/plano da fase atual com o resultado, evidências e checks executados antes de aceitar passed=true.
- Não altere arquivos nesta etapa; se encontrar falha ou se judges_evaluate retornar passed=false, chame prevc_workflow action="mark_validated" com passed=false para voltar à execução usando a pendingSpec dos judges.
- Se checks e judges_evaluate passaram, chame prevc_workflow action="mark_validated" com passed=true, checks e evidência.`,
  C: `Etapa C — Confirmar/Commit:
- Resuma o que foi executado, validado e aprovado pelos judges para a fase atual.
- Confirme a fase e, quando houver mudanças versionáveis, faça commit apenas nesta etapa.
- Use prevc_workflow action="mark_confirmed" com evidence e commitMessage.`,
  done: `Workflow PREVC concluído:
- Reporte fases concluídas, checks, commits, bloqueios e riscos residuais.`,
};
