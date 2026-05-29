import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getConfigExample } from "../adapters/config.ts";
import { formatConfig, formatEvaluationResult } from "../domain/format.ts";
import type { JudgesService } from "./judges-service.ts";

function usage(): string {
  return [
    "Uso: /judges status | config | spec <texto> | eval <resultado> | reset",
    "- status: mostra configuração carregada e último resultado",
    "- config: mostra exemplo de .pi/judges.json",
    "- spec: define manualmente a SPEC ativa da sessão",
    "- eval: avalia o texto contra a SPEC ativa",
    "- reset: limpa SPEC/resultado ativos",
  ].join("\n");
}

export function registerJudgesCommand(pi: ExtensionAPI, judges: JudgesService): void {
  pi.registerCommand("judges", {
    description: "Configura e inspeciona os AICoders Judges",
    getArgumentCompletions: (prefix) => {
      const actions = ["status", "config", "spec", "eval", "reset"];
      const filtered = actions.filter((action) => action.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((action) => ({ value: action, label: action })) : null;
    },
    handler: async (args, ctx) => {
      const [rawAction = "status", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const action = rawAction.toLowerCase();
      const remainder = rest.join(" ").trim();

      if (action === "status") {
        const config = await judges.loadConfig(ctx);
        const state = judges.getState();
        const last = state.lastResult ? `\n\nÚltima avaliação:\n${formatEvaluationResult(state.lastResult)}` : "\n\nÚltima avaliação: nenhuma";
        const spec = state.activeSpec ? `\n\nSPEC ativa:\n${state.activeSpec}` : "\n\nSPEC ativa: nenhuma";
        ctx.ui.notify(`${formatConfig(config)}${spec}${last}`, "info");
        return;
      }

      if (action === "config") {
        ctx.ui.notify(`Exemplo de .pi/judges.json:\n${getConfigExample()}`, "info");
        return;
      }

      if (action === "spec") {
        if (!remainder) {
          ctx.ui.notify("Informe a SPEC: /judges spec <texto>", "warning");
          return;
        }
        judges.setActiveSpec(remainder, ctx);
        ctx.ui.notify("SPEC ativa dos judges atualizada.", "info");
        return;
      }

      if (action === "eval") {
        if (!remainder) {
          ctx.ui.notify("Informe o resultado/evidência: /judges eval <resultado>", "warning");
          return;
        }
        const result = await judges.evaluate(ctx, { spec: "", result: remainder, source: "command" });
        pi.sendMessage({
          customType: "aicoders-judges-result",
          content: formatEvaluationResult(result),
          display: true,
          details: { result },
        });
        return;
      }

      if (action === "reset") {
        judges.clear(ctx);
        ctx.ui.notify("Judges resetados para esta sessão.", "info");
        return;
      }

      ctx.ui.notify(usage(), "info");
    },
  });
}
