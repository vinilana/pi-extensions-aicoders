import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { TOOL_NAME } from "../domain/constants.ts";
import { formatState } from "../domain/format.ts";
import type { WorkflowToolParams } from "../domain/types.ts";
import type { WorkflowService } from "./workflow-service.ts";

export function registerPrevcTool(pi: ExtensionAPI, workflow: WorkflowService): void {
  pi.registerTool({
    name: TOOL_NAME,
    label: "PREVC Workflow",
    description: "Registra e avança etapas do workflow PREVC: P planejar, R revisar, E executar, V validar, C confirmar/commit.",
    promptSnippet: "Controla o estado do workflow PREVC e registra evidências por fase.",
    promptGuidelines: [
      "Use prevc_workflow para registrar o plano, evidências de execução, validação e confirmação no workflow PREVC.",
      "Nunca avance uma etapa PREVC sem chamar prevc_workflow com a ação correspondente.",
    ],
    parameters: Type.Object({
      action: StringEnum(["status", "set_plan", "mark_executed", "mark_validated", "mark_confirmed"] as const),
      summary: Type.Optional(Type.String({ description: "Resumo do objetivo/plano." })),
      phases: Type.Optional(Type.Array(Type.String({ description: "Título de uma fase do plano." }))),
      evidence: Type.Optional(Type.String({ description: "Evidência objetiva da etapa executada." })),
      passed: Type.Optional(Type.Boolean({ description: "Resultado da validação na etapa V." })),
      checks: Type.Optional(Type.Array(Type.String({ description: "Checks executados e resultado." }))),
      commit: Type.Optional(Type.Boolean({ description: "Na etapa C, criar commit automaticamente após confirmação. Padrão: true." })),
      commitMessage: Type.Optional(Type.String({ description: "Mensagem do commit da fase atual." })),
    }),
    async execute(_toolCallId, params: WorkflowToolParams, _signal, _onUpdate, ctx) {
      if (params.action === "status") {
        return { content: [{ type: "text", text: formatState(workflow.getState()) }], details: { state: workflow.getStateSnapshot() } };
      }

      const state = workflow.getState();
      if (!state.enabled && state.stage !== "done" && params.action !== "set_plan") {
        throw new Error("PREVC não está ativo. Use /prevc start <objetivo> antes de avançar etapas.");
      }

      if (params.action === "set_plan") {
        const text = await workflow.setPlan(ctx, params);
        return { content: [{ type: "text", text }], details: { state: workflow.getStateSnapshot() } };
      }

      if (params.action === "mark_executed") {
        const text = workflow.markExecuted(ctx, params.evidence);
        return { content: [{ type: "text", text }], details: { state: workflow.getStateSnapshot() } };
      }

      if (params.action === "mark_validated") {
        const text = workflow.markValidated(ctx, params);
        return { content: [{ type: "text", text }], details: { state: workflow.getStateSnapshot() } };
      }

      if (params.action === "mark_confirmed") {
        const text = await workflow.markConfirmed(ctx, params);
        return { content: [{ type: "text", text }], details: { state: workflow.getStateSnapshot() } };
      }

      throw new Error(`Ação PREVC desconhecida: ${params.action}`);
    },
  });
}
