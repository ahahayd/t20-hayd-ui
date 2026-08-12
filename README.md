# T20 Hayd UI

Tema visual moderno e sombrio para o sistema **Tormenta20** no FoundryVTT: fichas de personagem, NPC e itens, mensagens de chat e janelas de uso ganham um visual escuro glassmórfico, com a cor de destaque herdada automaticamente da cor do jogador dono da ficha.

## Requisitos

- FoundryVTT **v13**
- Sistema **Tormenta20**

## Instalação

Em *Configurar → Módulos Complementares → Instalar Módulo*, cole a URL do manifesto:

```
https://github.com/ahahayd/t20-hayd-ui/releases/latest/download/module.json
```

## Como usar

### Tema das fichas

Ative o módulo e pronto: fichas de personagem, NPC e itens passam para o visual escuro, com a cor de destaque aplicada em cabeçalhos, abas, atributos, barras de PV/PM, listas e scrollbars. Itens abertos a partir de um ator herdam a cor do ator. Cada usuário pode desligar o tema só para si nas configurações.

### Cor da ficha

Clique em **"Cor da Ficha"** no cabeçalho da ficha (donos e Mestre) e escolha entre a cor **automática** do jogador dono, a cor **padrão** do mundo ou uma **cor personalizada** pelo seletor de cores. O texto se ajusta sozinho para manter contraste legível sobre qualquer cor escolhida.

### Chat

As mensagens viram cards temáticos: fundo claro para personagens jogadores e escuro para NPCs, retrato do ator no cabeçalho, nome do jogador abaixo do personagem e botões de ação (Aplicar Dano, Gastar Mana…) na cor de destaque.

### Nível obtido dos poderes

Opção por usuário que exibe um pequeno selo antes do ícone de cada poder na ficha, indicando em que nível ele foi obtido (ou "B" para poderes ganhos como bônus). Clique no selo para aumentar o nível e clique com o botão direito para diminuir — a ordem da lista continua livre para você organizar como preferir.

### Configurações

Em *Configurar → Configurações → T20 Hayd UI*: ativar/desativar o tema (por usuário), cor de destaque padrão do mundo, mostrar o logo do Tormenta 20 nas fichas de personagem e o selo de nível dos poderes.

## Detalhes adicionais

- Não modifica o código do sistema — apenas CSS sobreposto e hooks de renderização do Foundry; pode ser desativado a qualquer momento sem afetar dados.
- Módulos compatíveis: **t20-hayd-loja**, **t20-hayd-bases** e **t20-hayd-dominios** detectam o tema e adotam o mesmo visual automaticamente.
- Como a cor é resolvida: modo padrão usa a cor do mundo; modo automático usa a cor do primeiro dono jogador; mensagens de chat priorizam a cor do ator que fala; janelas de uso usam a cor do usuário logado.

## Aviso

Módulo não oficial, criado por fã, sem afiliação com a Jambô Editora ou com os autores de Tormenta20. O logotipo do Tormenta 20 é propriedade dos detentores da marca e está incluído apenas para uso decorativo em ambiente de jogo.
