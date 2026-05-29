import type { WorkflowState } from "../domain/types.ts";

interface ToolCallLike {
  toolName: string;
  input: unknown;
}

function commandHead(command: string): string {
  return command.trim().split(/\s+/)[0] ?? "";
}

export function isReadOnlyCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return true;
  if (/[;&|]\s*(rm|mv|cp|mkdir|touch|chmod|chown|sed\s+-i|perl\s+-pi|tee)\b/i.test(trimmed)) return false;
  if (/(^|\s)(>|>>)(\s|$)/.test(trimmed)) return false;

  const head = commandHead(trimmed);
  const readOnlyHeads = new Set([
    "cat",
    "head",
    "tail",
    "less",
    "more",
    "grep",
    "rg",
    "find",
    "fd",
    "ls",
    "pwd",
    "tree",
    "wc",
    "sort",
    "uniq",
    "cut",
    "awk",
    "jq",
    "git",
    "npm",
    "pnpm",
    "yarn",
    "node",
    "python",
    "python3",
    "date",
    "whoami",
    "uname",
  ]);
  if (!readOnlyHeads.has(head)) return false;

  if (head === "git") {
    return /^git\s+(status|log|diff|show|branch|grep|ls-files|rev-parse)\b/i.test(trimmed);
  }
  if (["npm", "pnpm", "yarn"].includes(head)) {
    return /\b(run\s+)?(test|typecheck|lint|build|list|outdated|info)\b/i.test(trimmed) && !/\b(add|install|remove|unlink|publish)\b/i.test(trimmed);
  }

  return true;
}

export function isMutatingShellCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  return (
    /(^|[;&|]\s*)(rm|mv|cp|mkdir|touch|chmod|chown|sed\s+-i|perl\s+-pi|tee)\b/i.test(trimmed) ||
    /(^|\s)(>|>>)(\s|$)/.test(trimmed) ||
    /\bgit\s+(add|commit|push|checkout|switch|reset|rebase|merge|tag|stash|clean|restore)\b/i.test(trimmed) ||
    /\b(npm|pnpm|yarn)\s+(install|add|remove|unlink|publish)\b/i.test(trimmed) ||
    /\bsudo\b/i.test(trimmed)
  );
}

export function isCommitStageCommand(command: string): boolean {
  return /^git\s+(status|diff|add|commit|rev-parse)\b/i.test(command.trim());
}

export function evaluateToolCall(state: WorkflowState, event: ToolCallLike): { block: true; reason: string } | undefined {
  if (!state.enabled) return undefined;

  if ((state.stage === "P" || state.stage === "R") && ["edit", "write"].includes(event.toolName)) {
    return { block: true, reason: `PREVC ${state.stage}: alterações são bloqueadas até o plano ser aprovado.` };
  }

  if ((state.stage === "V" || state.stage === "C") && ["edit", "write"].includes(event.toolName)) {
    return { block: true, reason: `PREVC ${state.stage}: edição bloqueada; esta etapa é de validação/confirmação.` };
  }

  if (event.toolName !== "bash") return undefined;
  const command = String((event.input as { command?: unknown }).command ?? "");

  if ((state.stage === "P" || state.stage === "R") && !isReadOnlyCommand(command)) {
    return { block: true, reason: `PREVC ${state.stage}: comando não permitido na etapa de planejamento/revisão: ${command}` };
  }

  if (state.stage === "E" && /\bgit\s+(commit|tag|push)\b/i.test(command)) {
    return { block: true, reason: "PREVC E: commit/tag/push só são permitidos na etapa C." };
  }

  if (state.stage === "V" && isMutatingShellCommand(command)) {
    return { block: true, reason: `PREVC V: comando mutável bloqueado durante validação: ${command}` };
  }

  if (state.stage === "C" && isMutatingShellCommand(command) && !isCommitStageCommand(command)) {
    return { block: true, reason: `PREVC C: somente comandos de status/diff/add/commit são permitidos para confirmação: ${command}` };
  }

  return undefined;
}
