# AICoders Academy · Pi Extensions

Repositório open source oficial da **aicoders.academy** com extensões para a comunidade do [pi coding agent](https://github.com/earendil-works/pi-coding-agent).

> ⚠️ **Segurança:** extensões do pi executam código na sua máquina com as permissões do seu usuário. Instale apenas extensões de fontes confiáveis e revise o código antes de usar.

## Pré-requisitos

- Node.js e npm instalados.
- Pi coding agent instalado e disponível no terminal como `pi`.
- Git instalado para instalar direto deste repositório.

## Instalação rápida

Quando o repositório estiver publicado no GitHub, instale globalmente com:

```bash
pi install git:github.com/aicoders-academy/pi-extensions-aicoders
```

Isso adiciona o pacote em `~/.pi/agent/settings.json` e deixa as extensões disponíveis em todos os projetos.

Para instalar apenas no projeto atual, use `-l`:

```bash
pi install -l git:github.com/aicoders-academy/pi-extensions-aicoders
```

Isso grava em `.pi/settings.json`, permitindo versionar a configuração junto com o projeto.

## Testar sem instalar

Use `-e`/`--extension` para carregar temporariamente:

```bash
pi -e git:github.com/aicoders-academy/pi-extensions-aicoders
```

Ou, após clonar o repositório:

```bash
git clone https://github.com/aicoders-academy/pi-extensions-aicoders.git
cd pi-extensions-aicoders
pi -e .
```

## Instalar a partir de um clone local

```bash
git clone https://github.com/aicoders-academy/pi-extensions-aicoders.git
pi install ./pi-extensions-aicoders
```

Para instalação local ao projeto:

```bash
pi install -l ./pi-extensions-aicoders
```

## Instalar uma extensão manualmente

Você também pode copiar arquivos `.ts` diretamente para os diretórios de auto-descoberta do pi.

Instalação global:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/nome-da-extensao.ts ~/.pi/agent/extensions/
```

Instalação local no projeto:

```bash
mkdir -p .pi/extensions
cp extensions/nome-da-extensao.ts .pi/extensions/
```

Depois, reinicie o pi ou execute `/reload` dentro da sessão.

## Tema AICoders Claude

Este pacote também inclui o tema `aicoders-claude`, uma paleta escura,
minimalista e inspirada na experiência limpa do Claude Code.

Após instalar ou carregar o pacote, selecione o tema pelo menu interativo:

```bash
/settings
```

Ou configure diretamente no `settings.json` do pi:

```json
{
  "theme": "aicoders-claude"
}
```

Para testar a partir de um clone local sem instalar:

```bash
pi -e .
```

Em seguida, abra `/settings` e escolha `aicoders-claude`.

## Atualizar, listar e remover

```bash
pi list
pi update --extensions
pi remove git:github.com/aicoders-academy/pi-extensions-aicoders
```

## Estrutura do repositório

```text
.
├── extensions/      # Extensões TypeScript do pi
├── themes/          # Temas JSON para a TUI do pi
├── README.md        # Documentação do projeto
└── package.json     # Manifesto do pacote pi
```

O pi descobre extensões e temas a partir do manifesto `pi` em `package.json`, incluindo `pi.extensions` e `pi.themes`.


## Extensões disponíveis

### PREVC

A extensão `prevc` controla o workflow:

- **P** — Planejar
- **R** — Revisar/aprovar
- **E** — Executar uma fase por vez
- **V** — Validar com evidências
- **C** — Confirmar e commitar quando aplicável

A implementação oficial está em `extensions/prevc/` e registra:

- comando `/prevc`
- ferramenta `prevc_workflow`
- guardrails para limitar ferramentas por etapa
- persistência do estado do workflow na sessão

Na etapa **P**, o agente deve apresentar uma **SPEC PREVC** detalhada com
objetivo, escopo, estado atual, requisitos, design técnico, artefatos,
etapas de execução, validações, critérios de aceite e riscos.

A spec também deve perguntar explicitamente:

> Você quer que eu gere um arquivo `.md` como output ao final?

Se a resposta for sim, o agente deve confirmar ou sugerir o caminho/nome do
arquivo Markdown. Se for não, deve registrar que não haverá artefato Markdown
final.

Uso básico:

```bash
/prevc start <objetivo>
/prevc status
/prevc approve
/prevc reject <motivo>
/prevc commit <mensagem>
/prevc stop
```

## Contribuindo

Contribuições da comunidade são bem-vindas. Antes de enviar uma extensão:

1. Coloque o arquivo em `extensions/`.
2. Documente como usar a extensão.
3. Evite segredos, tokens ou credenciais no código.
4. Teste com `pi -e .` antes de abrir um pull request.

## Licença

Este projeto será distribuído como open source. Defina a licença oficial antes da primeira release pública.
