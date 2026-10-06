/**
 * Ponte com o t20-hayd-gmtools.
 *
 * O GMTools injeta os acessos dele no DOM da ficha do sistema, procurando
 * seletores que a Ficha Hayd não tem (`.tab.spells > ul.item-list` para o
 * Painel de Engenhocas, `.tab.effects[data-tab="effects"]` para o "Gerenciar
 * automações"). Em vez de fingir aquela marcação só para ser injetada — o que
 * traria o visual do outro módulo para dentro da ficha —, a Ficha Hayd lê a
 * API do GMTools e monta os botões com a anatomia dela: na barra de
 * ferramentas da aba Magias e numa barra própria no topo da aba Efeitos.
 *
 * O "Enviar dinheiro" (gmtools/management) e a Loja continuam sendo injetados
 * pelos próprios módulos, porque a aba Inventário mantém de propósito a
 * estrutura `.inventory-currency ul.currency` que eles procuram.
 */

const GMTOOLS_ID = "t20-hayd-gmtools";

/** A API de automações do GMTools, se o módulo está ativo e as automações ligadas. */
function api() {
    const automacoes = game.modules.get(GMTOOLS_ID)?.active
        ? game.modules.get(GMTOOLS_ID)?.api?.automacoes
        : null;
    if (!automacoes) return null;
    // `ativas` só existe nas versões que expõem isto; na dúvida, segue ligado.
    if (automacoes.ativas && !automacoes.ativas()) return null;
    return automacoes;
}

/**
 * O que a ficha deve mostrar deste ator. Devolve `null` quando não há nada,
 * para o template não abrir barra vazia.
 */
export function ferramentasGMTools(actor) {
    const a = api();
    if (!actor || !a) return null;

    const eng = a.engenhocas;
    const temEngenhoqueiro = !!eng?.temEngenhoqueiro?.(actor);
    const engenhocas = temEngenhoqueiro
        ? {
            // `listar` é novo; sem ele, conta as magias do tipo engenhoca.
            quantidade: (eng.listar?.(actor)
                ?? actor.items.filter((i) => eng.ehEngenhoca?.(i))).length,
            podeResetar: !!actor.isOwner
        }
        : null;

    // O painel de contadores só tem o que mostrar quando há automação com
    // contador no ator ou alguma ativa para cancelar — o próprio GMTools
    // decide isso, e sem o botão a barra da aba Efeitos não aparece.
    const automacoes = !!(actor.isOwner && a.contadores?.temConteudo?.(actor));

    if (!engenhocas && !automacoes) return null;
    return { engenhocas, automacoes };
}

export function abrirPainelEngenhocas(actor) {
    api()?.engenhocas?.abrirPainel?.(actor);
}

export async function resetarEngenhocas(actor) {
    await api()?.engenhocas?.resetarEngenhocas?.([actor]);
}

export async function abrirPainelAutomacoes(actor) {
    const abrir = api()?.contadores?.abrir;
    if (!abrir) return;
    try { await abrir(actor); }
    catch (err) {
        console.error("t20-hayd-ui | Falha ao abrir o painel de automações", err);
        ui.notifications.error(game.i18n.localize("T20A.Ficha.AutomacoesErro"));
    }
}
