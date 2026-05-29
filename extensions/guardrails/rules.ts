import { basename, normalize } from "node:path";

export type GuardMode = "read" | "write";

export interface GuardReason {
  code: string;
  label: string;
  detail: string;
  evidence?: string;
}

export interface GuardDecision {
  subject: string;
  reasons: GuardReason[];
}

const GENERATED_DIRS = new Set(["dist", "build", "coverage"]);
const WRITE_PROTECTED_DIRS = new Set(["dist", "build", "coverage", "node_modules", ".git"]);
const PATH_KEYS = new Set([
  "path",
  "paths",
  "file",
  "files",
  "dir",
  "dirs",
  "directory",
  "directories",
  "root",
  "roots",
]);

const DANGEROUS_COMMAND_PATTERNS: Array<{ code: string; label: string; detail: string; pattern: RegExp }> = [
  {
    code: "shell-rm",
    label: "comando de remoção",
    detail: "Comandos rm/rmdir/unlink/shred/trash exigem permissão explícita.",
    pattern: /(^|[;&|\n]\s*)(rm|rmdir|unlink|shred|trash)\b/i,
  },
  {
    code: "shell-find-delete",
    label: "remoção via find",
    detail: "find -delete pode apagar muitos arquivos e exige permissão explícita.",
    pattern: /(^|[;&|\n]\s*)find\b[\s\S]*\s-delete\b/i,
  },
  {
    code: "shell-sudo",
    label: "sudo",
    detail: "Comandos sudo elevam privilégio e exigem permissão explícita.",
    pattern: /(^|[;&|\n]\s*)sudo\b/i,
  },
  {
    code: "shell-permission-change",
    label: "alteração de permissões/dono",
    detail: "chmod/chown/chgrp podem mudar permissões ou dono de arquivos.",
    pattern: /(^|[;&|\n]\s*)(chmod|chown|chgrp)\b/i,
  },
  {
    code: "shell-redirection",
    label: "redirecionamento de escrita",
    detail: "Redirecionamentos > ou >> podem sobrescrever arquivos.",
    pattern: /(^|\s)(>|>>)\s*\S+/i,
  },
  {
    code: "shell-in-place-edit",
    label: "edição in-place",
    detail: "sed -i/perl -pi editam arquivos diretamente.",
    pattern: /(^|[;&|\n]\s*)(sed\s+-i|perl\s+-pi)\b/i,
  },
  {
    code: "shell-git-destructive",
    label: "git destrutivo",
    detail: "git rm/clean/reset/restore/checkout/switch/rebase/merge/push podem alterar, apagar, descartar ou publicar trabalho.",
    pattern: /\bgit\s+(rm|clean|reset|restore|checkout|switch|rebase|merge|push)\b/i,
  },
  {
    code: "shell-package-mutation",
    label: "mutação de dependências",
    detail: "install/i/ci/add/remove/unlink/publish podem alterar dependências, lockfiles ou node_modules.",
    pattern: /\b(npm|pnpm|yarn)\s+(install|i|ci|add|remove|rm|uninstall|unlink|publish)\b/i,
  },
  {
    code: "shell-truncate",
    label: "truncate/dd/mkfs",
    detail: "truncate/dd/mkfs podem destruir ou zerar dados.",
    pattern: /(^|[;&|\n]\s*)(truncate|dd|mkfs)\b/i,
  },
];

const MUTATING_COMMAND_PATTERNS: RegExp[] = [
  /(^|[;&|\n]\s*)(cp|mv|mkdir|touch|ln|tee|truncate)\b/i,
  /(^|[;&|\n]\s*)(sed\s+-i|perl\s+-pi)\b/i,
  /(^|\s)(>|>>)\s*\S+/i,
  /\bgit\s+(add|commit|rm|clean|reset|restore|checkout|switch|rebase|merge|stash|tag|push)\b/i,
  /\b(npm|pnpm|yarn)\s+(install|i|ci|add|remove|rm|uninstall|unlink|publish)\b/i,
  /\b(npm|pnpm|yarn)\s+(run\s+)?build\b/i,
  /\b(vite|rollup|webpack|next)\s+build\b/i,
  /(^|[;&|\n]\s*)tsc\b(?![^;&|\n]*\s--noEmit\b)/i,
];

const GENERATED_OUTPUT_COMMAND_PATTERNS: Array<{ code: string; label: string; detail: string; pattern: RegExp }> = [
  {
    code: "shell-build-output",
    label: "comando de build",
    detail: "Comandos de build normalmente escrevem em dist/build e exigem permissão explícita.",
    pattern: /\b(npm|pnpm|yarn)\s+(run\s+)?build\b/i,
  },
  {
    code: "shell-build-tool",
    label: "ferramenta de build",
    detail: "Ferramentas de build podem recriar dist/build.",
    pattern: /\b(vite|rollup|webpack|next)\s+build\b/i,
  },
  {
    code: "shell-tsc-output",
    label: "tsc com emissão",
    detail: "tsc sem --noEmit pode escrever arquivos gerados.",
    pattern: /(^|[;&|\n]\s*)tsc\b(?![^;&|\n]*\s--noEmit\b)/i,
  },
];

