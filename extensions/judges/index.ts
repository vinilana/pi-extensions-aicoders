/**
 * AICoders Judges Extension
 *
 * Valida conclusões contra a SPEC inicial usando judges configuráveis por prompt
 * e, opcionalmente, scripts/testes definidos pelo usuário/projeto.
 *
 * Uso:
 *   /judges status
 *   /judges spec <texto>
 *   /judges eval <resultado>
 *   ferramenta: judges_evaluate
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerJudgesCommand } from "./application/register-command.ts";
import { registerJudgesEvents } from "./application/register-events.ts";
import { registerJudgesTool } from "./application/register-tool.ts";
import { JudgesService } from "./application/judges-service.ts";

export default function aicodersJudgesExtension(pi: ExtensionAPI): void {
  const judges = new JudgesService(pi);

  registerJudgesCommand(pi, judges);
  registerJudgesTool(pi, judges);
  registerJudgesEvents(pi, judges);
}
