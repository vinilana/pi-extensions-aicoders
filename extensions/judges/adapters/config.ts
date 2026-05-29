import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { DEFAULT_COMPLETION_PATTERNS, DEFAULT_JUDGE_PROMPT } from "../domain/constants.ts";
import type { JudgeDefinition, JudgesAutoConfig, JudgesConfig, JudgeScriptDefinition } from "../domain/types.ts";

type RawConfig = Record<string, unknown>;

type LoadedRawConfig = {
  path: string;
  dir: string;
  cwd: string;
  data: RawConfig;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeScript(value: unknown): JudgeScriptDefinition | undefined {
  if (!isRecord(value)) return undefined;
  const command = asString(value.command);
  if (!command) return undefined;
  return {
    name: asString(value.name),
    command,
    timeoutMs: asNumber(value.timeoutMs),
  };
}

function normalizeJudge(value: unknown, index: number): JudgeDefinition | undefined {
  if (!isRecord(value)) return undefined;
  const id = asString(value.id) ?? `judge-${index + 1}`;
  const scripts = Array.isArray(value.scripts) ? value.scripts.map(normalizeScript).filter((item): item is JudgeScriptDefinition => Boolean(item)) : [];

  return {
    id,
    description: asString(value.description),
    enabled: asBoolean(value.enabled) ?? true,
    prompt: asString(value.prompt),
    promptFile: asString(value.promptFile),
    scripts,
  };
}

function mergeAuto(base: JudgesAutoConfig, value: unknown): JudgesAutoConfig {
  if (typeof value === "boolean") return { ...base, enabled: value };
  if (!isRecord(value)) return base;

  const mode = asString(value.mode);
  const onFail = asString(value.onFail);
  const onPass = asString(value.onPass);
  return {
    enabled: asBoolean(value.enabled) ?? base.enabled,
    mode: mode === "off" || mode === "claim" || mode === "always" ? mode : base.mode,
    onFail: onFail === "replace" || onFail === "followUp" || onFail === "reportOnly" ? onFail : base.onFail,
    onPass: onPass === "silent" || onPass === "append" ? onPass : base.onPass,
    completionPatterns: asStringArray(value.completionPatterns) ?? base.completionPatterns,
  };
}

function createDefaultConfig(cwd: string): JudgesConfig {
  const configPaths = [
    path.join(os.homedir(), ".pi", "agent", "judges.json"),
    path.join(cwd, ".pi", "judges.json"),
    path.join(cwd, "judges.config.json"),
  ];

  return {
    enabled: true,
    maxTokens: DEFAULT_MAX_TOKENS,
    failOnJudgeError: true,
    allowScripts: false,
    confirmScripts: true,
    auto: {
      enabled: true,
      mode: "claim",
      onFail: "followUp",
      onPass: "silent",
      completionPatterns: [...DEFAULT_COMPLETION_PATTERNS],
    },
    judges: [
      {
        id: "spec-compliance",
        description: "Compara a SPEC inicial com o resultado declarado e gera SPEC pendente quando houver lacunas.",
        enabled: true,
        prompt: DEFAULT_JUDGE_PROMPT,
        scripts: [],
      },
    ],
    configPaths,
    loadedConfigPaths: [],
  };
}

async function readRawConfig(filePath: string, cwd: string): Promise<LoadedRawConfig | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) return undefined;
    return { path: filePath, dir: path.dirname(filePath), cwd, data: parsed };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

async function readPromptFile(configDir: string, cwd: string, promptFile: string): Promise<string | undefined> {
  const candidates = path.isAbsolute(promptFile)
    ? [promptFile]
    : [path.join(configDir, promptFile), path.join(cwd, promptFile)];

  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return content.trim() || undefined;
    } catch {
      // Try next candidate.
    }
  }

  return undefined;
}

async function applyRawConfig(base: JudgesConfig, loaded: LoadedRawConfig): Promise<JudgesConfig> {
  const data = loaded.data;
  const next: JudgesConfig = {
    ...base,
    auto: { ...base.auto, completionPatterns: [...base.auto.completionPatterns] },
    judges: base.judges.map((judge) => ({ ...judge, scripts: [...judge.scripts] })),
    loadedConfigPaths: [...base.loadedConfigPaths, loaded.path],
  };

  next.enabled = asBoolean(data.enabled) ?? next.enabled;
  next.model = asString(data.model) ?? next.model;
  next.maxTokens = asNumber(data.maxTokens) ?? next.maxTokens;
  next.failOnJudgeError = asBoolean(data.failOnJudgeError) ?? next.failOnJudgeError;
  next.allowScripts = asBoolean(data.allowScripts) ?? next.allowScripts;
  next.confirmScripts = asBoolean(data.confirmScripts) ?? next.confirmScripts;
  next.auto = mergeAuto(next.auto, data.auto);

  if (Array.isArray(data.judges)) {
    const judges = data.judges.map(normalizeJudge).filter((judge): judge is JudgeDefinition => Boolean(judge));
    next.judges = await Promise.all(
      judges.map(async (judge) => ({
        ...judge,
        prompt: judge.prompt ?? (judge.promptFile ? await readPromptFile(loaded.dir, loaded.cwd, judge.promptFile) : undefined) ?? DEFAULT_JUDGE_PROMPT,
        scripts: judge.scripts.map((script, index) => ({
          ...script,
          name: script.name ?? `script-${index + 1}`,
          timeoutMs: script.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        })),
      })),
    );
  }

  return next;
}

export async function loadJudgesConfig(cwd: string): Promise<JudgesConfig> {
  let config = createDefaultConfig(cwd);

  for (const configPath of config.configPaths) {
    const loaded = await readRawConfig(configPath, cwd);
    if (!loaded) continue;
    config = await applyRawConfig(config, loaded);
  }

  return config;
}

export function getConfigExample(): string {
  return JSON.stringify(
    {
      enabled: true,
      model: "active",
      allowScripts: true,
      confirmScripts: true,
      auto: { enabled: true, mode: "claim", onFail: "followUp", onPass: "silent" },
      judges: [
        {
          id: "spec-compliance",
          promptFile: ".pi/judges/spec-compliance.md",
          scripts: [{ name: "tests", command: "npm test", timeoutMs: 120000 }],
        },
      ],
    },
    null,
    2,
  );
}
