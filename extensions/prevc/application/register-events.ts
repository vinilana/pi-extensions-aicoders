import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { evaluateToolCall } from "../adapters/guardrails.ts";
import { restoreLatestWorkflowState } from "../adapters/session.ts";
import { STAGE_INSTRUCTIONS, STAGE_LABEL, TOOL_NAME } from "../domain/constants.ts";
import { compactPlan, formatState } from "../domain/format.ts";
import { currentPhase } from "../domain/state.ts";
import type { Stage } from "../domain/types.ts";
import type { WorkflowService } from "./workflow-service.ts";

export function registerPrevcEvents(pi: ExtensionAPI, workflow: WorkflowService): void {
  pi.on("before_agent_start", async (event) => {
    const state = workflow.getState();
    if (!state.enabled && state.stage !== "done") return undefined;

    const phase = currentPhase(state);
    const stageInstructions = state.stage === "idle" ? "" : STAGE_INSTRUCTIONS[state.stage as Exclude<Stage, "idle">];
    return {
      systemPrompt: `${event.systemPrompt}\n\n## Workflow PREVC obrigatório\n\n${stageInstructions}\n\nEstado atual:\n${formatState(state)}\n\nPlano compacto:\n${compactPlan(state)}\n\nRegras globais:\n- Siga a ordem P → R → (E → V → C por fase) até concluir todas as fases.\n- E/V/C executam apenas UMA fase por ciclo. Não misture fases.\n- Não implemente antes da aprovação do plano na etapa R.\n- Não confirme nem faça commit antes de validação passada na etapa V.\n- Registre evidências usando a ferramenta ${TOOL_NAME}.`,
      message: {
        customType: "prevc-context",
        content: `PREVC ativo: ${STAGE_LABEL[state.stage]}${phase ? `; fase ${phase.id}: ${phase.title}` : ""}`,
        display: false,
      },
    };
  });

  pi.on("tool_call", async (event) => evaluateToolCall(workflow.getState(), event));

  pi.on("session_start", async (_event, ctx) => {
    const restoredState = restoreLatestWorkflowState(ctx);
    if (restoredState) {
      workflow.replaceState(restoredState);
    }

    workflow.onSessionStart(ctx);
  });
}
