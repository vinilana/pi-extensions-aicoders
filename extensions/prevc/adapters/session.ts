import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CUSTOM_TYPE } from "../domain/constants.ts";
import { cloneState } from "../domain/state.ts";
import type { WorkflowState } from "../domain/types.ts";

export function persistWorkflowState(pi: ExtensionAPI, state: WorkflowState): void {
  pi.appendEntry(CUSTOM_TYPE, { state: cloneState(state) });
}

export function restoreLatestWorkflowState(ctx: ExtensionContext): WorkflowState | undefined {
  const entries = ctx.sessionManager.getBranch();
  const latest = [...entries]
    .reverse()
    .find((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === CUSTOM_TYPE) as
    | { data?: { state?: WorkflowState } }
    | undefined;

  return latest?.data?.state;
}
