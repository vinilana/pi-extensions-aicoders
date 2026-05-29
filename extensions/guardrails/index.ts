/**
 * AICoders Guardrails Extension
 *
 * Solicita permissão explícita antes de ações sensíveis:
 * - acessar arquivos .env/.env.* (exceto .env.example);
 * - escrever em dist/build/coverage/node_modules/.git;
 * - executar comandos destrutivos como rm, sudo, chmod/chown,
 *   git clean/reset, redirecionamentos e mutações de dependências.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { evaluateShellCommand, evaluateToolCall, formatDecision, type GuardDecision } from "./rules.ts";

type PermissionChoice = "once" | "always" | "deny";

type PermissionContext = {
  hasUI: boolean;
  ui: {
    select(
      message: string,
      options: string[],
      dialogOptions?: { timeout?: number; signal?: AbortSignal },
    ): Promise<string | undefined>;
    notify(message: string, level?: "info" | "warning" | "error"): void;
  };
};

type RememberedPermission = {
  key: string;
  subject: string;
  reasonLabels: string[];
  createdAt: string;
};

type GuardrailsMemoryData =
  | { version: 1; action: "allow"; permission: RememberedPermission }
  | { version: 1; action: "clear"; createdAt: string };

const GUARDRAILS_MEMORY_TYPE = "aicoders-guardrails-memory";
const PERMISSION_OPTIONS = {
  once: "Permitir uma vez",
  always: "Sempre permitir esta ação",
  deny: "Bloquear",
} as const;

const SYSTEM_PROMPT_APPENDIX = `

## Guardrails AICoders ativos
- Não acesse nem altere arquivos .env/.env.* sem permissão explícita; .env.example é a única exceção liberada por padrão.
- Não edite diretórios gerados ou internos como dist/, build/, coverage/, node_modules/ ou .git/ sem permissão explícita.
- Comandos destrutivos ou sensíveis como rm, rmdir, find -delete, sudo, chmod/chown, git clean/reset/restore, redirecionamentos de escrita, builds com emissão e mutações de dependências exigem permissão explícita.
- Ao confirmar uma ação, o usuário pode permitir uma vez ou escolher "Sempre permitir" para lembrar a mesma ação sensível nesta sessão.
- Se um guardrail bloquear uma ação, explique o motivo ao usuário e aguarde autorização antes de tentar novamente.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isRememberedPermission(value: unknown): value is RememberedPermission {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    typeof value.subject === "string" &&
    typeof value.createdAt === "string" &&
    Array.isArray(value.reasonLabels) &&
    value.reasonLabels.every((label) => typeof label === "string")
  );
}

function decisionKey(decision: GuardDecision): string {
  const reasons = decision.reasons
    .map((reason) => ({ code: reason.code, evidence: reason.evidence ?? "" }))
    .sort((left, right) => `${left.code}\0${left.evidence}`.localeCompare(`${right.code}\0${right.evidence}`));

  return JSON.stringify({ subject: decision.subject, reasons });
}

function rememberablePermission(decision: GuardDecision): RememberedPermission {
  return {
    key: decisionKey(decision),
    subject: decision.subject,
    reasonLabels: decision.reasons.map((reason) =>
      reason.evidence ? `${reason.label}: ${reason.evidence}` : reason.label,
    ),
    createdAt: new Date().toISOString(),
  };
}

function restoreRememberedPermissions(
  entries: Array<{ type: string; customType?: string; data?: unknown }>,
): Map<string, RememberedPermission> {
  const permissions = new Map<string, RememberedPermission>();

  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== GUARDRAILS_MEMORY_TYPE || !isRecord(entry.data)) continue;
    if (entry.data.version !== 1) continue;

    if (entry.data.action === "clear") {
      permissions.clear();
      continue;
    }

    if (entry.data.action === "allow" && isRememberedPermission(entry.data.permission)) {
      permissions.set(entry.data.permission.key, entry.data.permission);
    }
  }

  return permissions;
}

async function askExplicitPermission(decision: GuardDecision, ctx: PermissionContext): Promise<PermissionChoice> {
  if (!ctx.hasUI) return "deny";

  const choice = await ctx.ui.select(
    `Guardrails: permissão explícita\n\n${formatDecision(decision)}\n\nComo deseja proceder?`,
    [PERMISSION_OPTIONS.once, PERMISSION_OPTIONS.always, PERMISSION_OPTIONS.deny],
  );

  if (choice === PERMISSION_OPTIONS.once) {
    ctx.ui.notify("Guardrails: ação liberada uma vez.", "warning");
    return "once";
  }

  if (choice === PERMISSION_OPTIONS.always) {
    return "always";
  }

  return "deny";
}

async function blockUnlessApproved(
  decision: GuardDecision | undefined,
  ctx: PermissionContext,
  rememberPermission: (decision: GuardDecision) => RememberedPermission,
  rememberedPermissions: Map<string, RememberedPermission>,
) {
  if (!decision) return undefined;

  if (rememberedPermissions.has(decisionKey(decision))) return undefined;

  const choice = await askExplicitPermission(decision, ctx);
  if (choice === "once") return undefined;

  if (choice === "always") {
    const permission = rememberPermission(decision);
    ctx.ui.notify(
      `Guardrails: ação lembrada para sempre nesta sessão. Use /guardrails clear para limpar.\n${permission.subject}`,
      "warning",
    );
    return undefined;
  }

  return {
    block: true,
    reason: `Bloqueado pelos guardrails: permissão explícita não concedida. ${formatDecision(decision)}`,
  };
}

function blockedUserBashResult(decision: GuardDecision) {
  return {
    result: {
      output: `Bloqueado pelos guardrails: permissão explícita não concedida.\n\n${formatDecision(decision)}`,
      exitCode: 1,
      cancelled: false,
      truncated: false,
    },
  };
}

function guardrailsSummary(rememberedCount: number): string {
  return [
    "Guardrails ativos:",
    "- .env/.env.* protegidos; .env.example liberado.",
    "- Escrita em dist/build/coverage/node_modules/.git pede permissão.",
    "- rm, sudo, chmod/chown, git clean/reset, redirecionamentos, builds e mutações de dependências pedem permissão.",
    '- A confirmação permite "Permitir uma vez", "Sempre permitir esta ação" ou "Bloquear".',
    `- Permissões lembradas nesta sessão: ${rememberedCount}.`,
    "- Use /guardrails list para listar e /guardrails clear para limpar permissões lembradas.",
    "- Sem UI para confirmar e sem permissão lembrada, a ação é bloqueada por padrão.",
  ].join("\n");
}

function formatRememberedPermissions(rememberedPermissions: Map<string, RememberedPermission>): string {
  if (rememberedPermissions.size === 0) {
    return "Guardrails: nenhuma permissão lembrada nesta sessão.";
  }

  const lines = ["Permissões lembradas pelos guardrails:"];
  let index = 1;
  for (const permission of rememberedPermissions.values()) {
    lines.push(
      `${index}. ${permission.subject}`,
      `   Motivos: ${permission.reasonLabels.join(", ")}`,
      `   Criada em: ${permission.createdAt}`,
    );
    index += 1;
  }
  lines.push("Use /guardrails clear para limpar todas.");
  return lines.join("\n");
}

export default function aicodersGuardrailsExtension(pi: ExtensionAPI): void {
  let rememberedPermissions = new Map<string, RememberedPermission>();

  const restoreMemoryFromSession = (ctx: { sessionManager: { getBranch(): unknown[] } }) => {
    rememberedPermissions = restoreRememberedPermissions(
      ctx.sessionManager.getBranch() as Array<{ type: string; customType?: string; data?: unknown }>,
    );
  };

  const rememberPermission = (decision: GuardDecision): RememberedPermission => {
    const permission = rememberablePermission(decision);
    rememberedPermissions.set(permission.key, permission);
    pi.appendEntry(GUARDRAILS_MEMORY_TYPE, {
      version: 1,
      action: "allow",
      permission,
    } satisfies GuardrailsMemoryData);
    return permission;
  };

  pi.on("session_start", async (_event, ctx) => {
    restoreMemoryFromSession(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreMemoryFromSession(ctx);
  });

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}${SYSTEM_PROMPT_APPENDIX}`,
    message: {
      customType: "aicoders-guardrails-context",
      content: "Guardrails AICoders ativos para .env, dist e comandos destrutivos, com opção de lembrar permissões por ação.",
      display: false,
    },
  }));

  pi.on("tool_call", async (event, ctx) =>
    blockUnlessApproved(evaluateToolCall(event.toolName, event.input), ctx, rememberPermission, rememberedPermissions),
  );

  pi.on("user_bash", async (event, ctx) => {
    const decision = evaluateShellCommand(event.command);
    if (!decision) return undefined;

    const result = await blockUnlessApproved(decision, ctx, rememberPermission, rememberedPermissions);
    if (!result) return undefined;

    return blockedUserBashResult(decision);
  });

  pi.registerCommand("guardrails", {
    description: "Mostra as regras de segurança e permissões lembradas dos guardrails AICoders",
    handler: async (args, ctx) => {
      const command = args.trim().toLowerCase();

      if (["list", "listar", "permissoes", "permissões", "permissions"].includes(command)) {
        ctx.ui.notify(formatRememberedPermissions(rememberedPermissions), "info");
        return;
      }

      if (["clear", "limpar", "reset"].includes(command)) {
        const clearedCount = rememberedPermissions.size;
        rememberedPermissions.clear();
        pi.appendEntry(GUARDRAILS_MEMORY_TYPE, {
          version: 1,
          action: "clear",
          createdAt: new Date().toISOString(),
        } satisfies GuardrailsMemoryData);
        ctx.ui.notify(`Guardrails: ${clearedCount} permissões lembradas foram limpas.`, "warning");
        return;
      }

      if (command) {
        ctx.ui.notify("Uso: /guardrails [list|clear]", "warning");
        return;
      }

      ctx.ui.notify(guardrailsSummary(rememberedPermissions.size), "info");
    },
  });
}
