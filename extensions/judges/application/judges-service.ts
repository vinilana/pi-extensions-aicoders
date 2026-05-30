import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadJudgesConfig } from "../adapters/config.ts";
import { runPromptJudge } from "../adapters/model.ts";
import { persistJudgesState } from "../adapters/session.ts";
import { runJudgeScripts } from "../adapters/scripts.ts";
import { clearJudgesUi, failJudgesEvaluationUi, finishJudgesEvaluationUi, startJudgesEvaluationUi } from "../adapters/ui.ts";
import { cloneState, createEvaluationId, createInitialState } from "../domain/state.ts";
import type { JudgeDefinition, JudgesConfig, JudgesEvaluationInput, JudgesEvaluationResult, JudgesState } from "../domain/types.ts";

function uniqueNonEmpty(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function fallbackPendingSpec(missing: string[], spec: string): string {
  const pending = missing.length > 0 ? missing.map((item) => `- ${item}`).join("\n") : "- Revalidar a entrega contra a SPEC inicial.";
  return [
    "# SPEC pendente gerada pelos Judges",
    "",
    "## Objetivo",
    "Concluir somente os itens que ainda não atendem à SPEC inicial.",
    "",
    "## SPEC inicial de referência",
    spec.trim(),
    "",
    "## Pendências",
    pending,
    "",
    "## Validação obrigatória",
    "- Corrigir as pendências listadas.",
    "- Rodar os checks/testes relevantes.",
    "- Chamar judges_evaluate novamente e prosseguir apenas se passed=true.",
  ].join("\n");
}

function summarizeScripts(results: JudgesEvaluationResult["scriptResults"]): string[] {
  return results.map((script) => {
    const exit = script.exitCode === undefined ? "" : ` exit=${script.exitCode}`;
    return `${script.judgeId}/${script.name}: ${script.status}${exit}`;
  });
}

function selectJudges(config: JudgesConfig, judgeIds?: string[]): JudgeDefinition[] {
  const selected = new Set(judgeIds?.map((id) => id.trim()).filter(Boolean));
  return config.judges.filter((judge) => judge.enabled && (selected.size === 0 || selected.has(judge.id)));
}

export class JudgesService {
  private state: JudgesState = createInitialState();

  constructor(private readonly pi: ExtensionAPI) {}

  replaceState(state: JudgesState): void {
    this.state = state;
  }

  getState(): JudgesState {
    return this.state;
  }

  getStateSnapshot(): JudgesState {
    return cloneState(this.state);
  }

  setActiveSpec(spec: string | undefined, ctx?: ExtensionContext): void {
    const normalized = spec?.trim();
    if (!normalized) return;
    this.state.activeSpec = normalized;
    this.state.activeSpecStartedAt = new Date().toISOString();
    if (ctx) this.persistState();
  }

  clear(ctx: ExtensionContext): void {
    this.state = createInitialState();
    this.persistState();
    clearJudgesUi(ctx);
  }

  private persistState(): void {
    persistJudgesState(this.pi, this.state);
  }

  async loadConfig(ctx: ExtensionContext): Promise<JudgesConfig> {
    return loadJudgesConfig(ctx.cwd);
  }

  async evaluate(ctx: ExtensionContext, input: JudgesEvaluationInput, signal?: AbortSignal): Promise<JudgesEvaluationResult> {
    const config = await this.loadConfig(ctx);
    const spec = input.spec.trim() || this.state.activeSpec?.trim() || "";
    const resultText = input.result.trim();

    if (!config.enabled) {
      throw new Error("Judges estão desativados pela configuração.");
    }
    if (!spec) {
      throw new Error("judges_evaluate requer spec ou uma SPEC ativa capturada do prompt inicial.");
    }
    if (!resultText) {
      throw new Error("judges_evaluate requer result com o resultado/evidência a avaliar.");
    }

    const judges = selectJudges(config, input.judgeIds);
    if (judges.length === 0) {
      throw new Error("Nenhum judge habilitado corresponde à seleção solicitada.");
    }

    startJudgesEvaluationUi(ctx, judges.map((judge) => judge.id));

    try {
      const scriptResults = input.runScripts === false ? [] : await runJudgeScripts(this.pi, ctx, config, judges, signal);
      const promptResults = [];
      for (const judge of judges) {
        promptResults.push(await runPromptJudge(ctx, config, judge, spec, resultText, input.evidence, scriptResults, signal));
      }

      const scriptFailures = scriptResults
        .filter((script) => script.status !== "passed")
        .map((script) => `${script.judgeId}/${script.name} não passou (${script.status}${script.error ? `: ${script.error}` : ""}).`);
      const missing = uniqueNonEmpty([...promptResults.flatMap((prompt) => prompt.missing), ...scriptFailures]);
      const checks = uniqueNonEmpty([...promptResults.flatMap((prompt) => prompt.checks), ...summarizeScripts(scriptResults)]);
      const promptPassed = promptResults.every((prompt) => prompt.passed);
      const scriptsPassed = scriptResults.every((script) => script.status === "passed");
      const passed = promptPassed && scriptsPassed;
      const pendingSpec = passed
        ? ""
        : promptResults.find((prompt) => prompt.pendingSpec?.trim())?.pendingSpec?.trim() || fallbackPendingSpec(missing, spec);
      const summary = uniqueNonEmpty(promptResults.map((prompt) => prompt.summary)).join("\n") ||
        (passed ? "Todos os judges aprovaram a entrega." : "A entrega tem pendências contra a SPEC.");
      const hasErrors = promptResults.some((prompt) => prompt.status === "error") || scriptResults.some((script) => script.status === "error");

      const evaluation: JudgesEvaluationResult = {
        id: createEvaluationId(),
        passed,
        status: passed ? "passed" : hasErrors ? "error" : "failed",
        source: input.source,
        spec,
        result: resultText,
        summary,
        missing,
        pendingSpec,
        promptResults,
        scriptResults,
        checks,
        createdAt: new Date().toISOString(),
      };

      this.state.activeSpec = spec;
      this.state.lastResult = evaluation;
      this.persistState();
      this.pi.events.emit("aicoders:judges:evaluated", evaluation);
      finishJudgesEvaluationUi(ctx, evaluation);

      return evaluation;
    } catch (error) {
      failJudgesEvaluationUi(ctx, error);
      throw error;
    }
  }

  shouldAutoEvaluate(config: JudgesConfig, assistantText: string): boolean {
    if (!config.enabled || !config.auto.enabled || config.auto.mode === "off") return false;
    if (!this.state.activeSpec?.trim()) return false;
    if (this.state.lastResult?.passed && this.state.lastResult.spec === this.state.activeSpec) return false;
    if (config.auto.mode === "always") return true;

    return config.auto.completionPatterns.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(assistantText);
      } catch {
        return false;
      }
    });
  }
}
