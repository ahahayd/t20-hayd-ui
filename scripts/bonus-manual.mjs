/**
 * Marca no chat as rolagens em que o jogador digitou um bônus à mão na janela
 * de uso do sistema ("Aplicar Bônus ou Penalidade?", de acerto e de dano).
 *
 * O sistema não guarda esse bônus na mensagem: ele só entra nas partes da
 * fórmula. Por isso `AbilityUseDialog.create` é embrulhado para lembrar o que
 * foi digitado, e o próximo `preCreateChatMessage` do mesmo ator leva a flag.
 * No render, um ícone discreto vai ao lado da fórmula da rolagem afetada.
 */

const MODULE_ID = "t20-hayd-ui";
const FLAG = "bonusManual";
const VALIDADE_MS = 15000;

let pendente = null;

const vazio = (v) => ["", "0", undefined, null].includes(typeof v === "string" ? v.trim() : v);

function embrulharDialogo() {
    const Dlg = game.tormenta20?.applications?.AbilityUseDialog;
    if (!Dlg || Dlg._t20aBonusManual) return;
    const original = Dlg.create;
    Dlg.create = async function (item, ...resto) {
        const config = await original.call(this, item, ...resto);
        if (config) {
            const ataque = vazio(config.bonus) ? null : String(config.bonus).trim();
            const dano = vazio(config.bonusdano) ? null : String(config.bonusdano).trim();
            const actorId = item?.actor?.id ?? item?.parent?.id ?? null;
            pendente = (ataque || dano) ? { actorId, ataque, dano, em: Date.now() } : null;
        }
        return config;
    };
    Dlg._t20aBonusManual = true;
}

function marcarMensagem(message) {
    if (!pendente) return;
    if (Date.now() - pendente.em > VALIDADE_MS) { pendente = null; return; }
    if (!message.rolls?.length && !message.content?.includes("dice-roll")) return;
    const ator = message.speaker?.actor;
    if (pendente.actorId && ator && ator !== pendente.actorId) return;
    const { ataque, dano } = pendente;
    pendente = null;
    message.updateSource({ [`flags.${MODULE_ID}.${FLAG}`]: { ataque, dano } });
}

function icone(valor, tipo) {
    const i = document.createElement("i");
    i.className = "fa-solid fa-pen t20a-bonus-manual";
    const rotulo = game.i18n.localize(`T20A.Chat.BonusManual.${tipo}`);
    i.dataset.tooltip = `${rotulo}: ${valor}`;
    i.setAttribute("aria-label", i.dataset.tooltip);
    return i;
}

function anexar(roll, valor, tipo) {
    if (!roll || roll.querySelector(".t20a-bonus-manual")) return;
    const alvo = roll.querySelector(".dice-formula") ?? roll;
    alvo.append(icone(valor, tipo));
}

function desenhar(message, html) {
    // Quem vê a marca: configuração do mundo (padrão: só o mestre).
    const quem = game.settings.get(MODULE_ID, "chatBonusManual");
    if (quem === "ninguem" || (quem === "gm" && !game.user.isGM)) return;
    const dados = message.getFlag?.(MODULE_ID, FLAG);
    if (!dados) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    const card = root.querySelector(".chat-card.item-card");
    if (card) {
        const rolagens = [...card.querySelectorAll(".roll")];
        if (dados.ataque) anexar(rolagens.find(r => !r.classList.contains("roll--dano")), dados.ataque, "ataque");
        if (dados.dano) for (const r of rolagens.filter(r => r.classList.contains("roll--dano"))) anexar(r, dados.dano, "dano");
        return;
    }
    // Teste avulso (perícia, atributo): só existe o bônus de acerto.
    const valor = dados.ataque ?? dados.dano;
    for (const r of root.querySelectorAll(".dice-roll")) anexar(r, valor, "teste");
}

export function registrarBonusManual() {
    Hooks.once("ready", embrulharDialogo);
    Hooks.on("preCreateChatMessage", marcarMensagem);
    Hooks.on("renderChatMessageHTML", desenhar);
}
