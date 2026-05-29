# Tema AICoders Claude para pi

## Objetivo

O tema `aicoders-claude` deixa a TUI do pi mais limpa, escura e discreta,
com uma paleta inspirada na experiência visual minimalista do Claude Code.

## Arquivos

- `themes/aicoders-claude.json`: definição do tema com os 51 tokens obrigatórios.
- `package.json`: manifesto do pacote expondo `./themes` em `pi.themes`.
- `README.md`: instruções de instalação, teste e seleção do tema.

## Paleta visual

- Base escura quente para reduzir ruído visual.
- Texto off-white para boa legibilidade.
- Bordas cinza discretas.
- Accent âmbar/laranja suave.
- Estados de sucesso, erro e aviso com cores moderadas.
- Syntax highlight sem cores neon.

## Como testar localmente

A partir do clone do repositório:

```bash
pi -e .
```

Depois abra:

```bash
/settings
```

E selecione o tema `aicoders-claude`.

Também é possível configurar no `settings.json` do pi:

```json
{
  "theme": "aicoders-claude"
}
```

## Critérios de aceite

- Tema registrado com o nome `aicoders-claude`.
- JSON válido.
- Todos os 51 tokens obrigatórios presentes em `colors`.
- Nenhum token extra em `colors`.
- Pacote expõe temas por `pi.themes`.
- README documenta instalação e seleção.

## Observação

Este tema é apenas inspirado em uma UI limpa de ferramentas de coding agent.
Ele não copia marca, assets ou identidade visual proprietária do Claude.
