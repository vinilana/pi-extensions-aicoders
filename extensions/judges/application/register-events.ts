import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { restoreLatestJudgesState } from "../adapters/session.ts";
import { CONTEXT_CUSTOM_TYPE, RESULT_CUSTOM_TYPE, TOOL_NAME } from "../domain/constants.ts";
import { appendPassBadge, formatAssistantFailureReplacement, formatEvaluationResult, formatPendingFollowUp } from "../domain/format.ts";
import type { JudgesEvaluationResult } from "../domain/types.ts";
import type { JudgesService } from "./judges-service.ts";

function getAssistantText(message: any): string {
  if (!message || message.role !== "assistant" || !Array.isArray(message.content)) return "";
  if (message.content.some((content: any) => content?.type === "toolCall")) return "";
  return message.content
    .filter((content: any) => content?.type === "text" && typeof content.text === "string")
    .map((content: any) => content.text)
    .join("\n")
    .trim();
}

function replaceAssistantText(message: any, text: string) {
  return {
    ...message,
    content: [{ type: "text", text }],
  };
}

function shouldSkipAssistantText(text: string): boolean {
  return !text || text.startsWith("Judges") || text.includes("AICODERS_JUDGES_PENDING_SPEC");
}

function systemPromptAppendix(): string {
  return `

## AICoders Judges
- A extensão Judges compara a SPEC inicial/critério de aceite com o resultado declarado antes de aceitar uma tarefa como concluída.
- Antes de dizer que uma tarefa está concluída, use a ferramenta ${TOOL_NAME} com spec, result e evidências relevantes.
- Se ${TOOL_NAME} retornar passed=false, não devolva conclusão ao usuário; continue trabalhando a partir de pendingSpec.
- Na etapa V do PREVC, ${TOOL_NAME} deve ser chamado antes de prevc_workflow mark_validated passed=true.
- Scripts configurados em .pi/judges.json ou ~/.pi/agent/judges.json só rodam quando allowScripts=true e podem exigir confirmação do usuário.`;
}

function notifyResult(pi: ExtensionAPI, result: JudgesEvaluationResult, display = true): void {
  pi.sendMessage({
    customType: RESULT_CUSTOM_TYPE,
    content: formatEvaluationResult(result),
    display,
    details: { result },
  });
}

export function registerJudgesEvents(pi: ExtensionAPI, judges: JudgesService): void {
  pi.registerMessageRenderer(RESULT_CUSTOM_TYPE, (message, { expanded }, theme) => {
    const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
    const firstLine = content.split("\n")[0] ?? "Judges";
    const text = expanded ? content : firstLine;
    return new Text(theme.fg(content.includes("pendente") || content.includes("erro") ? "warning" : "success", text), 0, 0);
  });

  pi.on("session_start", async (_event, ctx) => {
    const restored = restoreLatestJudgesState(ctx);
    if (restored) judges.replaceState(restored);
    if (ctx.hasUI && judges.getState().lastResult) {
      ctx.ui.setStatus("judges", judges.getState().lastResult?.passed ? "Judges aprovado" : "Judges pendente");
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const config = await judges.loadConfig(ctx);
    if (!config.enabled) return undefined;

    judges.setActiveSpec(event.prompt, ctx);

    return {
      systemPrompt: `${event.systemPrompt}${systemPromptAppendix()}`,
      message: {
        customType: CONTEXT_CUSTOM_TYPE,
        content: `Judges ativos: ${config.judges.filter((judge) => judge.enabled).map((judge) => judge.id).join(", ") || "nenhum"}`,
        display: false,
      },
    };
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return undefined;
    if (event.message.stopReason && event.message.stopReason !== "stop") return undefined;

    const assistantText = getAssistantText(event.message);
    if (shouldSkipAssistantText(assistantText)) return undefined;

    const config = await judges.loadConfig(ctx);
    if (!judges.shouldAutoEvaluate(config, assistantText)) return undefined;

    const result = await judges.evaluate(
      ctx,
      {
        spec: "",
        result: assistantText,
        source: "auto",
      },
      ctx.signal,
    );

    if (result.passed) {
      notifyResult(pi, result, false);
      if (config.auto.onPass === "append") {
        return { message: replaceAssistantText(event.message, appendPassBadge(assistantText, result)) };
      }
      return undefined;
    }

    notifyResult(pi, result, config.auto.onFail === "reportOnly");

    if (config.auto.onFail === "reportOnly") return undefined;

    if (config.auto.onFail === "followUp") {
      pi.sendUserMessage(formatPendingFollowUp(result), { deliverAs: "followUp" });
    }

    return { message: replaceAssistantText(event.message, formatAssistantFailureReplacement(result)) };
  });
}
