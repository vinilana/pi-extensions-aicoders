/**
 * PREVC Workflow Extension
 *
 * Project-local pi extension that guides implementation through:
 * P = Planejar, R = Revisar, E = Executar, V = Validar, C = Confirmar/Commit.
 *
 * Usage:
 *   /prevc start <objetivo>
 *   /prevc status
 *   /prevc approve
 *   /prevc reject <motivo>
 *   /prevc commit <mensagem>
 *   /prevc stop
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPrevcCommand } from "./application/register-command.ts";
import { registerPrevcEvents } from "./application/register-events.ts";
import { registerPrevcTool } from "./application/register-tool.ts";
import { WorkflowService } from "./application/workflow-service.ts";

export default function prevcWorkflowExtension(pi: ExtensionAPI): void {
  const workflow = new WorkflowService(pi);

  registerPrevcCommand(pi, workflow);
  registerPrevcTool(pi, workflow);
  registerPrevcEvents(pi, workflow);
}
