import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TOOL_NAME } from "../domain/constants.ts";
import { formatState } from "../domain/format.ts";
import type { WorkflowService } from "./workflow-service.ts";

export function registerPrevcCommand(pi: ExtensionAPI, workflow: WorkflowService): void {
  pi.registerCommand("prevc", {
    description: "Controla o workflow PREVC (P planeja, R revisa, E executa, V valida, C confirma/commit)",
    getArgumentCompletions: (prefix) => {
      const actions = ["start", "status", "approve", "reject", "commit", "stop", "reset"];
      const filtered = actions.filter((action) => action.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((action) => ({ value: action, label: action })) : null;
    },
    handler: async (args, ctx) => {
      const [rawAction = "status", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const action = rawAction.toLowerCase();
      const remainder = rest.join(" ").trim();
      const state = workflow.getState();

      if (action === "start") {
        workflow.startWorkflow(ctx, remainder);
        ctx.ui.notify("PREVC iniciado na etapa P (planejar).", "info");
        if (remainder) {
          pi.sendUserMessage(
            `Inicie o workflow PREVC para este objetivo: ${remainder}\n\nComece pela etapa P: investigue, produza uma SPEC detalhada, pergunte se o usuário quer um arquivo .md como output final, detalhe as etapas de execução e registre o plano usando a ferramenta ${TOOL_NAME}.`,
          );
        }
        return;
      }

      if (action === "status") {
        ctx.ui.notify(formatState(workflow.getState()), "info");
        return;
      }

      if (action === "approve") {
        if (state.stage !== "R" || state.phases.length === 0) {
          ctx.ui.notify("Não há plano em revisão para aprovar.", "warning");
          return;
        }
        workflow.beginExecution(ctx);
        ctx.ui.notify("Plano aprovado. PREVC avançou para E (executar fase 1).", "info");
        return;
      }

      if (action === "reject") {
        if (state.stage !== "R") {
          ctx.ui.notify("A etapa atual não é R (revisão).", "warning");
          return;
        }
        workflow.rejectPlan(ctx, remainder);
        ctx.ui.notify("Plano rejeitado. PREVC voltou para P (planejar).", "info");
        return;
      }

      if (action === "commit") {
        if (state.stage !== "C") {
          ctx.ui.notify("Commit só é permitido na etapa C.", "warning");
          return;
        }
        const result = await workflow.commitCurrentPhase(ctx, remainder);
        ctx.ui.notify(result.evidence, result.hash ? "info" : "warning");
        return;
      }

      if (action === "stop" || action === "reset") {
        workflow.stopWorkflow(ctx);
        ctx.ui.notify("PREVC parado e ferramentas restauradas.", "info");
        return;
      }

      ctx.ui.notify("Uso: /prevc start <objetivo> | status | approve | reject <motivo> | commit <msg> | stop", "info");
    },
  });
}
