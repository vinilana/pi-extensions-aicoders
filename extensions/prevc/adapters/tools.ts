import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_EXECUTE_TOOLS, READ_ONLY_TOOLS } from "../domain/constants.ts";
import { uniqueTools } from "../domain/state.ts";
import type { WorkflowState } from "../domain/types.ts";

export class ToolAccessController {
  private previousActiveTools: string[] | undefined;

  constructor(private readonly pi: ExtensionAPI) {}

  captureActiveTools(): void {
    this.previousActiveTools = this.pi.getActiveTools();
  }

  ensureActiveToolsCaptured(): void {
    this.previousActiveTools = this.previousActiveTools ?? this.pi.getActiveTools();
  }

  applyForState(state: WorkflowState): void {
    if (!state.enabled && state.stage !== "done") {
      if (this.previousActiveTools) this.pi.setActiveTools(this.previousActiveTools);
      this.previousActiveTools = undefined;
      return;
    }

    if (state.stage === "E") {
      this.pi.setActiveTools(uniqueTools([...(this.previousActiveTools ?? DEFAULT_EXECUTE_TOOLS), ...DEFAULT_EXECUTE_TOOLS]));
      return;
    }

    this.pi.setActiveTools(READ_ONLY_TOOLS);
  }
}