function cleanPathCandidate(raw: string): string | undefined {
  let value = raw.trim();
  if (!value) return undefined;

  const equalsIndex = value.indexOf("=");
  if (value.startsWith("--") && equalsIndex >= 0) {
    value = value.slice(equalsIndex + 1);
  }

  value = value
    .replace(/^[@]+/, "")
    .replace(/^[<>]+/, "")
    .replace(/^[\"'`]+/, "")
    .replace(/[\"'`,;]+$/, "")
    .trim();

  if (!value || value === "-" || value.includes("\0")) return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return undefined;
  return value;
}

function pathSegments(raw: string): string[] {
  const cleaned = cleanPathCandidate(raw);
  if (!cleaned) return [];
  return normalize(cleaned).split(/[\\/]+/).filter(Boolean);
}

function pathBaseName(raw: string): string | undefined {
  const cleaned = cleanPathCandidate(raw);
  if (!cleaned) return undefined;
  const withoutTrailingSlash = cleaned.replace(/[\\/]+$/, "");
  return basename(withoutTrailingSlash);
}

function isProtectedEnvPath(raw: string): boolean {
  const base = pathBaseName(raw);
  if (!base) return false;
  if (base === ".env.example") return false;
  return base === ".env" || base.startsWith(".env.");
}

function hasAnySegment(raw: string, segments: Set<string>): string | undefined {
  return pathSegments(raw).find((segment) => segments.has(segment));
}

function uniqueReasons(reasons: GuardReason[]): GuardReason[] {
  const seen = new Set<string>();
  const unique: GuardReason[] = [];
  for (const reason of reasons) {
    const key = `${reason.code}:${reason.evidence ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(reason);
  }
  return unique;
}

export function classifyPath(rawPath: string, mode: GuardMode): GuardReason[] {
  const cleaned = cleanPathCandidate(rawPath);
  if (!cleaned) return [];

  const reasons: GuardReason[] = [];

  if (isProtectedEnvPath(cleaned)) {
    reasons.push({
      code: "path-env",
      label: "arquivo .env protegido",
      detail: "Arquivos .env/.env.* são sensíveis; somente .env.example é liberado por padrão.",
      evidence: cleaned,
    });
  }

  if (mode === "write") {
    const segment = hasAnySegment(cleaned, WRITE_PROTECTED_DIRS);
    if (segment) {
      const generated = GENERATED_DIRS.has(segment);
      reasons.push({
        code: generated ? "path-generated-output" : "path-protected-dir",
        label: generated ? `diretório gerado ${segment}/` : `diretório protegido ${segment}/`,
        detail: generated
          ? "Diretórios gerados não devem ser editados sem permissão explícita."
          : "Diretórios internos/de dependências não devem ser alterados sem permissão explícita.",
        evidence: cleaned,
      });
    }
  }

  return reasons;
}

function collectPathValues(value: unknown, paths: string[]): void {
  if (typeof value === "string") {
    paths.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectPathValues(item, paths);
  }
}

export function extractToolPaths(toolName: string, input: unknown): string[] {
  if (!input || typeof input !== "object") return [];

  const paths: string[] = [];
  const record = input as Record<string, unknown>;

  if (["read", "write", "edit"].includes(toolName)) {
    collectPathValues(record.path, paths);
    return paths;
  }

  if (["grep", "find", "ls"].includes(toolName)) {
    for (const [key, value] of Object.entries(record)) {
      if (PATH_KEYS.has(key.toLowerCase())) collectPathValues(value, paths);
    }
  }

  return paths;
}

export function tokenizeShell(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | undefined;
  let escaped = false;

  const push = () => {
    if (current) {
      tokens.push(current);
      current = "";
    }
  };

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (/\s/.test(char) || ";|&()".includes(char)) {
      push();
      continue;
    }

    current += char;
  }

  push();
  return tokens;
}

function shellPathCandidates(command: string): string[] {
  const candidates: string[] = [];

  for (const token of tokenizeShell(command)) {
    if (!token || token.startsWith("-")) {
      const equalsIndex = token.indexOf("=");
      if (equalsIndex >= 0) candidates.push(token.slice(equalsIndex + 1));
      continue;
    }

    candidates.push(token);

    const equalsIndex = token.indexOf("=");
    if (equalsIndex >= 0) {
      candidates.push(token.slice(equalsIndex + 1));
    }
  }

  return candidates;
}

export function isLikelyMutatingShellCommand(command: string): boolean {
  return MUTATING_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

export function evaluateShellCommand(command: string): GuardDecision | undefined {
  const reasons: GuardReason[] = [];

  for (const rule of DANGEROUS_COMMAND_PATTERNS) {
    if (rule.pattern.test(command)) {
      reasons.push({ code: rule.code, label: rule.label, detail: rule.detail });
    }
  }

  for (const rule of GENERATED_OUTPUT_COMMAND_PATTERNS) {
    if (rule.pattern.test(command)) {
      reasons.push({ code: rule.code, label: rule.label, detail: rule.detail });
    }
  }

  const pathMode: GuardMode = isLikelyMutatingShellCommand(command) ? "write" : "read";
  for (const candidate of shellPathCandidates(command)) {
    reasons.push(...classifyPath(candidate, pathMode));
  }

  const unique = uniqueReasons(reasons);
  if (unique.length === 0) return undefined;
  return { subject: command.trim(), reasons: unique };
}

export function evaluateToolCall(toolName: string, input: unknown): GuardDecision | undefined {
  if (toolName === "bash") {
    const command = String((input as { command?: unknown } | undefined)?.command ?? "");
    return evaluateShellCommand(command);
  }

  const paths = extractToolPaths(toolName, input);
  if (paths.length === 0) return undefined;

  const mode: GuardMode = ["write", "edit"].includes(toolName) ? "write" : "read";
  const reasons = uniqueReasons(paths.flatMap((path) => classifyPath(path, mode)));
  if (reasons.length === 0) return undefined;

  return { subject: `${toolName} ${paths.join(", ")}`, reasons };
}

export function formatDecision(decision: GuardDecision): string {
  const reasonLines = decision.reasons
    .map((reason) => `- ${reason.label}${reason.evidence ? `: ${reason.evidence}` : ""}\n  ${reason.detail}`)
    .join("\n");

  return `Ação sensível detectada:\n${decision.subject}\n\nMotivos:\n${reasonLines}`;
}
