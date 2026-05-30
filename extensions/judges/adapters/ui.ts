import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { JudgesEvaluationResult } from "../domain/types.ts";

const UI_KEY = "judges";
const VALIDATION_MESSAGE = "Etapa de validação iniciada pelo juiz";

function formatJudgeList(judgeIds: string[]): string {
  return judgeIds.length > 0 ? judgeIds.join(", ") : "juízes habilitados";
}

function restoreWorkingUi(ctx: ExtensionContext): void {
  ctx.ui.setWorkingMessage();
  ctx.ui.setWorkingIndicator();
  ctx.ui.setWorkingVisible(true);
}

export function startJudgesEvaluationUi(ctx: ExtensionContext, judgeIds: string[]): void {
  if (!ctx.hasUI) return;

  const title = VALIDATION_MESSAGE;
  ctx.ui.setStatus(UI_KEY, ctx.ui.theme.fg("warning", "Judges validando"));
  ctx.ui.setWorkingVisible(false);
  ctx.ui.setWorkingMessage(title);
  ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("warning", "Judges")] });
  ctx.ui.setWidget(UI_KEY, [
    ctx.ui.theme.fg("warning", title),
    ctx.ui.theme.fg("muted", `Juiz: ${formatJudgeList(judgeIds)}`),
    ctx.ui.theme.fg("dim", "UI tradicional oculta durante a validação."),
  ]);
}

export function finishJudgesEvaluationUi(ctx: ExtensionContext, result: JudgesEvaluationResult): void {
  if (!ctx.hasUI) return;

  restoreWorkingUi(ctx);
  ctx.ui.setStatus(UI_KEY, result.passed ? ctx.ui.theme.fg("success", "Judges aprovado") : ctx.ui.theme.fg("warning", "Judges pendente"));
  ctx.ui.setWidget(UI_KEY, [
    result.passed ? ctx.ui.theme.fg("success", "Judges aprovaram a entrega") : ctx.ui.theme.fg("warning", "Judges apontaram pendências"),
    ctx.ui.theme.fg("dim", result.summary || "Validação finalizada."),
  ]);
}

export function failJudgesEvaluationUi(ctx: ExtensionContext, error: unknown): void {
  if (!ctx.hasUI) return;

  const message = error instanceof Error ? error.message : String(error);
  restoreWorkingUi(ctx);
  ctx.ui.setStatus(UI_KEY, ctx.ui.theme.fg("error", "Judges erro"));
  ctx.ui.setWidget(UI_KEY, [
    ctx.ui.theme.fg("error", "Judges não concluíram a validação"),
    ctx.ui.theme.fg("dim", message),
  ]);
}

export function clearJudgesUi(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  restoreWorkingUi(ctx);
  ctx.ui.setStatus(UI_KEY, undefined);
  ctx.ui.setWidget(UI_KEY, undefined);
}
