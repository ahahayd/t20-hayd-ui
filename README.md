# T20 Hayd UI

Tema visual dark moderno para fichas de personagem, NPC e itens do sistema **Tormenta20** no FoundryVTT v13. A cor de destaque é herdada automaticamente da cor do jogador dono da ficha.

## O que o módulo faz

### Fichas (personagem, NPC, item)

- Visual escuro semi-transparente com efeito glassmórfico (backdrop blur) em toda a janela.
- Cor de destaque dinâmica aplicada em: header da janela, abas ativas, headers de seção, atributos (FOR/DES/CON…), barras de PV/PM, listas de itens (ataques, magias, equipamento, talentos, perícias), bordas de defesa/condições, barra de XP e scrollbars.
- Barra de XP sempre verde (independente da cor de destaque).
- Logotipo do Tormenta 20 flutuante acima das abas em fichas de personagem (pode ser desativado).
- Botão **"Cor da Ficha"** no cabeçalho da ficha (visível para donos e GM) para escolher entre cor automática do jogador ou cor padrão do mundo.
- Itens dentro de um ator herdam a cor do ator pai.
- Menu de contexto (botão direito) estilizado no tema escuro.
- Scrollbars customizadas na cor de destaque.

### Mensagens de chat

- Cada mensagem recebe um card com borda bege (`#c4a882`), sombra e bordas levemente arredondadas.
- Mensagens de personagens jogadores usam uma textura de fundo clara (`background-light.webp`); mensagens de NPCs usam fundo escuro (`background-dark4.webp`).
- Header da mensagem exibe um overlay semi-transparente da cor de destaque do ator (90% opacidade).
- Retrato do ator injetado no header como imagem quadrada 40×40 (só quando há ator associado).
- Nome do jogador exibido abaixo do nome do personagem no header.
- Botões de ação (Aplicar Dano, Gastar Mana, etc.) estilizados na cor de destaque, com margem e bordas arredondadas nos botões de efeito (`chat-apply-ae`).
- Dice-btns com bordas arredondadas e gap entre eles.
- Tooltip de dados: fundo escuro para NPCs, fundo claro para jogadores.

### Janelas de uso de habilidade/item (dialogs do sistema)

- Janelas `.tormenta20.dialog` recebem o mesmo fundo glassmórfico das fichas.
- Lista de aprimoramentos/efeitos com texto claro e bordas na cor de destaque do jogador atual.
- Checkboxes, inputs e botões numCtrl no tema escuro.
- Botão primário ("Usar") na cor de destaque do jogador.
- Seção de custo total com borda e fundo sutil na cor de destaque.

## Configurações

Em *Game Settings → Configure Settings → T20 Hayd UI*:

| Configuração | Escopo | Descrição |
|---|---|---|
| Ativar tema visual | Por usuário | Liga/desliga o tema só para você. Recarrega a página. |
| Cor de destaque padrão | Mundo | Cor hex usada em fichas sem dono jogador. |
| Mostrar logo do Tormenta 20 | Por usuário | Exibe ou oculta o logo flutuante nas fichas de personagem. |

## Como a cor de destaque é resolvida

1. Se a ficha está no modo **Cor padrão**: usa a cor configurada no setting de mundo.
2. Se está no modo **Automático** (padrão): usa a cor do primeiro dono jogador (não-GM) em ordem alfabética que tenha cor definida. Se não houver, cai para a cor padrão do mundo.
3. Itens herdama a cor do ator pai.
4. Mensagens de chat: priorizam a cor do ator speaker; se não houver ator, usam a cor do remetente.
5. Dialogs de uso: usam sempre a cor do usuário atual logado.

## Compatibilidade

- **FoundryVTT:** v13
- **Sistema:** [Tormenta20](https://gitlab.com/vizael/Tormenta20) — verificado em v1.4.213

## Instalação

**Via manifest URL** — em *Add-on Modules → Install Module*, cole:

```
https://raw.githubusercontent.com/ahahayd/t20-hayd-ui/main/module.json
```

**Manual** — baixe o repositório e extraia a pasta em `{userData}/Data/modules/`.

## Detalhes técnicos

- Não modifica o código do sistema Tormenta20. Usa CSS sobreposto via cascade layer `modules` (prioridade sobre `system` no v13) e hooks de renderização do Foundry.
- Variável CSS principal `--t20a-cor-destaque` injetada como inline style no `.window-app` via JS a cada render.
- Todos os seletores CSS são prefixados com `.t20a` para isolar do restante da interface.
- Hooks usados: `renderActorSheet`, `renderItemSheet`, `renderChatMessage`, `renderApplication`, `getApplicationHeaderButtons`, `updateUser`, `updateActor`.
- Textos de listas em dialogs que são sobrescritos pela classe `theme-light` do Foundry são forçados via `element.style.setProperty("color", ..., "important")`.
- Dialog de configuração por ficha usa `foundry.applications.api.DialogV2` (API v13).

## Aviso

Módulo não oficial, sem afiliação com a editora Jambô ou com os autores do Tormenta 20. O logotipo é propriedade dos detentores da marca e está incluído apenas para uso decorativo em ambiente de jogo.

## Licença

MIT — veja o arquivo `LICENSE`.
