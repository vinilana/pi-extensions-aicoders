import type { JudgesConfig, JudgesEvaluationResult, PromptJudgeResult, ScriptRunResult } from "./types.ts";

function bullet(items: string[], fallback = "nenhum"): string {
  if (items.length === 0) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function compact(text: string, max = 240): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function formatPromptResult(result: PromptJudgeResult): string {
  const icon = result.passed ? "✅" : result.status === "error" ? "⚠️" : "❌";
  const confidence = result.confidence === undefined ? "" : ` (${Math.round(result.confidence * 100)}%)`;
  return `${icon} ${result.judgeId}${confidence}: ${result.summary || result.status}`;
}

function formatScriptResult(result: ScriptRunResult): string {
  const icon = result.status === "passed" ? "✅" : result.status === "skipped" ? "⏭️" : result.status === "error" ? "⚠️" : "❌";
  const exit = result.exitCode === undefined ? "" : ` exit=${result.exitCode}`;
  return `${icon} ${result.judgeId}/${result.name}${exit}: ${compact(result.command, 120)}`;
}

export function formatConfig(config: JudgesConfig): string {
  const judges = config.judges.map((judge) => {
    const scripts = judge.scripts.length === 0 ? "sem scripts" : `${judge.scripts.length} script(s)`;
    return `- ${judge.enabled ? "✅" : "⏸️"} ${judge.id}: ${scripts}`;
  });

  return [
    "Judges AICoders:",
    `- extensão: ${config.enabled ? "ativa" : "inativa"}`,
    `- auto: ${config.auto.enabled ? `${config.auto.mode}/${config.auto.onFail}` : "desativado"}`,
    `- scripts: ${config.allowScripts ? `permitidos (confirmar=${config.confirmScripts})` : "bloqueados por padrão"}`,
    `- modelo: ${config.model ?? "ativo da sessão"}`,
    `- configs lidas: ${config.loadedConfigPaths.length > 0 ? config.loadedConfigPaths.join(", ") : "nenhuma; usando padrão"}`,
    "Judges configurados:",
    judges.length > 0 ? judges.join("\n") : "- nenhum",
  ].join("\n");
}

export function formatEvaluationResult(result: JudgesEvaluationResult): string {
  const verdict = result.passed ? "✅ aprovado" : "❌ pendente";
  const promptLines = result.promptResults.map(formatPromptResult);
  const scriptLines = result.scriptResults.map(formatScriptResult);

  const sections = [
    `⚖️ Judges: ${verdict}`,
    "",
    "Resumo:",
    result.summary || (result.passed ? "A SPEC foi considerada atendida." : "Há pendências contra a SPEC."),
    "",
    "Pendências:",
    bullet(result.missing),
    "",
    "Checks considerados:",
    bullet(result.checks),
  ];

  if (promptLines.length > 0) {
    sections.push("", "Judges:", promptLines.join("\n"));
  }

  if (scriptLines.length > 0) {
    sections.push("", "Scripts:", scriptLines.join("\n"));
  }

  if (!result.passed && result.pendingSpec.trim()) {
    sections.push("", "SPEC pendente:", result.pendingSpec.trim());
  }

  return sections.join("\n");
}

export function formatPendingFollowUp(result: JudgesEvaluationResult): string {
  return [
    "AICODERS_JUDGES_PENDING_SPEC",
    "Os judges reprovaram a conclusão anterior. Continue a tarefa usando somente a SPEC pendente abaixo.",
    "Não declare a tarefa concluída até chamar judges_evaluate novamente e obter passed=true.",
    "",
    result.pendingSpec.trim() || result.missing.map((item) => `- ${item}`).join("\n"),
  ].join("\n");
}

export function formatAssistantFailureReplacement(result: JudgesEvaluationResult): string {
  return [
    "⚖️ Judges bloquearam a conclusão.",
    "",
    "A entrega ainda não atende totalmente à SPEC inicial.",
    "",
    "Pendências:",
    bullet(result.missing),
    "",
    "Vou continuar a partir da SPEC pendente gerada pelos judges.",
  ].join("\n");
}

export function appendPassBadge(text: string, result: JudgesEvaluationResult): string {
  return `${text.trim()}\n\n---\n⚖️ Judges: aprovado (${result.id})`;
}
