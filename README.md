[![Apoie no Ko-fi](https://img.shields.io/badge/Apoie_no_Ko--fi-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/haydgi)

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

Ative o módulo e pronto: fichas de personagem, NPC e itens passam para o visual escuro, com a cor de destaque aplicada em cabeçalhos, abas, atributos, barras de PV/PM, listas e scrollbars. Itens abertos a partir de um ator herdam a cor do ator, e as janelas de uso do sistema (usar/conjurar, editor de efeitos etc.) recebem o mesmo tratamento. Cada usuário pode desligar o tema só para si nas configurações.

Dois temas visuais à escolha, por usuário:

- **Dark Mode** (padrão): visual vanilla do Foundry moderno — painéis translúcidos com desfoque, paleta neutra, cantos suaves e a cor de destaque usada só como um leve acento (aba ativa, foco, links, botão principal). Cobre exatamente as mesmas fichas e janelas de uso que o Dark Neon, com bom contraste garantido tanto na ficha normal quanto na ficha em abas.
- **Dark Neon**: visual escuro com a cor de destaque bem presente — gradientes, brilho, cantos quadrados.

### Cor da ficha

Clique em **"Cor da Ficha"** no cabeçalho da ficha (donos e Mestre) e escolha entre a cor **automática** do jogador dono, a cor **padrão** do mundo ou uma **cor personalizada** pelo seletor de cores. O texto se ajusta sozinho para manter contraste legível sobre qualquer cor escolhida.

### Chat

As mensagens viram cards temáticos: fundo claro para mensagens enviadas por jogadores e por atores pertencentes a eles; fundo escuro para NPCs, mensagens do Mestre sem ator e mensagens de sistema. O card também mostra o retrato do ator no cabeçalho, o nome do jogador abaixo do personagem e botões de ação (Aplicar Dano, Gastar Mana…) na cor de destaque.

### Nível obtido dos poderes

Opção por usuário que exibe um pequeno selo antes do ícone de cada poder na ficha, indicando em que nível ele foi obtido (ou "B" para poderes ganhos como bônus). Clique no selo para aumentar o nível e clique com o botão direito para diminuir — a ordem da lista continua livre para você organizar como preferir.

### Configurações

Em *Configurar → Configurações → T20 Hayd UI*: ativar/desativar o tema (por usuário), **estilizar fichas e janelas** (desligue para manter só as personalizações do chat), **tema visual** (Dark Neon ou Dark Mode), cor de destaque padrão do mundo, mostrar o logo do Tormenta 20 nas fichas de personagem e o selo de nível dos poderes.

## Detalhes adicionais

- Não modifica o código do sistema — apenas CSS sobreposto e hooks de renderização do Foundry; pode ser desativado a qualquer momento sem afetar dados.
- Módulos compatíveis: **t20-hayd-loja**, **t20-hayd-bases** e **t20-hayd-dominios** detectam o tema e adotam o mesmo visual automaticamente (por ora, alinhados ao visual do Dark Neon).
- Como a cor é resolvida: modo padrão usa a cor do mundo; modo automático usa a cor do primeiro dono jogador; mensagens de chat priorizam a cor do ator que fala; janelas de uso usam a cor do usuário logado.

---

## ❤️ Apoio e Comissões

Este módulo é totalmente gratuito. Se você gosta de usá-lo e quiser apoiar seu desenvolvimento, qualquer contribuição é muito bem-vinda!

### ☕ Ko-fi

Você pode apoiar meu trabalho pelo Ko-fi:

[![Apoie no Ko-fi](https://img.shields.io/badge/Apoie_no_Ko--fi-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/haydgi)

Ao apoiar pelo Ko-fi, você também pode deixar uma mensagem com um pedido ou sugestão de automação para Foundry VTT que gostaria de ver. Esses pedidos podem servir de inspiração para futuras funcionalidades, automações ou módulos.

### 🇧🇷 Pix

Se preferir, você também pode apoiar diretamente via Pix.

**Chave Pix aleatória:**

`a8baae96-f4d1-48a5-af25-45bf419fb0fb`

<p align="center">
  <img src="assets/qrcode.png" alt="QR Code Pix" width="220">
</p>

### 🛠️ Comissões para Foundry VTT

Também aceito comissões para desenvolvimento no Foundry VTT, incluindo a implementação de **módulos completos de aventuras**, respeitando os direitos e licenças dos materiais utilizados, com cenas, atores, itens, diários, automações e outros conteúdos necessários para deixar a aventura pronta para uso no Foundry, além de módulos específicos para Tormenta20 e outros sistemas.

Se tiver interesse em contratar uma comissão, você pode entrar em contato comigo pelo Discord `xddyahaha` para conversarmos sobre o projeto e seu escopo.

<p align="center">
  <sub>Todo apoio é opcional e ajuda a continuar desenvolvendo e mantendo meus módulos para Foundry VTT. ❤️</sub>
</p>

## Aviso

Módulo não oficial, criado por fã, sem afiliação com a Jambô Editora ou com os autores de Tormenta20. O logotipo do Tormenta 20 é propriedade dos detentores da marca e está incluído apenas para uso decorativo em ambiente de jogo.
