# Tormenta20 – Arcano

Tema visual **dark moderno** para as fichas de personagem, NPC e itens do sistema **Tormenta20** no FoundryVTT v13. Inclui o logotipo do Tormenta 20 no cabeçalho de cada ficha de personagem.

A cor de destaque (header, sumário, abas, atributos, PV/PM, listas, hover) é herdada automaticamente da cor do jogador dono da ficha — mas cada jogador pode **personalizar a cor da sua ficha** a qualquer momento pelo botão no cabeçalho.

## Recursos

- 🌑 Visual escuro semi-transparente com efeito *glassmórfico* (backdrop blur), inspirado em sistemas modernos como Pathfinder 2e
- 🎨 Cor de destaque dinâmica vinda do dono — sempre presente em bordas, headers, abas ativas, hover, e barras de recursos
- 🧙 Logotipo do Tormenta 20 no topo de cada ficha de personagem (pode ser ocultado nas configurações)
- ⚙️ Três modos de cor por ficha:
  - **Automática** — segue o primeiro dono jogador
  - **De um jogador específico** — fixa em um dono escolhido
  - **Cor personalizada** — color picker / hex livre
- 🔄 Reage em tempo real quando o usuário muda sua cor no Foundry
- 🛡️ Cobre fichas de Personagem, NPC e Itens (armas, magias, equipamento, talentos…)

## Compatibilidade

- **FoundryVTT:** v13
- **Sistema:** [Tormenta20](https://gitlab.com/vizael/Tormenta20) v1.4.200+ (verificado para v13)

## Instalação

### Via URL de manifest
No Foundry, em *Add-on Modules → Install Module*, cole a URL do `module.json`:

```
https://raw.githubusercontent.com/seu-usuario/tormenta20-arcano/main/module.json
```

### Manual
Baixe e extraia a pasta dentro de `{userData}/Data/modules/`.

## Como funciona

### Cor automática (padrão)
O módulo identifica os usuários com permissão **Owner** sobre a ficha (ignorando o Mestre) e usa a cor do primeiro dono em ordem alfabética. Se não houver dono jogador, é usada a *Cor de destaque padrão* configurada no mundo.

### Personalização por ficha
Cada ficha tem um botão **"Cor da Ficha"** no cabeçalho (visível para donos e GM). Ele abre um diálogo com três opções:

1. **Automática** — comportamento padrão (cor do primeiro dono).
2. **De um jogador específico** — escolha um dono no dropdown e a cor seguirá ele permanentemente (até você mudar). Útil quando dois ou mais jogadores compartilham a ficha.
3. **Cor personalizada** — escolha qualquer cor com o color picker ou digite o hex direto. A cor fica fixa, ignorando os donos.

A escolha é salva como flag no documento, persistindo entre sessões.

### Itens
Itens dentro de um ator herdam a configuração de cor do ator pai. Itens soltos no mundo seguem suas próprias permissões.

## Configurações

Em *Game Settings → Configure Settings → Tormenta20 – Arcano*:

- **Aplicar tema Arcano** *(por usuário)* — liga/desliga o tema só pra você.
- **Cor de destaque padrão** *(mundo)* — cor usada em fichas sem dono jogador (formato hex).
- **Mostrar logo do Tormenta 20** *(por usuário)* — exibe ou oculta a faixa do logo.

## Detalhes técnicos

- Não toca em código do sistema Tormenta20: usa apenas CSS sobreposto via cascade layer `modules` (que tem prioridade sobre `system` no v13) e hooks de renderização.
- Variável CSS principal: `--t20a-cor-destaque`, injetada como inline-style no `.window-app` da ficha durante o render.
- Classe CSS aplicada: `.t20a` (todos os seletores do tema são prefixados com ela).
- Logo é injetado via JS como `<img class="t20a-brand-logo">` no topo do `<form>` da ficha, sem alterar nenhum elemento original.
- Hooks usados: `renderActorSheet`, `renderItemSheet`, `getApplicationHeaderButtons`, `updateUser`, `updateActor`.
- Dialog de configuração usa `foundry.applications.api.DialogV2` (API v13).

## Aviso de uso

Este é um módulo **não oficial**, criado por fãs, sem afiliação com a editora **Jambô** ou com os autores do **Tormenta 20**. O logotipo é propriedade dos detentores dos direitos da marca; é incluído aqui exclusivamente para uso pessoal/decorativo em ambiente de jogo. Caso seja contatado pelos detentores, o asset será removido.

## Licença

Distribuído sob a licença MIT. Veja o arquivo `LICENSE`.
