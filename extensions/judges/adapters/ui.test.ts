import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { clearJudgesUi, failJudgesEvaluationUi, finishJudgesEvaluationUi, startJudgesEvaluationUi } from "./ui.ts";
import { appendPassBadge, formatAssistantFailureReplacement, formatConfig, formatEvaluationResult } from "../domain/format.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { JudgesEvaluationResult } from "../domain/types.ts";

type Call = { method: string; args: unknown[] };

const FORBIDDEN_ICON_PATTERN = /[\u2696\u2705\u26A0\u274C\u2713\u2717\u23ED\u23F8]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function assertNoIcons(text: string): void {
  assert.doesNotMatch(text, FORBIDDEN_ICON_PATTERN);
  assert.doesNotMatch(text, /(^|\s)X(\s|$)/);
}

function createCtx(): ExtensionContext & { calls: Call[] } {
  const calls: Call[] = [];
  const ui = {
    theme: {
      fg: (color: string, text: string) => `[${color}]${text}`,
      bg: (color: string, text: string) => `[bg:${color}]${text}`,
    },
    setStatus: (...args: unknown[]) => calls.push({ method: "setStatus", args }),
    setWidget: (...args: unknown[]) => calls.push({ method: "setWidget", args }),
    setWorkingVisible: (...args: unknown[]) => calls.push({ method: "setWorkingVisible", args }),
    setWorkingMessage: (...args: unknown[]) => calls.push({ method: "setWorkingMessage", args }),
    setWorkingIndicator: (...args: unknown[]) => calls.push({ method: "setWorkingIndicator", args }),
  };

  return { hasUI: true, ui, calls } as unknown as ExtensionContext & { calls: Call[] };
}

function lastCall(ctx: { calls: Call[] }, method: string): Call | undefined {
  return ctx.calls.filter((call) => call.method === method).at(-1);
}

function sampleResult(overrides: Partial<JudgesEvaluationResult> = {}): JudgesEvaluationResult {
  return {
    id: "judge-test",
    passed: true,
    status: "passed",
    source: "tool",
    spec: "SPEC",
    result: "RESULT",
    summary: "Resumo validado.",
    missing: [],
    pendingSpec: "",
    promptResults: [],
    scriptResults: [],
    checks: [],
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

{
  const ctx = createCtx();
  startJudgesEvaluationUi(ctx, ["spec-compliance"]);

  assert.deepEqual(lastCall(ctx, "setWorkingVisible")?.args, [false]);
  assert.match(String(lastCall(ctx, "setWorkingMessage")?.args[0]), /Etapa de validação iniciada pelo juiz/);
  assert.deepEqual(lastCall(ctx, "setStatus")?.args[0], "judges");

  const widget = lastCall(ctx, "setWidget")?.args[1] as string[];
  assert.ok(widget.some((line) => line.includes("Etapa de validação iniciada pelo juiz")));
  assert.ok(widget.some((line) => line.includes("UI tradicional oculta")));
  assertNoIcons([String(lastCall(ctx, "setStatus")?.args[1]), String(lastCall(ctx, "setWorkingMessage")?.args[0]), ...widget].join("\n"));
}

{
  const ctx = createCtx();
  finishJudgesEvaluationUi(ctx, sampleResult());

  assert.deepEqual(ctx.calls.filter((call) => call.method === "setWorkingMessage").at(-1)?.args, []);
  assert.deepEqual(ctx.calls.filter((call) => call.method === "setWorkingIndicator").at(-1)?.args, []);
  assert.deepEqual(lastCall(ctx, "setWorkingVisible")?.args, [true]);
  assert.match(String(lastCall(ctx, "setStatus")?.args[1]), /aprovado/);
  assertNoIcons([String(lastCall(ctx, "setStatus")?.args[1]), ...((lastCall(ctx, "setWidget")?.args[1] as string[]) ?? [])].join("\n"));
}

{
  const ctx = createCtx();
  finishJudgesEvaluationUi(ctx, sampleResult({ passed: false, status: "failed", summary: "Pendências." }));

  assert.deepEqual(lastCall(ctx, "setWorkingVisible")?.args, [true]);
  assert.match(String(lastCall(ctx, "setStatus")?.args[1]), /pendente/);
  assert.ok((lastCall(ctx, "setWidget")?.args[1] as string[]).some((line) => line.includes("pendências")));
  assertNoIcons([String(lastCall(ctx, "setStatus")?.args[1]), ...((lastCall(ctx, "setWidget")?.args[1] as string[]) ?? [])].join("\n"));
}

{
  const ctx = createCtx();
  failJudgesEvaluationUi(ctx, new Error("boom"));

  assert.deepEqual(lastCall(ctx, "setWorkingVisible")?.args, [true]);
  assert.match(String(lastCall(ctx, "setStatus")?.args[1]), /erro/);
  assert.ok((lastCall(ctx, "setWidget")?.args[1] as string[]).some((line) => line.includes("boom")));
  assertNoIcons([String(lastCall(ctx, "setStatus")?.args[1]), ...((lastCall(ctx, "setWidget")?.args[1] as string[]) ?? [])].join("\n"));
}

{
  const ctx = createCtx();
  clearJudgesUi(ctx);

  assert.deepEqual(lastCall(ctx, "setWorkingVisible")?.args, [true]);
  assert.deepEqual(lastCall(ctx, "setStatus")?.args, ["judges", undefined]);
  assert.deepEqual(lastCall(ctx, "setWidget")?.args, ["judges", undefined]);
}

{
  const source = readFileSync(new URL("../application/register-tool.ts", import.meta.url), "utf8");
  assert.match(source, /renderShell:\s*"self"/);
  assert.match(source, /Etapa de validação iniciada pelo juiz/);
  assertNoIcons(source);
}

{
  const passed = sampleResult({
    promptResults: [{
      judgeId: "spec-compliance",
      status: "passed",
      passed: true,
      summary: "ok",
      missing: [],
      checks: ["check"],
    }],
    scriptResults: [{
      judgeId: "spec-compliance",
      name: "script",
      command: "npm test",
      status: "passed",
      stdout: "",
      stderr: "",
      durationMs: 1,
      truncated: false,
    }],
  });
  const failed = sampleResult({ passed: false, status: "failed", missing: ["pendência"], pendingSpec: "corrigir" });
  const config = {
    enabled: true,
    maxTokens: 1000,
    failOnJudgeError: true,
    allowScripts: false,
    confirmScripts: true,
    model: undefined,
    configPaths: [],
    loadedConfigPaths: [],
    auto: { enabled: true, mode: "claim", onFail: "replace", onPass: "silent", completionPatterns: [] },
    judges: [{ id: "spec-compliance", enabled: true, scripts: [] }],
  } as const;

  assertNoIcons(formatEvaluationResult(passed));
  assertNoIcons(formatEvaluationResult(failed));
  assertNoIcons(formatConfig(config));
  assertNoIcons(formatAssistantFailureReplacement(failed));
  assertNoIcons(appendPassBadge("texto", passed));
}

console.log("judges ui tests ok");
