[![Apoie no Ko-fi](https://img.shields.io/badge/Apoie_no_Ko--fi-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/haydgi)

# T20 Hayd UI

Tema visual moderno e sombrio para o sistema **Tormenta20** no FoundryVTT: fichas de personagem, NPC e itens, mensagens de chat e janelas de uso ganham um visual escuro glassmórfico, com a cor de destaque herdada automaticamente da cor do jogador dono da ficha.

## Requisitos

- FoundryVTT **v13** ou **v14**
- Sistema **Tormenta20**

## Instalação

Em *Configurar → Módulos Complementares → Instalar Módulo*, cole a URL do manifesto:

```
https://github.com/ahahayd/t20-hayd-ui/releases/latest/download/module.json
```

## Como usar

### Tema das fichas

Ative o módulo e pronto: fichas de personagem, NPC e itens passam para o tema escolhido (escuro ou claro), com a cor de destaque aplicada em cabeçalhos, abas, atributos, barras de PV/PM, listas e scrollbars. Itens abertos a partir de um ator herdam a cor do ator, e as janelas de uso do sistema (usar/conjurar, editor de efeitos etc.) recebem o mesmo tratamento. Cada usuário pode desligar o tema só para si nas configurações.

Três temas visuais à escolha, por usuário:

- **Dark Mode** (padrão): visual vanilla do Foundry moderno — painéis translúcidos com desfoque, paleta neutra, cantos suaves e a cor de destaque usada só como um leve acento (aba ativa, foco, links, botão principal). Cobre exatamente as mesmas fichas e janelas de uso que o Dark Neon, com bom contraste garantido tanto na ficha normal quanto na ficha em abas.
- **Light Mode**: a versão clara do Dark Mode — mesmo layout, mesma arte do cabeçalho e as mesmas fichas e janelas cobertas, com fundo claro e texto escuro.
- **Dark Neon**: visual escuro com a cor de destaque bem presente — gradientes, brilho, cantos quadrados.

### Cor da ficha

Clique em **"Cor da Ficha"** no cabeçalho da ficha (donos e Mestre) e escolha entre a cor **automática** do jogador dono, a cor **padrão** do mundo ou uma **cor personalizada** pelo seletor de cores. O texto se ajusta sozinho para manter contraste legível sobre qualquer cor escolhida. Nas fichas de personagem, a arte do cabeçalho acompanha a cor de destaque; marque **"Manter as cores originais da arte do cabeçalho"** no mesmo diálogo para exibi-la sem recolorir, ou **"Ocultar a arte do cabeçalho"** para deixar o topo da ficha sem imagem.

### Chat

As mensagens viram cards temáticos: fundo claro para mensagens enviadas por jogadores e por atores pertencentes a eles; fundo escuro para NPCs, mensagens do Mestre sem ator e mensagens de sistema. O card também mostra o retrato do ator no cabeçalho, o nome do jogador abaixo do personagem e botões de ação (Aplicar Dano, Gastar Mana…) na cor de destaque.

Cada usuário pode trocar o padrão de fundo só para si: deixar todas as mensagens escuras ou todas claras. Também dá para escolher se o retrato vem da arte do personagem ou do token e, em mensagens sem personagem, mostrar o avatar do jogador ou nenhum retrato.

### Origem dos poderes

Para lembrar em que nível e de onde veio cada poder e magia do personagem. Um ícone discreto ao lado do título **Poderes** abre uma tela com tudo agrupado por nível: em cada linha, uma **categoria** (Raça, Origem, Complicação, Devoção, Nível, Bônus ou qualquer outra que você digitar, como uma regra da sua mesa) e o **nível** em que foi obtido. Poderes que o sistema já marca como raciais, de origem, de complicação ou concedidos chegam com uma sugestão preenchida. Na ficha, cada poder anotado ganha só uma legenda pequena abaixo do nome (ex.: "Nv 1 · Origem").

É só organização: nada muda nas regras, nas rolagens nem na ordem da lista. Cada usuário escolhe entre o organizador, o **selo legado** (o selo clicável antes do ícone de cada poder) ou nada; o Mestre pode desligar para o mundo inteiro. Desligar, em qualquer um dos dois, só esconde o botão, as etiquetas e o selo: as anotações continuam guardadas. As anotações feitas com o selo antigo continuam valendo.

### Configurações

Em *Configurar → Configurações → T20 Hayd UI*: ativar/desativar o tema (por usuário), **estilizar fichas e janelas** (desligue para manter só as personalizações do chat), **tema visual** (Dark Mode, Light Mode ou Dark Neon), cor de destaque padrão do mundo (usada em fichas sem jogador dono ou no modo padrão), mostrar o logo do Tormenta 20 nas fichas de personagem e a origem dos poderes (por usuário e para o mundo).

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
