# Extensão AICoders Judges

A extensão `judges` valida se uma tarefa realmente atende à SPEC inicial antes de ser considerada concluída.

## O que ela registra

- Comando `/judges` para status, configuração, SPEC ativa, avaliação manual e reset.
- Ferramenta LLM `judges_evaluate` para comparar `spec` + `result` + evidências.
- Hooks `before_agent_start`, `message_end` e `session_start`.
- Mensagens customizadas `aicoders-judges-context` e `aicoders-judges-result`.
- Evento interno `aicoders:judges:evaluated` em `pi.events` para outras extensões observarem resultados.

## Configuração

A configuração é opcional. A extensão procura, nessa ordem:

1. `~/.pi/agent/judges.json`
2. `.pi/judges.json`
3. `judges.config.json`

Exemplo:

```json
{
  "enabled": true,
  "model": "active",
  "allowScripts": true,
  "confirmScripts": true,
  "auto": { "enabled": true, "mode": "claim", "onFail": "followUp", "onPass": "silent" },
  "judges": [
    {
      "id": "spec-compliance",
      "promptFile": ".pi/judges/spec-compliance.md",
      "scripts": [{ "name": "tests", "command": "npm test", "timeoutMs": 120000 }]
    }
  ]
}
```

### Campos principais

- `enabled`: liga/desliga a extensão.
- `model`: `active` usa o modelo atual da sessão; também aceita `provider/model-id`.
- `allowScripts`: scripts só rodam quando este campo é `true`.
- `confirmScripts`: quando `true`, pede confirmação na UI antes de executar comandos configurados.
- `auto.enabled`: ativa avaliação automática em respostas finais que alegam conclusão.
- `auto.mode`: `claim` avalia apenas textos com padrões de conclusão; `always` avalia toda resposta final; `off` desativa.
- `auto.onFail`: `followUp` bloqueia a conclusão e agenda continuação com a SPEC pendente; `replace` apenas substitui a resposta final; `reportOnly` não bloqueia.
- `judges[].prompt` ou `promptFile`: prompt do judge. Use placeholders `{{spec}}`, `{{result}}` e `{{evidence}}`. Arquivos relativos são procurados primeiro em relação ao arquivo de configuração e depois em relação ao `cwd` do projeto.
- `judges[].scripts`: comandos opcionais de validação. Saída é truncada antes de ir para o judge.

## Ferramenta `judges_evaluate`

Parâmetros:

- `spec` opcional: SPEC inicial. Se omitida, usa a SPEC ativa capturada do prompt inicial.
- `result`: entrega/evidência a validar.
- `evidence` opcional: logs, checks, diffs e contexto adicional.
- `judgeIds` opcional: IDs específicos a executar.
- `runScripts` opcional: `false` pula scripts configurados.

Retorno estruturado em `details.result`:

- `passed`: `true` somente se prompts e scripts aprovarem.
- `missing`: lacunas encontradas.
- `pendingSpec`: nova SPEC para concluir o que falta quando `passed=false`.
- `checks`: evidências consideradas.
- `promptResults` e `scriptResults`: detalhes por judge/script.

## Integração com PREVC

A etapa V do PREVC mantém `judges_evaluate` ativo. Antes de `prevc_workflow mark_validated passed=true`, o agente deve chamar `judges_evaluate`. Se o judge reprovar, o PREVC volta para E usando a `pendingSpec` como escopo de correção.

## Segurança

Scripts configurados executam comandos locais via `pi.exec`. Por padrão, eles ficam bloqueados (`allowScripts=false`). Para automação não interativa, configure explicitamente `allowScripts=true` e `confirmScripts=false` apenas em repositórios confiáveis.
