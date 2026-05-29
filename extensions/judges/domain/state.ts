import type { JudgesEvaluationResult, JudgesState } from "./types.ts";

export function createInitialState(): JudgesState {
  return {};
}

export function cloneState(state: JudgesState): JudgesState {
  return {
    activeSpec: state.activeSpec,
    activeSpecStartedAt: state.activeSpecStartedAt,
    lastResult: state.lastResult ? cloneEvaluationResult(state.lastResult) : undefined,
  };
}

export function cloneEvaluationResult(result: JudgesEvaluationResult): JudgesEvaluationResult {
  return {
    ...result,
    missing: [...result.missing],
    promptResults: result.promptResults.map((prompt) => ({
      ...prompt,
      missing: [...prompt.missing],
      checks: [...prompt.checks],
    })),
    scriptResults: result.scriptResults.map((script) => ({ ...script })),
    checks: [...result.checks],
  };
}

export function createEvaluationId(): string {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}
