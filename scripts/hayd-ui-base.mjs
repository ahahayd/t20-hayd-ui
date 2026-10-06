/**
 * Marca as janelas DESTE módulo com `hayd-ui`, a classe de onde pendem os
 * tokens e as primitivas de `styles/hayd-ui-base.css`.
 *
 * O critério é "a janela é nossa", e não "tem markup nosso dentro".
 *
 * A diferença importa: um módulo que injeta um botão na ficha do sistema, ou
 * uma seção na tela de configurações do Foundry, deixa markup dele dentro de
 * uma janela que é DOS OUTROS. Marcar por conteúdo acabava aplicando a base
 * visual na barra lateral, no chat, no diretório de atores e na tela de
 * configurações do core — que não são nossas para redesenhar.
 *
 * Então: só um diálogo criado por nós (DialogV2 com markup do módulo; os
 * diálogos do core nunca têm) ou uma das janelas da lista explícita abaixo.
 *
 * O elemento sai de `app.element`: há fichas que chegam ao hook com o
 * elemento de uma PARTE (já vi um <button> do cabeçalho), e marcar a parte
 * não leva os tokens a lugar nenhum.
 */

const CLASSE = 'hayd-ui';
const MARCADOR = '[class*="t20a-po"], [class*="t20a-org"]';
/** Janelas próprias do módulo, pelo nome da classe da aplicação. */
const JANELAS_PROPRIAS = new Set([]);

function ehNossa(app, raiz) {
  if (JANELAS_PROPRIAS.has(app?.constructor?.name)) return true;
  const ehDialogo = app instanceof foundry.applications.api.DialogV2;
  return ehDialogo && (raiz.matches(MARCADOR) || !!raiz.querySelector(MARCADOR));
}

function marcar(app, elemento) {
  const raiz = app?.element ?? elemento?.[0] ?? elemento;
  if (!(raiz instanceof HTMLElement) || raiz.classList.contains(CLASSE)) return;
  if (!ehNossa(app, raiz)) return;
  raiz.classList.add(CLASSE);
}

Hooks.on('renderApplicationV2', marcar);
Hooks.on('renderDialogV2', marcar);
