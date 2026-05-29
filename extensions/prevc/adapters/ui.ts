import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { STAGE_LABEL } from "../domain/constants.ts";
import { currentPhase } from "../domain/state.ts";
import type { WorkflowState } from "../domain/types.ts";

export function updatePrevcUi(ctx: ExtensionContext, state: WorkflowState): void {
  if (!ctx.hasUI) return;

  if (!state.enabled && state.stage !== "done") {
    ctx.ui.setStatus("prevc", undefined);
    ctx.ui.setWidget("prevc", undefined);
    return;
  }

  const label = state.stage === "done" ? "PREVC ✓" : `PREVC ${state.stage}`;
  const color = state.stage === "C" || state.stage === "done" ? "success" : state.stage === "R" ? "warning" : "accent";
  ctx.ui.setStatus("prevc", ctx.ui.theme.fg(color, label));

  const phase = currentPhase(state);
  const lines = [`PREVC · ${STAGE_LABEL[state.stage]}`];
  for (const item of state.phases) {
    const pointer = item.id === phase?.id ? "→" : " ";
    const marker = item.status === "confirmed" ? "✓" : item.status === "pending" ? "○" : "◐";
    const text = `${pointer} ${marker} ${item.id}. ${item.title}`;
    lines.push(item.status === "confirmed" ? ctx.ui.theme.fg("success", text) : text);
  }
  ctx.ui.setWidget("prevc", lines);
}
