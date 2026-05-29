import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { commitCurrentPhase as commitPhase } from "../adapters/git.ts";
import { persistWorkflowState } from "../adapters/session.ts";
import { ToolAccessController } from "../adapters/tools.ts";
import { updatePrevcUi } from "../adapters/ui.ts";
import { compactPlan, formatState } from "../domain/format.ts";
import { cloneState, createInitialState, currentPhase, normalizePhaseTitle } from "../domain/state.ts";
import type { WorkflowState, WorkflowToolParams } from "../domain/types.ts";

export class WorkflowService {
  private state: WorkflowState = createInitialState();
  private readonly tools: ToolAccessController;

  constructor(private readonly pi: ExtensionAPI) {
    this.tools = new ToolAccessController(pi);
  }

  getState(): WorkflowState {
    return this.state;
  }

  getStateSnapshot(): WorkflowState {
    return cloneState(this.state);
  }

  replaceState(state: WorkflowState): void {
    this.state = state;
  }

  private persistState(): void {
    persistWorkflowState(this.pi, this.state);
  }

  private updateUi(ctx: ExtensionContext): void {
    updatePrevcUi(ctx, this.state);
  }

  applyToolsForCurrentState(): void {
    this.tools.applyForState(this.state);
  }

  startWorkflow(ctx: ExtensionContext, objective: string): void {
    this.tools.captureActiveTools();
    this.state = {
      ...createInitialState(),
      enabled: true,
      stage: "P",
      summary: objective,
      startedAt: new Date().toISOString(),
    };
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
  }

  stopWorkflow(ctx: ExtensionContext): void {
    this.state = createInitialState();
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
  }

  rejectPlan(ctx: ExtensionContext, feedback?: string): void {
    this.state.stage = "P";
    if (feedback) this.state.summary = `${this.state.summary}\nFeedback de revisão: ${feedback}`.trim();
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
  }

  beginExecution(ctx: ExtensionContext): void {
    this.state.enabled = true;
    this.state.stage = "E";
    this.state.currentIndex = 0;
    if (this.state.phases[0]) this.state.phases[0].status = "executing";
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
  }

  async commitCurrentPhase(ctx: ExtensionContext, commitMessage?: string) {
    return commitPhase(this.pi, ctx, this.state, commitMessage);
  }

  onSessionStart(ctx: ExtensionContext): void {
    if (this.state.enabled || this.state.stage === "done") {
      this.tools.ensureActiveToolsCaptured();
      this.applyToolsForCurrentState();
    }
    this.updateUi(ctx);
  }

  private moveToNextPhaseOrDone(ctx: ExtensionContext): void {
    if (this.state.currentIndex + 1 < this.state.phases.length) {
      this.state.currentIndex += 1;
      this.state.phases[this.state.currentIndex]!.status = "executing";
      this.state.stage = "E";
    } else {
      this.state.stage = "done";
      this.state.enabled = false;
      this.state.completedAt = new Date().toISOString();
    }
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
  }

  async setPlan(ctx: ExtensionContext, params: WorkflowToolParams): Promise<string> {
    const titles = (params.phases ?? []).map(normalizePhaseTitle).filter(Boolean);
    if (titles.length === 0) throw new Error("set_plan requer phases com ao menos uma fase.");

    if (!this.state.enabled) {
      this.tools.ensureActiveToolsCaptured();
      this.state.enabled = true;
      this.state.startedAt = new Date().toISOString();
    }

    this.state.summary = params.summary?.trim() || this.state.summary;
    this.state.phases = titles.map((title, index) => ({ id: index + 1, title, status: "pending" }));
    this.state.currentIndex = 0;
    this.state.stage = "R";
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();

    let reviewResult = "Plano registrado. Etapa R ativa: aguarde aprovação com /prevc approve.";
    if (ctx.hasUI) {
      const choice = await ctx.ui.select(`Revisar plano PREVC\n\n${compactPlan(this.state)}`, [
        "Aprovar e executar",
        "Revisar/refinar o plano",
      ]);
      if (choice === "Aprovar e executar") {
        this.beginExecution(ctx);
        reviewResult = "Plano aprovado pelo usuário. Etapa E ativa: execute somente a fase atual.";
      } else {
        this.state.stage = "P";
        this.applyToolsForCurrentState();
        this.updateUi(ctx);
        this.persistState();
        reviewResult = "Plano enviado para refinamento. Etapa P ativa novamente.";
      }
    }

    return `${reviewResult}\n\n${formatState(this.state)}`;
  }

  markExecuted(ctx: ExtensionContext, evidence?: string): string {
    if (this.state.stage !== "E") throw new Error("mark_executed só pode ser usado na etapa E.");
    const phase = currentPhase(this.state);
    if (!phase) throw new Error("Nenhuma fase atual para executar.");
    phase.status = "executed";
    phase.executeEvidence = evidence?.trim() || "Execução registrada sem detalhes.";
    this.state.stage = "V";
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
    return `Fase ${phase.id} executada. Avance para V: valide a fase com checks relevantes.`;
  }

  markValidated(ctx: ExtensionContext, params: WorkflowToolParams): string {
    if (this.state.stage !== "V") throw new Error("mark_validated só pode ser usado na etapa V.");
    const phase = currentPhase(this.state);
    if (!phase) throw new Error("Nenhuma fase atual para validar.");
    phase.validateEvidence = params.evidence?.trim() || "Validação registrada sem detalhes.";
    phase.checks = params.checks ?? [];

    if (params.passed !== true) {
      phase.status = "executing";
      this.state.stage = "E";
      this.applyToolsForCurrentState();
      this.updateUi(ctx);
      this.persistState();
      return `Validação falhou ou ficou pendente. Volte para E e corrija somente a fase ${phase.id}.`;
    }

    phase.status = "validated";
    this.state.stage = "C";
    this.applyToolsForCurrentState();
    this.updateUi(ctx);
    this.persistState();
    return `Fase ${phase.id} validada. Avance para C: confirme e faça commit se houver alterações.`;
  }

  async markConfirmed(ctx: ExtensionContext, params: WorkflowToolParams): Promise<string> {
    if (this.state.stage !== "C") throw new Error("mark_confirmed só pode ser usado na etapa C.");
    const phase = currentPhase(this.state);
    if (!phase) throw new Error("Nenhuma fase atual para confirmar.");

    let commitEvidence = "Commit não solicitado.";
    let commitHash: string | undefined;
    if (params.commit !== false) {
      const result = await this.commitCurrentPhase(ctx, params.commitMessage);
      commitEvidence = result.evidence;
      commitHash = result.hash;
    }

    phase.status = "confirmed";
    phase.confirmEvidence = [params.evidence?.trim(), commitEvidence].filter(Boolean).join("\n");
    phase.commitHash = commitHash;
    const completedPhase = phase.id;
    this.moveToNextPhaseOrDone(ctx);

    const next = currentPhase(this.state);
    const nextText = next ? `Próxima etapa: E da fase ${next.id}. ${next.title}` : "Todas as fases foram concluídas.";
    return `Fase ${completedPhase} confirmada. ${nextText}\n\n${commitEvidence}`;
  }
}
