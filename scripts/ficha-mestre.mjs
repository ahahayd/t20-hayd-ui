/**
 * Ficha Hayd do Personagem do Mestre — ficha alternativa para os atores do
 * tipo "simple" do Tormenta20. Esses personagens não entram em combate, então
 * a ficha só ganha o visual da Ficha Hayd de Ameaça: o conteúdo é o da ficha
 * do sistema (atributos, PV/PM, defesa, traços, poderes, magias, itens,
 * moedas, carga, biografia e efeitos), sem esconder nada.
 *
 * A classe estende a ActorSheetT20Simple do sistema: rolagens, arrastar e
 * soltar, menus e as abas são os do próprio sistema. A ficha só troca o
 * template e prepara os dados do cabeçalho.
 */

import { lerArteMestre } from "./ficha-hayd.mjs";

const MODULE_ID = "t20-hayd-ui";
const TEMPLATE = `modules/${MODULE_ID}/templates/mestre/ficha.hbs`;
const ESCUDO = `modules/${MODULE_ID}/assets/icones/escudo-defesa.webp`;
const ARTES = {
    "deuses-positivo": "header-deuses-positivo.webp",
    "deuses-negativo": "header-deuses-negativo.webp",
    tormenta: "header-tormenta-horizontal.webp"
};

/** Classe CSS da janela (o CSS e o tema usam para reconhecer a ficha). */
export const CLASSE_MESTRE = "hayd-mestre";

/** A ficha é uma Ficha Hayd do Personagem do Mestre? */
export function ehFichaMestre(app) {
    return !!app?.constructor?.FICHA_MESTRE;
}

const pct = (valor, max) => (max > 0 ? Math.clamp(Math.round((valor / max) * 100), 0, 100) : 0);
/** Largura dos campos de PV/PM: dígitos do maior entre o atual e o máximo. */
const digitos = (valor, max) => Math.max(2, ...[valor, max].map((n) => String(Math.trunc(Number(n) || 0)).length));

function barra(recurso) {
    const { value = 0, max = 0, temp = 0 } = recurso ?? {};
    return { value, max, temp, pct: pct(value, max), tempPct: pct(temp, max), digitos: digitos(value, max) };
}

/**
 * O sistema não exporta a ActorSheetT20Simple: a classe vem do registro de
 * fichas, que ainda está vazio no "setup". Aí a ficha é registrada no "ready".
 */
export async function registrarFichaMestre() {
    const Base = game.tormenta20?.applications?.ActorSheetT20Simple
        ?? CONFIG.Actor.sheetClasses?.simple?.["tormenta20.ActorSheetT20Simple"]?.cls;
    if (!Base) {
        if (game.ready) console.warn(`${MODULE_ID} | ficha do personagem do mestre do sistema não encontrada; Ficha Hayd do Mestre não registrada.`);
        else Hooks.once("ready", registrarFichaMestre);
        return;
    }
    foundry.documents.collections.Actors.registerSheet(MODULE_ID, criarClasseFicha(Base), {
        types: ["simple"],
        makeDefault: false,
        label: "T20A.Mestre.Nome"
    });
}

function criarClasseFicha(Base) {
    return class FichaHaydMestre extends Base {
        static FICHA_MESTRE = true;

        static get defaultOptions() {
            const opcoes = super.defaultOptions;
            // Mantém "tormenta20": o conteúdo é o do sistema e seu CSS é preso a essa classe
            opcoes.classes = [...new Set([...opcoes.classes, CLASSE_MESTRE])];
            opcoes.width = 680;
            opcoes.height = 780;
            return opcoes;
        }

        get template() {
            if (!game.user.isGM && this.actor.limited) return super.template;
            return TEMPLATE;
        }

        async getData() {
            const data = await super.getData();
            if (data.limited) return data;
            const attrs = this.actor.system.attributes;
            const arte = lerArteMestre(this.actor);
            data.hm = {
                arte: arte ?? "sem-arte",
                arteUrl: arte ? foundry.utils.getRoute(`modules/${MODULE_ID}/assets/fundos/${ARTES[arte]}`) : "",
                escudo: foundry.utils.getRoute(ESCUDO),
                pv: barra(attrs.pv),
                pm: barra(attrs.pm)
            };
            return data;
        }

        activateListeners(html) {
            super.activateListeners(html);
            const root = html instanceof HTMLElement ? html : html[0];
            // Olho sobre o retrato: abre a arte em tamanho cheio
            root.querySelector("[data-hm-acao='ver-arte']")?.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation(); // não abre o seletor de imagem do retrato
                new foundry.applications.apps.ImagePopout({
                    src: this.actor.img,
                    uuid: this.actor.uuid,
                    window: { title: this.actor.name }
                }).render({ force: true });
            });
        }
    };
}
