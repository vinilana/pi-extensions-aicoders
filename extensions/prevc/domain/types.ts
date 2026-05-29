export type Stage = "idle" | "P" | "R" | "E" | "V" | "C" | "done";
export type PhaseStatus = "pending" | "executing" | "executed" | "validated" | "confirmed";

export interface WorkflowPhase {
  id: number;
  title: string;
  status: PhaseStatus;
  executeEvidence?: string;
  validateEvidence?: string;
  confirmEvidence?: string;
  checks?: string[];
  commitHash?: string;
}

export interface WorkflowState {
  enabled: boolean;
  stage: Stage;
  summary: string;
  phases: WorkflowPhase[];
  currentIndex: number;
  startedAt?: string;
  completedAt?: string;
}

export type WorkflowToolAction = "status" | "set_plan" | "mark_executed" | "mark_validated" | "mark_confirmed";

export interface WorkflowToolParams {
  action: WorkflowToolAction;
  summary?: string;
  phases?: string[];
  evidence?: string;
  passed?: boolean;
  checks?: string[];
  commit?: boolean;
  commitMessage?: string;
}
