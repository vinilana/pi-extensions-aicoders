export type JudgeStatus = "passed" | "failed" | "error" | "skipped";
export type AutoJudgeMode = "off" | "claim" | "always";
export type AutoFailAction = "replace" | "followUp" | "reportOnly";
export type AutoPassAction = "silent" | "append";

export interface JudgesAutoConfig {
  enabled: boolean;
  mode: AutoJudgeMode;
  onFail: AutoFailAction;
  onPass: AutoPassAction;
  completionPatterns: string[];
}

export interface JudgeScriptDefinition {
  name?: string;
  command: string;
  timeoutMs?: number;
}

export interface JudgeDefinition {
  id: string;
  description?: string;
  enabled: boolean;
  prompt?: string;
  promptFile?: string;
  scripts: JudgeScriptDefinition[];
}

export interface JudgesConfig {
  enabled: boolean;
  model?: string;
  maxTokens: number;
  failOnJudgeError: boolean;
  allowScripts: boolean;
  confirmScripts: boolean;
  auto: JudgesAutoConfig;
  judges: JudgeDefinition[];
  configPaths: string[];
  loadedConfigPaths: string[];
}

export interface ScriptRunResult {
  judgeId: string;
  name: string;
  command: string;
  status: JudgeStatus;
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  error?: string;
}

export interface PromptJudgeResult {
  judgeId: string;
  status: JudgeStatus;
  passed: boolean;
  confidence?: number;
  summary: string;
  missing: string[];
  checks: string[];
  pendingSpec?: string;
  rawOutput?: string;
  error?: string;
}

export interface JudgesEvaluationInput {
  spec: string;
  result: string;
  evidence?: string;
  judgeIds?: string[];
  runScripts?: boolean;
  source: "tool" | "auto" | "command" | "extension";
}

export interface JudgesEvaluationResult {
  id: string;
  passed: boolean;
  status: JudgeStatus;
  source: JudgesEvaluationInput["source"];
  spec: string;
  result: string;
  summary: string;
  missing: string[];
  pendingSpec: string;
  promptResults: PromptJudgeResult[];
  scriptResults: ScriptRunResult[];
  checks: string[];
  createdAt: string;
}

export interface JudgesState {
  activeSpec?: string;
  activeSpecStartedAt?: string;
  lastResult?: JudgesEvaluationResult;
}
