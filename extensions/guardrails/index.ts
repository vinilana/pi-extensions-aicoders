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

type PermissionContext = {
  hasUI: boolean;
  ui: {
    confirm(title: string, message: string, options?: { timeout?: number; signal?: AbortSignal }): Promise<boolean>;
    notify(message: string, level?: "info" | "warning" | "error"): void;
  };
};

const SYSTEM_PROMPT_APPENDIX = `

## Guardrails AICoders ativos
- Não acesse nem altere arquivos .env/.env.* sem permissão explícita; .env.example é a única exceção liberada por padrão.
- Não edite diretórios gerados ou internos como dist/, build/, coverage/, node_modules/ ou .git/ sem permissão explícita.
- Comandos destrutivos ou sensíveis como rm, rmdir, find -delete, sudo, chmod/chown, git clean/reset/restore, redirecionamentos de escrita, builds com emissão e mutações de dependências exigem permissão explícita.
- Se um guardrail bloquear uma ação, explique o motivo ao usuário e aguarde autorização antes de tentar novamente.`;

async function askExplicitPermission(decision: GuardDecision, ctx: PermissionContext): Promise<boolean> {
  if (!ctx.hasUI) return false;

  const allowed = await ctx.ui.confirm(
    "Guardrails: permissão explícita",
    `${formatDecision(decision)}\n\nPermitir esta ação uma vez?`,
  );

  if (allowed) {
    ctx.ui.notify("Guardrails: ação liberada uma vez.", "warning");
  }

  return allowed;
}

async function blockUnlessApproved(decision: GuardDecision | undefined, ctx: PermissionContext) {
  if (!decision) return undefined;

  const allowed = await askExplicitPermission(decision, ctx);
  if (allowed) return undefined;

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

function guardrailsSummary(): string {
  return [
    "Guardrails ativos:",
    "- .env/.env.* protegidos; .env.example liberado.",
    "- Escrita em dist/build/coverage/node_modules/.git pede permissão.",
    "- rm, sudo, chmod/chown, git clean/reset, redirecionamentos, builds e mutações de dependências pedem permissão.",
    "- Sem UI para confirmar, a ação é bloqueada por padrão.",
  ].join("\n");
}

export default function aicodersGuardrailsExtension(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}${SYSTEM_PROMPT_APPENDIX}`,
    message: {
      customType: "aicoders-guardrails-context",
      content: "Guardrails AICoders ativos para .env, dist e comandos destrutivos.",
      display: false,
    },
  }));

  pi.on("tool_call", async (event, ctx) => blockUnlessApproved(evaluateToolCall(event.toolName, event.input), ctx));

  pi.on("user_bash", async (event, ctx) => {
    const decision = evaluateShellCommand(event.command);
    if (!decision) return undefined;

    const allowed = await askExplicitPermission(decision, ctx);
    if (allowed) return undefined;

    return blockedUserBashResult(decision);
  });

  pi.registerCommand("guardrails", {
    description: "Mostra as regras de segurança dos guardrails AICoders",
    handler: async (_args, ctx) => {
      ctx.ui.notify(guardrailsSummary(), "info");
    },
  });
}
