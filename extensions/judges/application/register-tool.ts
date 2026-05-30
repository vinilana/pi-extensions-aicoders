import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { TOOL_NAME } from "../domain/constants.ts";
import { formatEvaluationResult } from "../domain/format.ts";
import type { JudgesEvaluationResult } from "../domain/types.ts";
import type { JudgesService } from "./judges-service.ts";

function formatJudgeIds(judgeIds: unknown): string {
  if (!Array.isArray(judgeIds) || judgeIds.length === 0) return "juízes habilitados";
  return judgeIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).join(", ") || "juízes habilitados";
}

function extractEvaluation(result: unknown): JudgesEvaluationResult | undefined {
  const details = (result as { details?: { result?: JudgesEvaluationResult } } | undefined)?.details;
  return details?.result;
}

export function registerJudgesTool(pi: ExtensionAPI, judges: JudgesService): void {
  pi.registerTool({
    name: TOOL_NAME,
    label: "Judges Evaluate",
    description: "Avalia uma entrega contra a SPEC inicial usando judges configuráveis por prompt e scripts opcionais, retornando passed e SPEC pendente quando houver lacunas.",
    promptSnippet: "Avalia conclusões contra a SPEC inicial e gera SPEC pendente se algo não estiver completo",
    promptGuidelines: [
      "Use judges_evaluate antes de declarar uma tarefa concluída quando houver SPEC, critérios de aceite ou validação de entrega.",
      "Na etapa V do PREVC, use judges_evaluate antes de chamar prevc_workflow com mark_validated passed=true.",
      "Se judges_evaluate retornar passed=false, não declare conclusão; continue a execução usando a pendingSpec retornada.",
    ],
    renderShell: "self",
    parameters: Type.Object({
      spec: Type.Optional(Type.String({ description: "SPEC inicial, plano ou critérios de aceite a confrontar. Se omitida, usa a SPEC ativa capturada do prompt inicial." })),
      result: Type.String({ description: "Resultado declarado, evidências, arquivos alterados e checks executados que serão confrontados com a SPEC." }),
      evidence: Type.Optional(Type.String({ description: "Evidências adicionais, logs, diffs, outputs de testes ou contexto da validação." })),
      judgeIds: Type.Optional(Type.Array(Type.String({ description: "IDs de judges específicos a executar. Padrão: todos os habilitados." }))),
      runScripts: Type.Optional(Type.Boolean({ description: "Executar scripts configurados. Padrão: true; scripts ainda exigem allowScripts=true na configuração." })),
    }),
    renderCall(args, theme, context) {
      const title = theme.fg("warning", theme.bold("Etapa de validação iniciada pelo juiz"));
      const judgesLabel = theme.fg("muted", `Juiz: ${formatJudgeIds(args.judgeIds)}`);
      const state = context.executionStarted ? theme.fg("dim", "UI tradicional oculta enquanto os judges avaliam.") : theme.fg("dim", "Aguardando início da validação.");
      return new Text(`${title}\n${judgesLabel}\n${state}`, 1, 0, (text) => theme.bg("toolPendingBg", text));
    },
    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Validação em andamento..."), 1, 0, (text) => theme.bg("toolPendingBg", text));
      }

      const evaluation = extractEvaluation(result);
      if (!evaluation) return new Text("", 0, 0);

      const color = evaluation.passed ? "success" : "warning";
      const headline = theme.fg(color, evaluation.passed ? "Judges aprovaram a entrega" : "Judges apontaram pendências");
      const body = expanded ? `\n${formatEvaluationResult(evaluation)}` : evaluation.summary ? `\n${theme.fg("dim", evaluation.summary)}` : "";
      return new Text(`${headline}${body}`, 1, 0, (text) => theme.bg(evaluation.passed ? "toolSuccessBg" : "toolPendingBg", text));
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const result = await judges.evaluate(
        ctx,
        {
          spec: params.spec ?? "",
          result: params.result,
          evidence: params.evidence,
          judgeIds: params.judgeIds,
          runScripts: params.runScripts,
          source: "tool",
        },
        signal,
      );

      return {
        content: [{ type: "text", text: formatEvaluationResult(result) }],
        details: { result },
      };
    },
  });
}
