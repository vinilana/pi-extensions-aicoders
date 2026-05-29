import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { currentPhase } from "../domain/state.ts";
import type { WorkflowState } from "../domain/types.ts";

export interface CommitResult {
  evidence: string;
  hash?: string;
}

export async function commitCurrentPhase(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: WorkflowState,
  commitMessage?: string,
): Promise<CommitResult> {
  const phase = currentPhase(state);
  const fallbackMessage = phase ? `PREVC fase ${phase.id}: ${phase.title}` : "PREVC workflow update";
  const message = (commitMessage || fallbackMessage).trim();

  const status = await pi.exec("git", ["status", "--porcelain"], { timeout: 10_000 });
  if (status.code !== 0) {
    return { evidence: "Git indisponível ou diretório não é um repositório; commit não executado." };
  }
  if (!status.stdout.trim()) {
    return { evidence: "Sem alterações versionáveis; fase confirmada sem novo commit." };
  }

  if (ctx.hasUI) {
    const ok = await ctx.ui.confirm("PREVC commit", `Criar commit para a fase atual?\n\n${message}`);
    if (!ok) return { evidence: "Commit recusado pelo usuário; fase confirmada sem commit." };
  }

  const add = await pi.exec("git", ["add", "-A"], { timeout: 10_000 });
  if (add.code !== 0) {
    return { evidence: `Falha ao executar git add: ${add.stderr || add.stdout}`.trim() };
  }

  const commit = await pi.exec("git", ["commit", "-m", message], { timeout: 60_000 });
  if (commit.code !== 0) {
    return { evidence: `Falha ao executar git commit: ${commit.stderr || commit.stdout}`.trim() };
  }

  const rev = await pi.exec("git", ["rev-parse", "--short", "HEAD"], { timeout: 10_000 });
  const hash = rev.code === 0 ? rev.stdout.trim() : undefined;
  return { evidence: hash ? `Commit criado: ${hash} — ${message}` : `Commit criado: ${message}`, hash };
}
