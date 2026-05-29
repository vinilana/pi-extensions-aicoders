import type { WorkflowPhase, WorkflowState } from "./types.ts";

export function createInitialState(): WorkflowState {
  return {
    enabled: false,
    stage: "idle",
    summary: "",
    phases: [],
    currentIndex: 0,
  };
}

export function cloneState(state: WorkflowState): WorkflowState {
  return {
    ...state,
    phases: state.phases.map((phase) => ({ ...phase, checks: phase.checks ? [...phase.checks] : undefined })),
  };
}

export function normalizePhaseTitle(title: string): string {
  return title.replace(/^\s*[-*\d.)]+\s*/, "").trim();
}

export function currentPhase(state: WorkflowState): WorkflowPhase | undefined {
  return state.phases[state.currentIndex];
}

export function uniqueTools(tools: string[]): string[] {
  return [...new Set(tools.filter(Boolean))];
}
