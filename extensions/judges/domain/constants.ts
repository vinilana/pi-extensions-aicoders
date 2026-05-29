export const CUSTOM_TYPE = "aicoders-judges";
export const CONTEXT_CUSTOM_TYPE = "aicoders-judges-context";
export const RESULT_CUSTOM_TYPE = "aicoders-judges-result";
export const TOOL_NAME = "judges_evaluate";

export const DEFAULT_COMPLETION_PATTERNS = [
  "\\b(conclu[ií]d[ao]s?|conclu[ií]|finalizad[ao]s?|finalizei|feito|feita|pronto|pronta|implementad[ao]s?)\\b",
  "\\b(done|completed|finished|implemented|fixed|resolved)\\b",
];

export const DEFAULT_JUDGE_PROMPT = `Você é um judge independente de entrega de software.
Compare a SPEC inicial com o resultado declarado pelo agente e com as evidências disponíveis.
Sua função é impedir falsos positivos: só aprove se TODOS os requisitos relevantes da SPEC estiverem de fato atendidos.

Responda somente JSON válido, sem markdown, no formato:
{
  "passed": true,
  "confidence": 0.0,
  "summary": "veredito curto",
  "missing": ["item pendente ou lacuna encontrada"],
  "checks": ["evidência objetiva considerada"],
  "pendingSpec": "nova SPEC objetiva para concluir apenas o que falta; vazio quando passed=true"
}

Critérios:
- Se scripts/testes falharam ou não cobrem uma exigência crítica, passed deve ser false.
- Se a SPEC for ambígua, use o resultado e as evidências para separar concluído de pendente.
- pendingSpec deve ser acionável por outro agente/extensão, com escopo, passos e validações pendentes.

<SPEC_INICIAL>
{{spec}}
</SPEC_INICIAL>

<RESULTADO_DECLARADO>
{{result}}
</RESULTADO_DECLARADO>

<EVIDENCIAS_E_SCRIPTS>
{{evidence}}
</EVIDENCIAS_E_SCRIPTS>`;
