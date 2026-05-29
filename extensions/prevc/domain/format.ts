import { STAGE_LABEL } from "./constants.ts";
import { currentPhase } from "./state.ts";
import type { WorkflowState } from "./types.ts";

export function formatState(state: WorkflowState): string {
  const phase = currentPhase(state);
  const lines = [
    `PREVC: ${state.enabled ? "ativo" : "inativo"}`,
    `Etapa: ${STAGE_LABEL[state.stage]}`,
    state.summary ? `Resumo: ${state.summary}` : undefined,
    phase ? `Fase atual: ${phase.id}. ${phase.title}` : undefined,
  ].filter((line): line is string => Boolean(line));

  if (state.phases.length > 0) {
    lines.push("", "Fases:");
    for (const item of state.phases) {
      const pointer = item.id === phase?.id ? "→" : " ";
      const marker = item.status === "confirmed" ? "✓" : item.status === "pending" ? "○" : "◐";
      lines.push(`${pointer} ${marker} ${item.id}. ${item.title} [${item.status}]`);
    }
  }

  return lines.join("\n");
}

export function compactPlan(state: WorkflowState): string {
  if (state.phases.length === 0) return "Plano ainda não definido.";
  return state.phases
    .map((phase) => {
      const prefix = phase.id === currentPhase(state)?.id ? "ATUAL" : phase.status.toUpperCase();
      return `${phase.id}. ${phase.title} — ${prefix}`;
    })
    .join("\n");
}
