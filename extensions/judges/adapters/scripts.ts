import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateTail } from "@earendil-works/pi-coding-agent";
import type { JudgeDefinition, JudgesConfig, ScriptRunResult } from "../domain/types.ts";

function truncateOutput(text: string): { text: string; truncated: boolean } {
  const result = truncateTail(text, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
  return { text: result.content, truncated: result.truncated };
}

function skippedScript(judgeId: string, name: string, command: string, reason: string): ScriptRunResult {
  return {
    judgeId,
    name,
    command,
    status: "skipped",
    stdout: "",
    stderr: "",
    durationMs: 0,
    truncated: false,
    error: reason,
  };
}

async function confirmScriptsIfNeeded(config: JudgesConfig, scripts: Array<{ judgeId: string; name: string; command: string }>, ctx: ExtensionContext): Promise<boolean> {
  if (!config.confirmScripts || scripts.length === 0) return true;
  if (!ctx.hasUI) return false;

  const preview = scripts.map((script) => `- ${script.judgeId}/${script.name}: ${script.command}`).join("\n");
  return ctx.ui.confirm(
    "Judges: executar scripts configurados?",
    `Scripts definidos em configuração local/global podem executar comandos no seu projeto.\n\n${preview}\n\nPermitir esta execução agora?`,
  );
}

export async function runJudgeScripts(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: JudgesConfig,
  judges: JudgeDefinition[],
  signal?: AbortSignal,
): Promise<ScriptRunResult[]> {
  const scripts = judges.flatMap((judge) =>
    judge.scripts.map((script, index) => ({
      judgeId: judge.id,
      name: script.name ?? `script-${index + 1}`,
      command: script.command,
      timeoutMs: script.timeoutMs,
    })),
  );

  if (scripts.length === 0) return [];

  if (!config.allowScripts) {
    return scripts.map((script) => skippedScript(script.judgeId, script.name, script.command, "Scripts bloqueados: defina allowScripts=true na configuração dos judges."));
  }

  const approved = await confirmScriptsIfNeeded(config, scripts, ctx);
  if (!approved) {
    return scripts.map((script) => skippedScript(script.judgeId, script.name, script.command, "Execução de scripts não aprovada pelo usuário ou sem UI disponível."));
  }

  const results: ScriptRunResult[] = [];
  for (const script of scripts) {
    const startedAt = Date.now();
    try {
      const result = await pi.exec("bash", ["-lc", script.command], {
        signal,
        timeout: script.timeoutMs,
      });
      const stdout = truncateOutput(result.stdout ?? "");
      const stderr = truncateOutput(result.stderr ?? "");
      const status = result.code === 0 ? "passed" : "failed";
      results.push({
        judgeId: script.judgeId,
        name: script.name,
        command: script.command,
        status,
        exitCode: result.code,
        stdout: stdout.text,
        stderr: stderr.text,
        durationMs: Date.now() - startedAt,
        truncated: stdout.truncated || stderr.truncated,
        error: result.killed ? "Processo encerrado por timeout/abort." : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        judgeId: script.judgeId,
        name: script.name,
        command: script.command,
        status: "error",
        stdout: "",
        stderr: "",
        durationMs: Date.now() - startedAt,
        truncated: false,
        error: message,
      });
    }
  }

  return results;
}
