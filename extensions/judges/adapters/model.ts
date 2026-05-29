import { complete } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { JudgeDefinition, JudgesConfig, PromptJudgeResult, ScriptRunResult } from "../domain/types.ts";

function renderPrompt(template: string, spec: string, result: string, evidence: string): string {
  const hasPlaceholder = /{{\s*(spec|result|evidence)\s*}}/.test(template);
  const rendered = template
    .replace(/{{\s*spec\s*}}/g, spec)
    .replace(/{{\s*result\s*}}/g, result)
    .replace(/{{\s*evidence\s*}}/g, evidence);

  if (hasPlaceholder) return rendered;

  return `${rendered}\n\n<SPEC_INICIAL>\n${spec}\n</SPEC_INICIAL>\n\n<RESULTADO_DECLARADO>\n${result}\n</RESULTADO_DECLARADO>\n\n<EVIDENCIAS_E_SCRIPTS>\n${evidence}\n</EVIDENCIAS_E_SCRIPTS>`;
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1), text].filter(
    (candidate): candidate is string => Boolean(candidate?.trim()),
  );

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("Resposta do judge não contém JSON válido.");
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizePromptResult(judgeId: string, rawOutput: string): PromptJudgeResult {
  const parsed = extractJsonObject(rawOutput) as Record<string, unknown>;
  const passed = parsed.passed === true;
  const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? parsed.confidence : undefined;
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : passed ? "SPEC atendida." : "Há pendências.";
  const missing = toStringArray(parsed.missing);
  const checks = toStringArray(parsed.checks);
  const pendingSpec = typeof parsed.pendingSpec === "string" ? parsed.pendingSpec.trim() : "";

  return {
    judgeId,
    status: passed ? "passed" : "failed",
    passed,
    confidence,
    summary,
    missing,
    checks,
    pendingSpec,
    rawOutput,
  };
}

function formatScriptEvidence(results: ScriptRunResult[]): string {
  if (results.length === 0) return "Nenhum script configurado ou executado.";

  return results
    .map((result) =>
      [
        `Script: ${result.judgeId}/${result.name}`,
        `Status: ${result.status}`,
        `Command: ${result.command}`,
        result.exitCode === undefined ? undefined : `Exit code: ${result.exitCode}`,
        result.error ? `Error: ${result.error}` : undefined,
        result.stdout ? `STDOUT:\n${result.stdout}` : undefined,
        result.stderr ? `STDERR:\n${result.stderr}` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}

function selectModel(ctx: ExtensionContext, config: JudgesConfig) {
  const configured = config.model?.trim();
  if (!configured || configured === "active") return ctx.model;

  const [provider, ...idParts] = configured.split("/");
  const id = idParts.join("/");
  if (provider && id) return ctx.modelRegistry.find(provider, id) ?? ctx.model;

  return ctx.model;
}

export async function runPromptJudge(
  ctx: ExtensionContext,
  config: JudgesConfig,
  judge: JudgeDefinition,
  spec: string,
  result: string,
  evidence: string | undefined,
  scriptResults: ScriptRunResult[],
  signal?: AbortSignal,
): Promise<PromptJudgeResult> {
  const model = selectModel(ctx, config);
  if (!model) {
    return {
      judgeId: judge.id,
      status: "error",
      passed: !config.failOnJudgeError,
      summary: "Nenhum modelo ativo disponível para executar o judge.",
      missing: config.failOnJudgeError ? ["Configurar modelo/API key para o judge ou desativar failOnJudgeError."] : [],
      checks: [],
      pendingSpec: "Configurar um modelo para executar judges por prompt e repetir a validação.",
      error: "missing-model",
    };
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) {
    return {
      judgeId: judge.id,
      status: "error",
      passed: !config.failOnJudgeError,
      summary: auth.ok ? `Sem API key para ${model.provider}.` : `Falha de autenticação: ${auth.error}`,
      missing: config.failOnJudgeError ? ["Resolver autenticação/API key do modelo usado pelos judges."] : [],
      checks: [],
      pendingSpec: "Resolver autenticação do modelo dos judges e repetir a validação.",
      error: auth.ok ? "missing-api-key" : auth.error,
    };
  }

  const scriptEvidence = formatScriptEvidence(scriptResults.filter((script) => script.judgeId === judge.id));
  const prompt = renderPrompt(judge.prompt ?? "", spec, result, [evidence, scriptEvidence].filter(Boolean).join("\n\n"));

  try {
    const response = await complete(
      model,
      {
        messages: [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: prompt }],
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: config.maxTokens,
        signal,
      },
    );

    const rawOutput = response.content
      .filter((content): content is { type: "text"; text: string } => content.type === "text")
      .map((content) => content.text)
      .join("\n")
      .trim();

    return normalizePromptResult(judge.id, rawOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      judgeId: judge.id,
      status: "error",
      passed: !config.failOnJudgeError,
      summary: `Erro ao executar judge: ${message}`,
      missing: config.failOnJudgeError ? [`Judge ${judge.id} não conseguiu validar a SPEC.`] : [],
      checks: [],
      pendingSpec: config.failOnJudgeError ? "Corrigir erro do judge e repetir a validação antes de concluir." : "",
      error: message,
    };
  }
}
