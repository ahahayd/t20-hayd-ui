/**
 * Ficha Hayd — ficha de personagem alternativa para o Tormenta20, inspirada
 * na Tidy 5e Sheets (layout "Quadrone"): cabeçalho com banner, barras de
 * PV/PM editáveis com deltas, cadeado de edição, barra lateral recolhível
 * (favoritos, perícias e traços), abas de Combate, Inventário, Poderes,
 * Magias, Efeitos e Diário, busca por aba, seções recolhíveis e favoritos
 * arrastáveis.
 *
 * A classe estende a ActorSheetT20Character do sistema, então rolagens,
 * arrastar e soltar, menu de contexto dos itens, equipar em espaços,
 * configuração de perícias, descanso e recursos continuam sendo os do
 * próprio sistema. A ficha só troca o template e acrescenta as interações.
 *
 * O que é só de interface (aba, lateral, seções, página do diário) muda direto
 * no DOM, sem redesenhar a ficha: redesenhar a janela inteira a cada clique é
 * o que a fazia piscar.
 */

import { modoOrigemPoderes, abrirOrganizadorComAviso, etiquetaDaOrigem } from "./origem-poderes.mjs";
import {
    ferramentasGMTools, abrirPainelEngenhocas, resetarEngenhocas, abrirPainelAutomacoes
} from "./integracao-gmtools.mjs";

const MODULE_ID = "t20-hayd-ui";
const TEMPLATES = `modules/${MODULE_ID}/templates/ficha`;
const BANNER = `modules/${MODULE_ID}/assets/fundos/header-tormenta-lateral.webp`;
const SETTING_ESTADO = "fichaEstado";
const FLAG_ORDEM_FAVORITOS = "ordemFavoritos";
/** true: sempre no Combate; false: nunca; ausente: automático (pela execução). */
const FLAG_COMBATE = "combate";
/** Fixado no topo da aba Combate (independente dos favoritos da lateral). */
const FLAG_FIXADO = "fixado";
/** Selo da CD escolhido para o personagem (chave de SELOS_CD, no ator). */
const FLAG_SELO_CD = "seloCd";
/** Selos da CD de magias: chave → arquivo em assets/selos/ e nome na escolha. */
const SELOS_CD = {
    arcano: { arquivo: "selo-cd-arcano.webp", nome: "Arcano" },
    aberrante: { arquivo: "selo-cd-aberrante.webp", nome: "Aberrante" },
    alquimista: { arquivo: "selo-cd-alquimista.webp", nome: "Alquimista" },
    bardo: { arquivo: "selo-cd-bardo.webp", nome: "Bardo" },
    clerigo: { arquivo: "selo-cd-clerigo.webp", nome: "Clérigo" },
    "clerigo-sombrio": { arquivo: "selo-cd-clerigo-sombrio.webp", nome: "Clérigo (negativo)" },
    druida: { arquivo: "selo-cd-druida.webp", nome: "Druida" },
    "feiticeiro-acido": { arquivo: "selo-cd-feiticeiro-acido.webp", nome: "Feiticeiro (ácido)" },
    "feiticeiro-eletricidade": { arquivo: "selo-cd-feiticeiro-eletricidade.webp", nome: "Feiticeiro (eletricidade)" },
    "feiticeiro-fogo": { arquivo: "selo-cd-feiticeiro-fogo.webp", nome: "Feiticeiro (fogo)" },
    "feiticeiro-frio": { arquivo: "selo-cd-feiticeiro-frio.webp", nome: "Feiticeiro (frio)" },
    inventor: { arquivo: "selo-cd-inventor.webp", nome: "Inventor" },
    necromante: { arquivo: "selo-cd-necromante.webp", nome: "Necromante" },
    ventanista: { arquivo: "selo-cd-ventanista.webp", nome: "Ventanista" },
    veneno: { arquivo: "selo-cd-veneno.webp", nome: "Veneno" }
};
const rotaSelo = (chave) => foundry.utils.getRoute(`modules/${MODULE_ID}/assets/selos/${(SELOS_CD[chave] ?? SELOS_CD.arcano).arquivo}`);

/**
 * Deuses com ícone em assets/deuses/<nome>.svg. Quando a devoção bate
 * exatamente com um destes nomes, o ícone do deus substitui o sol no chip.
 * Os SVGs pintam com currentColor, então entram inline para herdar a cor de
 * destaque (numa <img> ficariam brancos).
 */
const DEUSES = [
    "Aharadak", "Alihanna", "Arsenal", "Azgher", "Hyninn", "Kallyadranoch", "Khalmyr",
    "Lena", "Lin-Wu", "Marah", "Megalokk", "Nimb", "Oceano", "Sszzaas", "Tanna-Toh",
    "Tenebra", "Thwor", "Thyatis", "Valkaria", "Wynna"
];
const SVG_DEUSES = new Map();

/**
 * Especialidade de um Ofício ("Ofício: Alquimia" ou "Ofício (Alquimia)" → "Alquimia"),
 * ou null se não for Ofício. Na lista os Ofícios começam todos iguais e o
 * nome cortado não dizia qual era; a lista mostra só a especialidade.
 */
function especialidadeOficio(label) {
    const oficio = game.i18n.localize("T20.SkillOfic");
    const texto = String(label ?? "").replace(/<[^>]*>/g, "").trim();
    if (!texto.startsWith(oficio)) return null;
    const resto = texto.slice(oficio.length).replace(/^\s*[:(\-–]\s*/, "").replace(/\)\s*$/, "").trim();
    return resto || null;
}

async function carregarIconesDeuses() {
    await Promise.all(DEUSES.map(async (nome) => {
        try {
            const resp = await fetch(foundry.utils.getRoute(`modules/${MODULE_ID}/assets/deuses/${nome}.svg`));
            if (resp.ok) SVG_DEUSES.set(nome, await resp.text());
        } catch (err) {
            console.warn(`${MODULE_ID} | ícone do deus ${nome} não carregou:`, err);
        }
    }));
}
/** Ordem dos fixados no topo do Combate (lista de ids, no ator). */
const FLAG_ORDEM_FIXADOS = "ordemFixados";
/** Perícias favoritadas, que ficam no topo da lista (chaves das perícias, no ator). */
const FLAG_PERICIAS_FAVORITAS = "periciasFavoritas";
/** Organização da lista de perícias: "padrao" (a do sistema), "destaque" ou "manual" (no ator). */
const FLAG_ORGANIZACAO_PERICIAS = "organizacaoPericias";
/** Ordem do modo manual: lista de { pericia } e { grupo, titulo } (separadores), no ator. */
const FLAG_ORDEM_PERICIAS = "ordemPericias";
/** Grupos separados no topo da lista no modo destaque (chaves das perícias do sistema). */
const GRUPOS_PERICIAS_DESTAQUE = [
    { titulo: "T20A.Ficha.GrupoIniciativaPercepcao", chaves: ["inic", "perc"] },
    { titulo: "T20A.Ficha.GrupoResistencias", chaves: ["fort", "refl", "vont"] }
];

/** Classe CSS da janela: o resto do módulo usa para reconhecer a ficha. */
export const CLASSE_FICHA = "hayd-ficha";

const ABAS = ["combate", "inventario", "poderes", "magias", "efeitos", "diario"];
const ABA_PADRAO = "combate";
const ABAS_LATERAIS = ["favoritos", "pericias", "tracos"];
/** Abas em que o usuário escolhe entre categorias e lista livre. */
const ABAS_ORGANIZAVEIS = ["inventario", "poderes"];

/** Ordem e ícones das seções da aba Combate (agrupadas pela execução, como a aba Ações do Tidy). */
const EXECUCOES = [
    { id: "action",   icone: "fa-solid fa-hand-fist" },
    { id: "move",     icone: "fa-solid fa-person-running" },
    { id: "full",     icone: "fa-solid fa-hourglass-half" },
    { id: "reaction", icone: "fa-solid fa-bolt" },
    { id: "free",     icone: "fa-solid fa-feather" },
    { id: "special",  icone: "fa-solid fa-star" },
    { id: "minute",   icone: "fa-regular fa-clock" },
    { id: "hour",     icone: "fa-solid fa-clock" },
    { id: "day",      icone: "fa-solid fa-sun" }
];

const INVENTARIO = [
    { id: "arma",        icone: "fa-solid fa-khanda",        rotulo: "T20.Weapons" },
    { id: "equipamento", icone: "fa-solid fa-shield-halved", rotulo: "T20.Equipment" },
    { id: "consumivel",  icone: "fa-solid fa-flask",         rotulo: "T20A.Ficha.Consumiveis" },
    { id: "tesouro",     icone: "fa-solid fa-gem",           rotulo: "T20A.Ficha.Tesouros" }
];

const CIRCULOS = [1, 2, 3, 4, 5];
const CUSTO_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

/** Tipos de poder na ordem da ficha em abas do sistema. */
const TIPOS_PODER = ["ability", "classe", "racial", "origem", "geral", "concedido", "distincao", "complicacao"];

/* -------------------------------------------------------------------------- */
/*  Registro                                                                   */
/* -------------------------------------------------------------------------- */

export function registrarConfiguracoesFicha() {
    game.settings.register(MODULE_ID, SETTING_ESTADO, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });
    // Modo slim: ficha estreita por padrão, sem o logo, abas com nome completo
    // Busca na lista de perícias (lateral); desligável na janela "Configurar ficha"
    game.settings.register(MODULE_ID, "fichaBuscaPericias", {
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
        onChange: () => { for (const app of Object.values(ui.windows)) if (ehFichaHayd(app)) app.render(false); }
    });
    game.settings.register(MODULE_ID, "fichaSlim", {
        name: "T20A.Settings.FichaSlimName",
        hint: "T20A.Settings.FichaSlimHint",
        scope: "client",
        config: false, // fica na janela "Configurar ficha" (botão Sheet), não nas do módulo
        type: Boolean,
        default: false,
        onChange: (slim) => {
            for (const app of Object.values(ui.windows)) {
                if (!ehFichaHayd(app)) continue;
                app.setPosition({ width: slim ? LARGURA_SLIM : LARGURA_PADRAO });
                app.render(false);
            }
        }
    });
}

/**
 * Caixa "Modo slim" na janela "Configurar ficha" (botão Sheet do cabeçalho),
 * em personagens; só aparece com a Ficha Hayd selecionada nela. Grava direto
 * na configuração do usuário ao marcar, sem depender do botão salvar.
 */
Hooks.on("renderDocumentSheetConfig", (app, html) => {
    const doc = app.document;
    if (doc?.documentName !== "Actor" || doc.type !== "character") return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const seletor = root?.querySelector('select[name="sheetClass"]');
    if (!seletor || root.querySelector(".hf-config-slim")) return;
    const grupo = document.createElement("div");
    grupo.className = "form-group hf-config-slim";
    grupo.innerHTML = `
        <label>${game.i18n.localize("T20A.Settings.FichaSlimName")}</label>
        <div class="form-fields"><input type="checkbox" ${modoSlim() ? "checked" : ""}></div>
        <p class="hint">${game.i18n.localize("T20A.Settings.FichaSlimHint")}</p>`;
    grupo.querySelector("input").addEventListener("change", (ev) => {
        game.settings.set(MODULE_ID, "fichaSlim", ev.currentTarget.checked);
    });
    seletor.closest(".form-group").after(grupo);
    // Mostrar o logo do Tormenta 20 (vale para todas as fichas de personagem, só para você)
    const grupoLogo = document.createElement("div");
    grupoLogo.className = "form-group hf-config-logo";
    grupoLogo.innerHTML = `
        <label>${game.i18n.localize("T20A.Settings.MostrarLogoName")}</label>
        <div class="form-fields"><input type="checkbox" ${game.settings.get(MODULE_ID, "mostrarLogo") ? "checked" : ""}></div>
        <p class="hint">${game.i18n.localize("T20A.Settings.MostrarLogoHint")}</p>`;
    grupoLogo.querySelector("input").addEventListener("change", (ev) => {
        game.settings.set(MODULE_ID, "mostrarLogo", ev.currentTarget.checked);
    });
    grupo.after(grupoLogo);
    const grupoBusca = document.createElement("div");
    grupoBusca.className = "form-group hf-config-busca";
    grupoBusca.innerHTML = `
        <label>${game.i18n.localize("T20A.Ficha.BuscaPericiasNome")}</label>
        <div class="form-fields"><input type="checkbox" ${game.settings.get(MODULE_ID, "fichaBuscaPericias") ? "checked" : ""}></div>
        <p class="hint">${game.i18n.localize("T20A.Ficha.BuscaPericiasHint")}</p>`;
    grupoBusca.querySelector("input").addEventListener("change", (ev) => {
        game.settings.set(MODULE_ID, "fichaBuscaPericias", ev.currentTarget.checked);
    });
    grupoLogo.after(grupoBusca);
    // Aparece quando a Ficha Hayd é a escolhida (ou é a padrão e está em uso)
    const atualizar = () => {
        const valor = seletor.value || (ehFichaHayd(doc.sheet) ? `${MODULE_ID}.FichaHaydPersonagem` : "");
        grupo.hidden = valor !== `${MODULE_ID}.FichaHaydPersonagem`;
        grupoBusca.hidden = grupo.hidden; // só faz sentido com a Ficha Hayd, como o modo slim
    };
    seletor.addEventListener("change", atualizar);
    atualizar();
    app.setPosition?.({ height: "auto" });
});

const LARGURA_PADRAO = 980;
const LARGURA_SLIM = 795;
const modoSlim = () => {
    try { return game.settings.get(MODULE_ID, "fichaSlim") === true; } catch (_) { return false; }
};

/**
 * Registra a ficha. Precisa rodar depois do init do sistema, que é quem
 * cria a ActorSheetT20Character que ela estende.
 */
export async function registrarFichaHayd() {
    const Base = game.tormenta20?.applications?.ActorSheetT20Character
        ?? CONFIG.Actor.sheetClasses?.character?.["tormenta20.ActorSheetT20Character"]?.cls;
    if (!Base) {
        console.warn(`${MODULE_ID} | ficha do personagem do sistema não encontrada; Ficha Hayd não registrada.`);
        return;
    }
    const FichaHayd = criarClasseFicha(Base);
    foundry.documents.collections.Actors.registerSheet(MODULE_ID, FichaHayd, {
        types: ["character"],
        makeDefault: false,
        label: "T20A.Ficha.Nome"
    });
    await foundry.applications.handlebars.loadTemplates([
        `${TEMPLATES}/ficha.hbs`,
        `${TEMPLATES}/cabecalho.hbs`,
        `${TEMPLATES}/lateral.hbs`,
        `${TEMPLATES}/linha-item.hbs`,
        `${TEMPLATES}/secao-itens.hbs`,
        `${TEMPLATES}/ferramentas.hbs`,
        `${TEMPLATES}/aba-combate.hbs`,
        `${TEMPLATES}/aba-inventario.hbs`,
        `${TEMPLATES}/aba-poderes.hbs`,
        `${TEMPLATES}/aba-magias.hbs`,
        `${TEMPLATES}/aba-efeitos.hbs`,
        `${TEMPLATES}/aba-diario.hbs`
    ]);
    await carregarIconesDeuses();
}

/** A ficha é uma Ficha Hayd? (usado pelo tema para não aplicar o estilo antigo nela) */
export function ehFichaHayd(app) {
    return !!app?.constructor?.FICHA_HAYD;
}

/* -------------------------------------------------------------------------- */
/*  Estado por usuário (aba, lateral, seções recolhidas, organização)          */
/* -------------------------------------------------------------------------- */

const ESTADO_PADRAO = {
    aba: ABA_PADRAO,
    lateral: true,
    lateralAba: "pericias",
    recolhidas: {},
    diario: "biography",
    organizacao: { inventario: "categorias", poderes: "categorias" }
};

function lerEstado(actor) {
    const todos = game.settings.get(MODULE_ID, SETTING_ESTADO) ?? {};
    return foundry.utils.mergeObject(foundry.utils.deepClone(ESTADO_PADRAO), todos[actor.id] ?? {}, { inplace: false });
}

/** Grava o estado inteiro do ator (sem mergeObject, para chaves apagadas sumirem de verdade). */
async function gravarEstado(actor, estado) {
    const todos = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_ESTADO) ?? {});
    todos[actor.id] = estado;
    await game.settings.set(MODULE_ID, SETTING_ESTADO, todos);
}

async function salvarEstado(actor, mudancas) {
    await gravarEstado(actor, foundry.utils.mergeObject(lerEstado(actor), mudancas, { inplace: false }));
}

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

const pct = (valor, max) => (max > 0 ? Math.clamp(Math.round((valor / max) * 100), 0, 100) : 0);

const comSinal = (n) => {
    const v = Number(n) || 0;
    return { sinal: v < 0 ? "−" : "+", valor: Math.abs(v), negativo: v < 0 };
};

/**
 * Interpreta o que foi digitado num campo com delta, como no Tidy:
 * "+5" soma, "-3" subtrai, "=7" ou "7" define.
 */
function aplicarDelta(texto, atual) {
    const s = String(texto ?? "").trim().replace(",", ".");
    if (!s) return atual;
    const m = s.match(/^([+\-=])?\s*(\d+(?:\.\d+)?)$/);
    if (!m) return atual;
    const n = Number(m[2]);
    if (m[1] === "+") return atual + n;
    if (m[1] === "-") return atual - n;
    return n;
}

function localizar(chave) {
    return game.i18n.localize(chave);
}

/** Troca uma classe e anima a entrada do elemento que ficou visível. */
function animarEntrada(el, classe = "hf-anim-entrar") {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth; // reinicia a animação
    el.classList.add(classe);
    el.addEventListener("animationend", () => el.classList.remove(classe), { once: true });
}

/* -------------------------------------------------------------------------- */
/*  A classe                                                                   */
/* -------------------------------------------------------------------------- */

function criarClasseFicha(Base) {
    return class FichaHaydPersonagem extends Base {
        static FICHA_HAYD = true;

        /** Itens com a descrição aberta (mantidos entre renders, como no Tidy). */
        _expandidos = new Set();
        /** HTML das descrições já montadas: reabrir depois de um render é instantâneo. */
        _descricoes = new Map();
        /** Busca digitada em cada aba (só na memória da janela). */
        _busca = {};

        static get defaultOptions() {
            const opcoes = foundry.utils.mergeObject(super.defaultOptions, {
                width: modoSlim() ? LARGURA_SLIM : LARGURA_PADRAO,
                height: 860,
                tabs: [],
                scrollY: [".hf-lateral-painel", ".hf-aba"],
                dragDrop: [{ dragSelector: ".item-list .item:not(.item-header)" }]
            });
            // Sem "tormenta20": o CSS do sistema é todo preso a essa classe,
            // e esta ficha tem o próprio visual.
            opcoes.classes = ["tormenta20-hayd", "sheet", "actor", "character", CLASSE_FICHA];
            return opcoes;
        }

        get template() {
            if (!game.user.isGM && this.actor.limited) return super.template;
            return `${TEMPLATES}/ficha.hbs`;
        }

        get layout() {
            return "character-base";
        }

        get desbloqueada() {
            return this.isEditable && this._mode === this.constructor.MODES.EDIT;
        }

        /* ------------------------------------------------------------------ */
        /*  Dados                                                              */
        /* ------------------------------------------------------------------ */

        async getData() {
            const data = await super.getData();
            if (data.limited) return data;
            const actor = this.actor;
            const sys = actor.system;
            const estado = lerEstado(actor);
            const desbloqueada = this.desbloqueada;
            const editavel = this.isEditable;

            const aba = ABAS.includes(estado.aba) ? estado.aba : ABA_PADRAO;
            const lateralAba = ABAS_LATERAIS.includes(estado.lateralAba) ? estado.lateralAba : "pericias";
            const pv = sys.attributes.pv;
            const pm = sys.attributes.pm;
            const nivel = sys.attributes.nivel;
            const carga = sys.attributes.carga ?? {};

            const magiasEng = actor.itemTypes.magia ?? [];
            // Só vale marcar engenhoca quando há as duas coisas na lista
            this._marcarEngenhoca = magiasEng.some((m) => m.system.tipo === "eng")
                && magiasEng.some((m) => m.system.tipo !== "eng");
            // "Origem dos poderes" (opção do módulo): etiqueta nas linhas e botão na aba Poderes
            this._origemPoderes = modoOrigemPoderes() !== "desligado";

            const itensLinha = actor.items.contents
                .filter((i) => !["classe", "race"].includes(i.type))
                .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                .map((i) => this._linhaItem(i));

            const hf = {
                aba,
                abas: this._prepararAbas(aba, actor),
                desbloqueada,
                editavel,
                lateral: estado.lateral,
                lateralAba,
                // url() numa variável CSS resolve relativo à folha de estilo: manda o caminho absoluto
                banner: foundry.utils.getRoute(BANNER),
                escudo: foundry.utils.getRoute(`modules/${MODULE_ID}/assets/icones/escudo-defesa.webp`),
                selo: rotaSelo(actor.getFlag(MODULE_ID, FLAG_SELO_CD)),
                // Sugestões do campo de devoção: só os nomes que têm ícone
                deuses: DEUSES,
                listaDeuses: `hf-deuses-${this.id}`,
                // Logo na ponta direita da faixa das abas (opção "Mostrar logo do Tormenta 20")
                slim: modoSlim(),
                buscaPericias: game.settings.get(MODULE_ID, "fichaBuscaPericias") !== false,
                logo: !modoSlim() && game.settings.get(MODULE_ID, "mostrarLogo")
                    ? foundry.utils.getRoute(`modules/${MODULE_ID}/assets/icones/logo-tormenta20.webp`) : null,
                // Opções do diálogo "Cor da Ficha" (as mesmas marcações que o tema antigo lê)
                semArte: actor.getFlag(MODULE_ID, "semArte") === true,
                arteOriginal: actor.getFlag(MODULE_ID, "arteOriginal") === true,
                atributos: Object.entries(sys.atributos).map(([key, atr]) => ({
                    key,
                    abbr: localizar(CONFIG.T20.atributosAbr[key]),
                    label: localizar(CONFIG.T20.atributos[key]),
                    ...comSinal(atr.value),
                    base: atr.base,
                    racial: atr.racial,
                    bonus: atr.bonus
                })),
                pv: { ...pv, pct: pct(pv.value, pv.max), tempPct: pct(pv.temp, pv.max) },
                pm: { ...pm, pct: pct(pm.value, pm.max), tempPct: pct(pm.temp, pm.max) },
                nivel: nivel.value,
                xp: this._experiencia(nivel),
                deslocamento: this._deslocamentoCurto(),
                subtitulo: this._subtitulo(actor),
                carga: { ...carga, pctVisual: Math.clamp(carga.pct ?? 0, 0, 100) },
                cd: (sys.attributes.cd ?? 10) + (sys.atributos[sys.attributes.conjuracao]?.value ?? 0),
                conjuracao: sys.attributes.conjuracao,
                favoritos: this._favoritosOrdenados(itensLinha),
                fixados: this._ordenarPorFlag(itensLinha.filter((l) => l.fixado), FLAG_ORDEM_FIXADOS),
                organizacao: estado.organizacao,
                combate: this._secoesCombate(itensLinha, estado, desbloqueada),
                inventario: this._secoesInventario(itensLinha, estado, desbloqueada),
                poderes: this._secoesPoderes(itensLinha, estado, desbloqueada),
                magias: this._secoesMagias(itensLinha, estado, desbloqueada),
                condicoes: this._condicoes(actor),
                condicoesRecolhidas: !!estado.recolhidas["efeitos:condicoes"],
                efeitosRecolhidos: estado.recolhidas,
                pericias: this._pericias(data.skills ?? []),
                periciasModo: this._modoPericias(),
                tracos: this._tracosLivres(sys),
                diario: this._entradasDiario(sys, estado, data),
                busca: this._busca
            };
            hf.temMagias = hf.magias.some((s) => s.itens.length) || desbloqueada;
            // Selo da CD no cabeçalho: só quem de fato tem magias (não basta estar desbloqueada)
            hf.conjurador = hf.magias.some((s) => s.itens.length);
            hf.classesTamanho = this._classesTamanho ?? "";
            hf.origemPoderes = this._origemPoderes && actor.isOwner;
            // A coluna "Origem" aparece para todos que veem a ficha, com a opção ligada
            hf.origemColuna = this._origemPoderes;
            // Até o primeiro uso o botão pulsa, como na ficha do sistema
            hf.origemPoderesNovo = !game.settings.get(MODULE_ID, "origemPoderesVisto");
            // Acessos do GMTools montados com o visual da ficha (ver integracao-gmtools.mjs)
            hf.gm = ferramentasGMTools(actor);
            data.hf = hf;
            // A lista de perícias do sistema mostra os controles de edição
            // quando editMode é verdadeiro: o cadeado da ficha faz esse papel.
            data.editMode = desbloqueada;
            return data;
        }

        /** Barra de XP: progresso total, de 0 até o XP do próximo nível. */
        _experiencia(nivel) {
            const xp = nivel.xp ?? {};
            const valor = Number(xp.value) || 0;
            const proximo = Number(xp.proximo) || 0;
            return {
                ...xp,
                pct: proximo > 0 ? Math.clamp((valor / proximo) * 100, 0, 100) : 0
            };
        }

        _prepararAbas(ativa, actor) {
            const rotulos = {
                combate: ["T20A.Ficha.Abas.Combate", "fa-solid fa-swords"],
                inventario: ["T20A.Ficha.Abas.Inventario", "fa-solid fa-sack"],
                poderes: ["T20A.Ficha.Abas.Poderes", "fa-solid fa-fire-flame-curved"],
                magias: ["T20A.Ficha.Abas.Magias", "fa-solid fa-wand-sparkles"],
                efeitos: ["T20A.Ficha.Abas.Efeitos", "fa-solid fa-bolt"],
                diario: ["T20A.Ficha.Abas.Diario", "fa-solid fa-book-open"]
            };
            return ABAS.map((id) => ({
                id,
                rotulo: localizar(rotulos[id][0]),
                icone: rotulos[id][1],
                ativa: id === ativa,
                contagem: id === "efeitos" ? actor.effects.size : null
            }));
        }

        /**
         * Deslocamento sob o retrato: o MAIOR entre os tipos, com o ícone do tipo
         * (voo = asa, natação, escalada, escavar). O tooltip lista todos.
         */
        _deslocamentoCurto() {
            const mov = this.actor.system.attributes.movement;
            if (!mov) return null;
            const ICONES = {
                walk: "fa-person-running", fly: "fa-dove", swim: "fa-person-swimming",
                climb: "fa-hill-rockslide", burrow: "fa-shovel"
            };
            const unidade = mov.unit ?? "m";
            const tipos = Object.entries(CONFIG.T20.movementTypes ?? { walk: "Terrestre" })
                .map(([k, label]) => ({ k, label: localizar(label), valor: Number(mov[k]?.value ?? mov[k]?.base ?? 0) || 0 }))
                .filter((t) => t.valor > 0);
            if (!tipos.length) return { valor: 0, unidade, icone: ICONES.walk, tipo: "", todos: "" };
            // Empate: o terrestre vence (é o mais comum)
            const maior = tipos.reduce((a, b) => (b.valor > a.valor ? b : a));
            let tipo = maior.label;
            if (maior.k === "fly" && mov.hover) tipo += " (flutuando)";
            return {
                valor: maior.valor,
                unidade,
                icone: ICONES[maior.k] ?? ICONES.walk,
                tipo,
                todos: tipos.map((t) => `${t.label} ${t.valor}${unidade}`).join(" · ")
            };
        }

        _subtitulo(actor) {
            const sys = actor.system;
            const race = actor.itemTypes.race[0];
            const classes = actor.itemTypes.classe
                .slice()
                .sort((a, b) => (b.system.inicial || 0) - (a.system.inicial || 0))
                .map((c) => ({ id: c.id, nome: c.name, niveis: c.system.niveis }));
            // Com muitas classes os chips não cabem numa linha: abrevia como a ficha do sistema
            const abreviar = classes.length > 2;
            for (const c of classes) c.rotulo = abreviar ? c.nome.slice(0, 4) : c.nome;
            return {
                raca: race ? { id: race.id, nome: race.name } : null,
                classes,
                origem: sys.detalhes.origem,
                divindade: sys.detalhes.divindade,
                iconeDeus: SVG_DEUSES.get(sys.detalhes.divindade?.trim()) ?? null
            };
        }

        /** Texto livre ("outros") de cada traço, que o sistema guarda em .custom. */
        _tracosLivres(sys) {
            const t = sys.tracos ?? {};
            return {
                ic: t.ic?.custom ?? "",
                idiomas: t.idiomas?.custom ?? "",
                profArmas: t.profArmas?.custom ?? "",
                profArmaduras: t.profArmaduras?.custom ?? "",
                sentidos: sys.attributes.sentidos?.custom ?? ""
            };
        }

        /** Dados de uma linha de item, comuns a todas as tabelas. */
        _linhaItem(item) {
            const sys = item.system;
            const labels = item.labels ?? {};
            const execucao = sys.ativacao?.execucao || "";
            const temQtd = Number.isNumeric(sys.qtd);
            const favorito = !!item.flags.tormenta20?.favorito;
            const equipavel = ["arma", "equipamento"].includes(item.type)
                && !(item.type === "arma" && sys.proficiencia === "natural");
            const equipado = item.type === "arma" ? Number(sys.equipado) > 0 : !!sys.equipado;
            let detalhe = "";
            let rolagem = null;
            if (item.type === "arma") {
                detalhe = labels.dano ? `${labels.toHit} · ${labels.dano} · ${labels.critico}` : labels.toHit ?? "";
                // Separados para a tabela de armas alinhar ataque, dano e crítico em colunas
                rolagem = { ataque: labels.toHit ?? "", dano: labels.dano ?? "", critico: labels.dano ? (labels.critico ?? "") : "" };
            } else if (item.type === "equipamento") {
                const a = sys.armadura ?? {};
                if (a.value || a.penalidade) detalhe = `Def ${a.value >= 0 ? "+" : ""}${a.value ?? 0} · Pen ${a.penalidade ?? 0}`;
            }
            const custo = item.type === "magia"
                ? labels.custoPM
                : (sys.ativacao?.custo ? `${sys.ativacao.custo} PM` : "");
            const engenhoca = item.type === "magia" && sys.tipo === "eng";
            return {
                id: item.id,
                nome: item.name,
                img: item.img || CONST.DEFAULT_TOKEN,
                tipo: item.type,
                execucao,
                ativacao: labels.ativacao || (execucao ? localizar(CONFIG.T20.abilityActivationTypes?.[execucao] ?? "") : ""),
                custo,
                detalhe,
                rolagem,
                alcance: labels.range && labels.range !== "Nenhum" ? labels.range : "",
                duracao: labels.duration && labels.duration !== "Instantânea" ? labels.duration : "",
                tipoLabel: labels.tipo ? `${labels.tipo}${labels.subtipo ? `: ${labels.subtipo}` : ""}` : "",
                escola: labels.escola ?? "",
                circulo: sys.circulo,
                qtd: temQtd ? sys.qtd : null,
                espacos: temQtd ? Math.round((sys.qtd || 0) * (sys.espacos || 0) * 100) / 100 : null,
                guardado: sys.carregado === false,
                favorito,
                fixado: !!item.getFlag(MODULE_ID, FLAG_FIXADO),
                equipavel,
                equipado,
                maos: item.type === "arma" ? Number(sys.equipado) || 0 : 0,
                engenhoca,
                emCombate: this._emCombate(item, execucao),
                origem: this._origemPoderes ? etiquetaDaOrigem(item) : "",
                marcarEngenhoca: engenhoca && this._marcarEngenhoca,
                marcarMagia: item.type === "magia" && !engenhoca && this._marcarEngenhoca,
                preparavel: item.type === "magia" && !engenhoca && !!this.actor.getFlag("tormenta20", "mago"),
                preparada: !!sys.preparada,
                expandido: this._expandidos.has(item.id),
                descricao: this._expandidos.has(item.id) ? this._descricoes.get(item.id) ?? null : null
            };
        }

        /** O item aparece na aba Combate? A escolha do usuário vence a regra automática. */
        _emCombate(item, execucao) {
            const escolha = item.getFlag(MODULE_ID, FLAG_COMBATE);
            if (typeof escolha === "boolean") return escolha;
            if (item.type === "arma") return true;
            if (item.type === "poder") return true; // sem execução vai para Passivo
            return ["magia", "consumivel"].includes(item.type) && !!execucao && execucao !== "passive";
        }

        /** Favoritos na ordem que o usuário arrastou (os novos vão para o fim). */
        _favoritosOrdenados(linhas) {
            return this._ordenarPorFlag(linhas.filter((l) => l.favorito), FLAG_ORDEM_FAVORITOS);
        }

        /** Ordena linhas pela lista de ids guardada numa flag do ator (os fora dela vão para o fim). */
        _ordenarPorFlag(linhas, flag) {
            const ordem = this.actor.getFlag(MODULE_ID, flag) ?? [];
            const pos = (id) => {
                const i = ordem.indexOf(id);
                return i === -1 ? Infinity : i;
            };
            return linhas.sort((a, b) => pos(a.id) - pos(b.id));
        }

        _secao(id, rotulo, icone, itens, estado, extra = {}) {
            const chave = `${extra.aba ?? "x"}:${id}`;
            return {
                id,
                chave,
                rotulo,
                icone,
                itens,
                recolhida: !!estado.recolhidas[chave],
                ...extra
            };
        }

        _secoesCombate(linhas, estado, desbloqueada) {
            const rotuloExec = CONFIG.T20.abilityActivationTypes ?? {};
            const noCombate = linhas.filter((l) => l.emCombate);
            const ativo = (l) => l.execucao && l.execucao !== "passive";
            const acoes = noCombate.filter((l) => l.tipo === "arma" || ativo(l));
            const secoes = [];
            // Todas as armas, as empunhadas primeiro (as outras ficam esmaecidas)
            const armas = acoes.filter((l) => l.tipo === "arma").sort((a, b) => b.equipado - a.equipado);
            secoes.push(this._secao("armas", localizar("T20A.Ficha.Ataques"), "fa-solid fa-crosshairs", armas, estado, {
                aba: "combate", colunas: "armas", criar: "arma"
            }));
            for (const exec of EXECUCOES) {
                const itens = acoes.filter((l) => l.tipo !== "arma" && l.execucao === exec.id);
                secoes.push(this._secao(exec.id, localizar(rotuloExec[exec.id] ?? exec.id), exec.icone, itens, estado, {
                    aba: "combate", colunas: "acoes"
                }));
            }
            const passivos = noCombate.filter((l) => l.tipo === "poder" && !ativo(l));
            // Itens que o usuário pôs no Combate mas não têm execução
            const outros = noCombate.filter((l) => !acoes.includes(l) && !passivos.includes(l));
            secoes.push(this._secao("passive", localizar(rotuloExec.passive ?? "Passivo"), "fa-solid fa-infinity", passivos, estado, {
                aba: "combate", colunas: "acoes"
            }));
            secoes.push(this._secao("outros", localizar("T20A.Ficha.Outros"), "fa-solid fa-box-open", outros, estado, {
                aba: "combate", colunas: "acoes"
            }));
            return secoes.filter((s) => s.itens.length || (desbloqueada && s.criar));
        }

        _secoesInventario(linhas, estado, desbloqueada) {
            const tipos = INVENTARIO.map((d) => d.id);
            if (estado.organizacao?.inventario === "lista") {
                return [this._secao("tudo", localizar("T20A.Ficha.Abas.Inventario"), "fa-solid fa-sack",
                    linhas.filter((l) => tipos.includes(l.tipo)), estado, {
                        aba: "inventario", colunas: "inventario", livre: true
                    })];
            }
            return INVENTARIO.map((def) => this._secao(def.id, localizar(def.rotulo), def.icone,
                linhas.filter((l) => l.tipo === def.id), estado, {
                    aba: "inventario", colunas: "inventario", criar: def.id
                })).filter((s) => s.itens.length || desbloqueada);
        }

        _secoesPoderes(linhas, estado, desbloqueada) {
            const poderes = linhas.filter((l) => l.tipo === "poder");
            if (estado.organizacao?.poderes === "lista") {
                return [this._secao("tudo", localizar("T20A.Ficha.Abas.Poderes"), "fa-solid fa-fire", poderes, estado, {
                    aba: "poderes", colunas: "poderes", criar: "poder", livre: true
                })];
            }
            const tipos = CONFIG.T20.powerType ?? {};
            const tipoDe = (l) => this.actor.items.get(l.id).system.tipo;
            const porTipo = TIPOS_PODER.map((tipo) => this._secao(tipo, localizar(tipos[tipo] ?? tipo), "fa-solid fa-fire",
                poderes.filter((l) => tipoDe(l) === tipo), estado, {
                    aba: "poderes", colunas: "poderes", criar: "poder", criarTipo: tipo
                }));
            const conhecidos = new Set(TIPOS_PODER);
            const outros = poderes.filter((l) => !conhecidos.has(tipoDe(l)));
            if (outros.length) porTipo.push(this._secao("outros", localizar("T20A.Ficha.Outros"), "fa-solid fa-fire", outros, estado, {
                aba: "poderes", colunas: "poderes"
            }));
            return porTipo.filter((s) => s.itens.length || desbloqueada);
        }

        _secoesMagias(linhas, estado, desbloqueada) {
            const magias = linhas.filter((l) => l.tipo === "magia");
            return CIRCULOS.map((c) => this._secao(`c${c}`,
                game.i18n.format("T20A.Ficha.Circulo", { circulo: c }),
                "fa-solid fa-hat-wizard",
                magias.filter((l) => Number(l.circulo) === c), estado, {
                    aba: "magias", colunas: "magias", criar: "magia", criarCirculo: c, custo: CUSTO_CIRCULO[c]
                })).filter((s) => s.itens.length || desbloqueada);
        }

        _condicoes(actor) {
            const lista = [];
            const efeitos = CONFIG.statusEffects ?? [];
            // Condições de "imunidade a condições" do personagem (Set, array ou objeto)
            const ic = actor.system.tracos?.ic?.value;
            const imunes = new Set(ic instanceof Set ? ic : Array.isArray(ic) ? ic : Object.keys(ic ?? {}));
            // Percorre as chaves (e não for…of): no T20 1.6 as condições são
            // propriedades nomeadas do array e o for…of vem vazio.
            for (const chave of Object.keys(efeitos)) {
                const s = efeitos[chave];
                if (!s?.id || s.hud === false) continue;
                // T20 1.5 guarda o ícone da condição em "icon"; o núcleo novo usa "img"
                lista.push({ id: s.id, nome: localizar(s.name), img: s.img ?? s.icon, ativa: actor.statuses.has(s.id), imune: imunes.has(s.id) });
            }
            // Ordem fixa (alfabética): aplicar uma condição não faz a grade inteira pular
            lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
            return lista;
        }

        /**
         * Perícias visíveis em grupos. No modo padrão é um grupo só, sem
         * título; no destaque, Iniciativa e Percepção, depois os testes de
         * resistência, depois o resto. As favoritas sobem no grupo do resto.
         * No manual, a ordem e os separadores são os que o usuário montou.
         */
        _pericias(skills) {
            const manual = this._modoPericias() === "manual";
            const favoritas = new Set(manual ? [] : this.actor.getFlag(MODULE_ID, FLAG_PERICIAS_FAVORITAS) ?? []);
            const lista = skills.filter((s) => s.exibir).map((s) => ({
                ...s,
                atributoAbbr: localizar(CONFIG.T20.atributosAbr[s.atributo] ?? s.atributo),
                favorita: favoritas.has(s.key),
                oficio: especialidadeOficio(s.label),
                ...comSinal(s.value)
            }));
            this._ultimasPericias = lista;
            if (manual) return this._periciasManuais(lista);
            const grupos = [];
            let resto = lista;
            if (this._modoPericias() === "destaque") {
                for (const { titulo, chaves } of GRUPOS_PERICIAS_DESTAQUE) {
                    const itens = chaves.map((k) => lista.find((s) => s.key === k)).filter(Boolean);
                    if (itens.length) grupos.push({ titulo: localizar(titulo), itens });
                }
                const separadas = new Set(GRUPOS_PERICIAS_DESTAQUE.flatMap((g) => g.chaves));
                resto = lista.filter((s) => !separadas.has(s.key));
            }
            const topo = resto.filter((s) => s.favorita);
            // A última favorita ganha a linha que separa do resto da lista (só no padrão:
            // no destaque os títulos dos grupos já separam)
            if (!grupos.length && topo.length && topo.length < resto.length) topo.at(-1).ultimaFavorita = true;
            grupos.push({
                titulo: grupos.length ? localizar("T20.Skills") : null,
                itens: [...topo, ...resto.filter((s) => !s.favorita)]
            });
            return grupos;
        }

        /** "padrao" | "destaque" | "manual" */
        _modoPericias() {
            const modo = this.actor.getFlag(MODULE_ID, FLAG_ORGANIZACAO_PERICIAS);
            return ["destaque", "manual"].includes(modo) ? modo : "padrao";
        }

        /**
         * Modo manual: segue a lista salva ({ pericia } e { grupo, titulo }).
         * Cada separador abre um grupo; o que vem antes do primeiro fica num
         * grupo sem título. Perícias que não estão na lista (ofícios novos)
         * entram no fim; as que deixaram de existir são ignoradas.
         */
        _periciasManuais(lista) {
            const porChave = new Map(lista.map((s) => [s.key, s]));
            const grupos = [{ id: null, titulo: null, itens: [] }];
            const usadas = new Set();
            for (const entrada of this._ordemPericias(lista)) {
                if (entrada.grupo) {
                    grupos.push({ id: entrada.grupo, titulo: entrada.titulo ?? "", itens: [] });
                } else if (porChave.has(entrada.pericia) && !usadas.has(entrada.pericia)) {
                    usadas.add(entrada.pericia);
                    grupos.at(-1).itens.push(porChave.get(entrada.pericia));
                }
            }
            grupos.at(-1).itens.push(...lista.filter((s) => !usadas.has(s.key)));
            // O grupo inicial sem título só aparece se tiver alguma perícia
            return grupos.filter((g) => g.id || g.itens.length);
        }

        /** Ordem manual salva; sem nenhuma, começa pela organização em destaque. */
        _ordemPericias(lista) {
            const salva = this.actor.getFlag(MODULE_ID, FLAG_ORDEM_PERICIAS);
            if (Array.isArray(salva) && salva.length) return salva;
            // Começa com um grupo só, em ordem alfabética
            return [
                { grupo: foundry.utils.randomID(), titulo: localizar("T20A.Ficha.NovoGrupo") },
                ...this._emOrdemAlfabetica(lista.map((s) => s.key)).map((k) => ({ pericia: k }))
            ];
        }

        /** Chaves de perícia ordenadas pelo nome exibido (o rótulo pode ter HTML). */
        _emOrdemAlfabetica(chaves) {
            const nomes = new Map((this._ultimasPericias ?? []).map((s) => [s.key, String(s.label ?? s.key).replace(/<[^>]*>/g, "").trim()]));
            const nome = (k) => nomes.get(k) ?? k;
            return [...chaves].sort((a, b) => nome(a).localeCompare(nome(b), game.i18n.lang));
        }

        /** Reordena em ordem alfabética dentro de cada grupo, sem mexer nos grupos. */
        async _ordenarPericiasAlfabetica() {
            const ordem = [];
            let bloco = [];
            const fecharBloco = () => {
                ordem.push(...this._emOrdemAlfabetica(bloco).map((k) => ({ pericia: k })));
                bloco = [];
            };
            const atual = this._ordemPericiasAtual();
            for (const entrada of atual) {
                if (entrada.grupo) { fecharBloco(); ordem.push(entrada); }
                else bloco.push(entrada.pericia);
            }
            // Perícias que ainda não estavam na ordem (ofícios novos) ficam no último grupo, como na tela
            const presentes = new Set(atual.map((e) => e.pericia).filter(Boolean));
            bloco.push(...(this._ultimasPericias ?? []).map((s) => s.key).filter((k) => !presentes.has(k)));
            fecharBloco();
            await this.actor.setFlag(MODULE_ID, FLAG_ORDEM_PERICIAS, ordem);
        }

        /** Lê a ordem que ficou na tela (linhas e separadores) e grava. */
        async _salvarOrdemPericias(ul) {
            const ordem = [...ul.querySelectorAll(":scope > .hf-pericia[data-item-id], :scope > .hf-pericias-grupo[data-grupo-id]")]
                .map((li) => li.dataset.grupoId
                    ? { grupo: li.dataset.grupoId, titulo: li.querySelector(".hf-grupo-titulo")?.value ?? "" }
                    : { pericia: li.dataset.itemId });
            await this.actor.setFlag(MODULE_ID, FLAG_ORDEM_PERICIAS, ordem);
        }

        /** Ordem atual completa (salva ou a inicial), para editar separadores. */
        _ordemPericiasAtual() {
            const lista = (this._ultimasPericias ?? []);
            return foundry.utils.deepClone(this._ordemPericias(lista));
        }

        async _adicionarSeparadorPericias() {
            const ordem = this._ordemPericiasAtual();
            ordem.unshift({ grupo: foundry.utils.randomID(), titulo: localizar("T20A.Ficha.NovoGrupo") });
            await this.actor.setFlag(MODULE_ID, FLAG_ORDEM_PERICIAS, ordem);
        }

        async _editarSeparadorPericias(id, titulo) {
            const ordem = this._ordemPericiasAtual();
            const alvo = ordem.find((e) => e.grupo === id);
            if (!alvo) return;
            alvo.titulo = titulo;
            await this.actor.setFlag(MODULE_ID, FLAG_ORDEM_PERICIAS, ordem);
        }

        async _removerSeparadorPericias(id) {
            const ordem = this._ordemPericiasAtual().filter((e) => e.grupo !== id);
            await this.actor.setFlag(MODULE_ID, FLAG_ORDEM_PERICIAS, ordem);
        }

        /**
         * Arrastar linhas e separadores no modo manual. Só pela alça: a linha
         * vira arrastável ao apertar nela, para não brigar com os campos.
         */
        _ligarArrastePericias(root) {
            const ul = root.querySelector(".hf-pericias.hf-manual");
            if (!ul || !this.desbloqueada) return;
            let arrastado = null;

            const linhas = () => [...ul.querySelectorAll(":scope > .hf-pericia[data-item-id], :scope > .hf-pericias-grupo[data-grupo-id]")];
            const moverAnimado = (el, antes) => {
                if (el.nextElementSibling === antes) return;
                const todas = linhas();
                const antigas = new Map(todas.map((c) => [c, c.getBoundingClientRect().top]));
                ul.insertBefore(el, antes);
                for (const c of todas) {
                    const dy = antigas.get(c) - c.getBoundingClientRect().top;
                    if (!dy) continue;
                    c.style.transition = "none";
                    c.style.transform = `translateY(${dy}px)`;
                    requestAnimationFrame(() => {
                        c.style.transition = "transform 0.15s ease";
                        c.style.transform = "";
                    });
                }
            };
            // Linha antes da qual entrar; no fim, antes da linha de novo ofício (se houver)
            const referencia = (y) => {
                for (const li of linhas()) {
                    if (li === arrastado) continue;
                    const r = li.getBoundingClientRect();
                    if (y < r.top + r.height / 2) return li;
                }
                return ul.querySelector(":scope > .hf-pericia-nova");
            };

            ul.addEventListener("pointerdown", (ev) => {
                const alca = ev.target.closest?.(".hf-arrastar");
                if (alca) alca.closest("li").draggable = true;
            });
            ul.addEventListener("dragstart", (ev) => {
                const li = ev.target.closest?.("li[draggable='true']");
                if (!li) return;
                arrastado = li;
                ev.dataTransfer.effectAllowed = "move";
                ev.dataTransfer.setData("text/plain", "hf-pericia");
                requestAnimationFrame(() => li.classList.add("hf-arrastado"));
            }, true); // captura: o DragDrop da Foundry interrompe a propagação do dragstart
            ul.addEventListener("dragover", (ev) => {
                if (!arrastado) return;
                ev.preventDefault();
                moverAnimado(arrastado, referencia(ev.clientY));
            });
            ul.addEventListener("drop", (ev) => {
                if (!arrastado) return;
                ev.preventDefault();
                ev.stopPropagation(); // não é um drop de item para a ficha
                this._salvarOrdemPericias(ul);
            });
            ul.addEventListener("dragend", () => {
                if (!arrastado) return;
                arrastado.classList.remove("hf-arrastado");
                arrastado.draggable = false;
                arrastado = null;
            });
        }

        async _alternarPericiaFavorita(chave) {
            const atuais = this.actor.getFlag(MODULE_ID, FLAG_PERICIAS_FAVORITAS) ?? [];
            const novas = atuais.includes(chave) ? atuais.filter((k) => k !== chave) : [...atuais, chave];
            await this.actor.setFlag(MODULE_ID, FLAG_PERICIAS_FAVORITAS, novas);
        }

        _entradasDiario(sys, estado, data) {
            const d = sys.detalhes;
            const entradas = [
                { id: "biography", nome: localizar("T20.Biography"), html: data.htmlFields.biography, alvo: "system.detalhes.biography.value", fixo: true }
            ];
            if (!data.disableJournal) {
                entradas.push({ id: "diario", nome: localizar("T20.JournalEntry"), html: data.htmlFields.diario, alvo: "system.detalhes.diario.value", fixo: true });
                for (const n of [1, 2, 3, 4]) {
                    const k = `diario${n}`;
                    entradas.push({
                        id: k,
                        nome: d[k]?.name || localizar(`T20.Journal${n}`),
                        campoNome: `system.detalhes.${k}.name`,
                        valorNome: d[k]?.name ?? "",
                        placeholder: localizar(`T20.Journal${n}`),
                        html: data.htmlFields[k],
                        alvo: `system.detalhes.${k}.value`
                    });
                }
            }
            const ativa = entradas.find((e) => e.id === estado.diario) ?? entradas[0];
            for (const e of entradas) e.ativa = e === ativa;
            return { entradas };
        }

        /* ------------------------------------------------------------------ */
        /*  Interações                                                         */
        /* ------------------------------------------------------------------ */

        activateListeners(html) {
            super.activateListeners(html);
            const root = html[0];
            if (!root || (this.actor.limited && !game.user.isGM)) return;
            const ligar = (seletor, evento, fn) =>
                root.querySelectorAll(seletor).forEach((el) => el.addEventListener(evento, fn));

            // Navegação: só DOM, nada de redesenhar a ficha
            ligar("[data-hf-aba]", "click", (ev) => this._trocarAba(ev.currentTarget.dataset.hfAba));
            ligar("[data-hf-lateral-aba]", "click", (ev) => this._trocarLateral(ev.currentTarget.dataset.hfLateralAba));
            ligar("[data-hf-acao='lateral']", "click", () => this._alternarLateral());
            ligar("[data-hf-secao]", "click", (ev) => {
                if (ev.target.closest("a, button:not([data-hf-secao]), input")) return;
                this._alternarSecao(ev.currentTarget);
            });
            ligar("[data-hf-diario]", "click", (ev) => this._trocarDiario(ev.currentTarget.dataset.hfDiario));
            ligar(".hf-item-nome", "click", (ev) => this._alternarDescricao(ev));
            root.querySelectorAll("input[data-hf-busca]").forEach((el) => {
                el.addEventListener("input", (ev) => this._filtrar(ev.currentTarget));
                if (el.value) this._filtrar(el);
            });
            ligar("[data-hf-acao='expandir-tudo']", "click", (ev) => this._expandirTudo(ev));
            // Olho sobre o retrato: abre a arte em tamanho cheio (qualquer um que veja a ficha)
            ligar("[data-hf-acao='ver-arte']", "click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation(); // não abre o seletor de imagem do retrato
                new foundry.applications.apps.ImagePopout({
                    src: this.actor.img,
                    uuid: this.actor.uuid,
                    window: { title: this.actor.name }
                }).render({ force: true });
            });
            ligar("[data-hf-acao='copiar-nome']", "click", () => {
                game.clipboard.copyPlainText(this.actor.name);
                ui.notifications.info(game.i18n.format("T20A.Ficha.Copiado", { texto: this.actor.name }));
            });
            ligar(".hf-pino[data-item-id]", "click", (ev) => {
                if (ev.target.closest("[data-hf-acao]")) return;
                this.actor.items.get(ev.currentTarget.dataset.itemId)?.roll({ event: ev });
            });

            // "⋮" abre o mesmo menu do clique direito (editar, duplicar, equipar em espaço…)
            ligar("[data-hf-acao='menu']", "click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const r = ev.currentTarget.getBoundingClientRect();
                ev.currentTarget.closest("li.item")?.dispatchEvent(new MouseEvent("contextmenu", {
                    bubbles: true, cancelable: true, clientX: r.left, clientY: r.bottom
                }));
            });

            // Descrições abertas que ainda não estavam no cache (primeira abertura)
            for (const id of this._expandidos) {
                if (this._descricoes.has(id)) continue;
                root.querySelectorAll(`li.item[data-item-id="${id}"]`).forEach((li) => this._mostrarDescricao(li, false));
            }

            this._ligarArrasteFavoritos(root);
            this._ligarArrasteFixados(root);
            // Busca nas perícias: filtra por nome ou sigla do atributo, sem acento; Esc limpa
            const busca = root.querySelector("input[data-hf-busca-pericias]");
            if (busca) {
                busca.addEventListener("input", () => this._filtrarPericias(busca));
                busca.addEventListener("keydown", (ev) => {
                    if (ev.key !== "Escape" || !busca.value) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    busca.value = "";
                    this._filtrarPericias(busca);
                });
            }
            this._ligarArrastePericias(root);
            this._observarSubtitulo(root);
            this._observarTamanho(root);
            if (this.isEditable) this._menuRacaClasse(root);

            if (!this.isEditable) return;

            ligar("[data-hf-acao='cadeado']", "click", () => this._alternarCadeado());
            root.querySelectorAll("input[data-hf-delta]").forEach((el) => {
                el.addEventListener("focus", (ev) => ev.currentTarget.select());
                el.addEventListener("change", (ev) => this._onDelta(ev));
                el.addEventListener("keydown", (ev) => {
                    if (ev.key === "Escape") {
                        ev.currentTarget.value = ev.currentTarget.defaultValue;
                        ev.currentTarget.blur();
                    }
                });
            });
            ligar("[data-hf-barra]", "click", (ev) => {
                const input = ev.currentTarget.querySelector("input[data-hf-delta]");
                if (ev.target === input || ev.target.closest("button, label")) return;
                input?.focus();
            });
            ligar("[data-hf-passo]", "click", (ev) => this._onPasso(ev));
            ligar("[data-hf-acao='favorito']", "click", (ev) => this._onFavorito(ev));
            ligar("[data-hf-acao='fixar']", "click", (ev) => {
                ev.stopPropagation();
                const item = this._itemDoEvento(ev);
                item?.setFlag(MODULE_ID, FLAG_FIXADO, !item.getFlag(MODULE_ID, FLAG_FIXADO));
            });
            ligar("[data-hf-acao='organizacao-pericias']", "change", (ev) => {
                ev.stopPropagation();
                const modo = ev.currentTarget.value;
                const mudancas = { [`flags.${MODULE_ID}.${FLAG_ORGANIZACAO_PERICIAS}`]: modo };
                // Primeira vez no manual: grava a ordem inicial, para os separadores terem ids fixos
                if (modo === "manual" && !this.actor.getFlag(MODULE_ID, FLAG_ORDEM_PERICIAS)?.length) {
                    mudancas[`flags.${MODULE_ID}.${FLAG_ORDEM_PERICIAS}`] = this._ordemPericiasAtual();
                }
                this.actor.update(mudancas);
            });
            ligar("[data-hf-acao='separador-pericias']", "click", () => this._adicionarSeparadorPericias());
            ligar("[data-hf-acao='pericias-alfabetica']", "click", () => this._ordenarPericiasAlfabetica());
            ligar("[data-hf-acao='remover-separador']", "click", (ev) => {
                ev.stopPropagation();
                this._removerSeparadorPericias(ev.currentTarget.closest("[data-grupo-id]").dataset.grupoId);
            });
            ligar(".hf-grupo-titulo", "change", (ev) => {
                ev.stopPropagation();
                this._editarSeparadorPericias(ev.currentTarget.closest("[data-grupo-id]").dataset.grupoId, ev.currentTarget.value.trim());
            });
            ligar("[data-hf-acao='pericia-favorita']", "click", (ev) => {
                ev.stopPropagation();
                this._alternarPericiaFavorita(ev.currentTarget.dataset.pericia);
            });
            ligar("[data-hf-acao='equipar']", "click", (ev) => this._onEquipar(ev));
            ligar("[data-hf-acao='editar']", "click", (ev) => this._itemDoEvento(ev)?.sheet.render(true));
            ligar("[data-hf-acao='excluir']", "click", (ev) => this._onExcluir(ev));
            ligar("[data-hf-acao='criar']", "click", (ev) => this._onCriar(ev));
            ligar("[data-hf-acao='organizacao']", "click", (ev) => this._alternarOrganizacao(ev.currentTarget.dataset.aba));
            ligar("[data-hf-acao='trocar-selo']", "click", (ev) => {
                ev.preventDefault();
                this._escolherSelo();
            });
            ligar("[data-hf-acao='origem-poderes']", "click", (ev) => {
                ev.preventDefault();
                ev.currentTarget.classList.remove("hf-pulsando");
                // Na aba Magias o botão abre a tela já na aba de magias
                abrirOrganizadorComAviso(this.actor, this.element[0], ev.currentTarget.dataset.aba || null);
            });
            ligar("[data-hf-acao='condicao']", "click", (ev) => {
                // Resposta imediata: o botão acende já no clique; o redesenho que vem
                // depois (efeito criado) só confirma o estado
                const botao = ev.currentTarget;
                botao.classList.toggle("ativa");
                this.actor.toggleStatusEffect(botao.dataset.condicao);
            });
            ligar("[data-hf-acao='guardar']", "click", (ev) => {
                const item = this._itemDoEvento(ev);
                item?.update({ "system.carregado": !(item.system.carregado ?? true) });
            });
            ligar("[data-hf-acao='classe']", "click", (ev) => this.actor.items.get(ev.currentTarget.dataset.itemId)?.sheet.render(true));
            ligar("[data-hf-acao='compendio']", "click", (ev) => game.packs.get(ev.currentTarget.dataset.pack)?.render(true));
            ligar("[data-hf-acao='imagem']", "click", (ev) => this._onEditarImagem(ev));
            ligar("[data-hf-acao='engenhocas']", "click", (ev) => {
                ev.preventDefault();
                abrirPainelEngenhocas(this.actor);
            });
            ligar("[data-hf-acao='engenhocas-resetar']", "click", async (ev) => {
                ev.preventDefault();
                const botao = ev.currentTarget;
                botao.disabled = true;
                try { await resetarEngenhocas(this.actor); }
                finally { if (botao.isConnected) botao.disabled = false; }
            });
            ligar("[data-hf-acao='automacoes']", "click", (ev) => {
                ev.preventDefault();
                abrirPainelAutomacoes(this.actor);
            });
        }

        /**
         * Origem e devoção ficam sempre na linha do subtítulo; quando ela não
         * cabe na largura da janela, os dois viram só ícone (o texto vai para o
         * tooltip). Mede de novo a cada mudança de tamanho.
         */
        _observarSubtitulo(root) {
            this._obsSubtitulo?.disconnect();
            const sub = root.querySelector(".hf-subtitulo");
            if (!sub) return;
            const medir = () => {
                sub.classList.remove("hf-compacto");
                if (sub.scrollWidth > sub.clientWidth + 1) sub.classList.add("hf-compacto");
            };
            this._obsSubtitulo = new ResizeObserver(medir);
            this._obsSubtitulo.observe(sub);
            medir();
        }

        /**
         * Clique direito nos chips de raça e classe do cabeçalho: editar,
         * subir/descer nível (classe) e remover. O menu de itens do sistema
         * só funciona em linhas de lista, por isso este é próprio.
         */
        _menuRacaClasse(root) {
            const itemDe = (el) => this.actor.items.get((el[0] ?? el).dataset.itemId);
            const limite = game.settings.get("tormenta20", "gameSystem") === "Skyfall" ? 10 : 20;
            new foundry.applications.ux.ContextMenu.implementation(root, ".hf-chip[data-item-id]", [
                {
                    name: "T20.Edit",
                    icon: '<i class="fa-solid fa-pen-to-square"></i>',
                    callback: (el) => itemDe(el)?.sheet.render(true)
                },
                {
                    name: "T20.LevelUp",
                    icon: '<i class="fa-solid fa-plus"></i>',
                    condition: (el) => {
                        const i = itemDe(el);
                        return i?.type === "classe" && i.system.niveis < limite;
                    },
                    callback: (el) => {
                        const i = itemDe(el);
                        i?.update({ "system.niveis": i.system.niveis + 1 });
                    }
                },
                {
                    name: "T20.LevelDown",
                    icon: '<i class="fa-solid fa-minus"></i>',
                    condition: (el) => {
                        const i = itemDe(el);
                        return i?.type === "classe" && i.system.niveis > 1;
                    },
                    callback: (el) => {
                        const i = itemDe(el);
                        i?.update({ "system.niveis": i.system.niveis - 1 });
                    }
                },
                {
                    name: "T20A.Ficha.Remover",
                    icon: '<i class="fa-solid fa-trash"></i>',
                    callback: (el) => itemDe(el)?.deleteDialog()
                }
            ], { jQuery: false, fixed: true });
        }

        /** Mostra só as perícias cujo nome ou sigla do atributo contém o texto. */
        _filtrarPericias(input) {
            const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
            const termo = norm(input.value);
            const lista = input.closest("[data-painel]")?.querySelector(".hf-pericias");
            if (!lista) return;
            let grupo = null, grupoTemVisivel = false;
            const fecharGrupo = () => { if (grupo) grupo.hidden = !!termo && !grupoTemVisivel; };
            for (const li of lista.children) {
                if (li.classList.contains("hf-pericias-grupo")) {
                    fecharGrupo();
                    grupo = li;
                    grupoTemVisivel = false;
                    continue;
                }
                if (!li.classList.contains("hf-pericia")) continue;
                // Ofícios mostram só o nome do ofício; o rótulo completo ("Ofício: …") fica no tooltip
                const el = li.querySelector(".hf-pericia-nome");
                const nome = norm(`${el?.textContent ?? ""} ${el?.dataset.tooltip ?? ""}`);
                const atr = norm(li.querySelector(".hf-pericia-atr")?.textContent ?? "");
                const ok = !termo || nome.includes(termo) || atr.startsWith(termo);
                li.hidden = !ok;
                if (ok) grupoTemVisivel = true;
            }
            fecharGrupo();
            lista.classList.toggle("hf-filtrando", !!termo);
        }

        /** Janela com a grade de selos da CD: clicar num deles grava e fecha. */
        _escolherSelo() {
            const atual = this.actor.getFlag(MODULE_ID, FLAG_SELO_CD) || "arcano";
            const opcoes = Object.entries(SELOS_CD).map(([chave, s]) => `
                <button type="button" class="hf-selo-opcao ${chave === atual ? "ativo" : ""}" data-selo="${chave}" data-tooltip="${s.nome}">
                    <img src="${rotaSelo(chave)}" alt="">
                    <span>${s.nome}</span>
                </button>`).join("");
            const dialogo = new foundry.applications.api.DialogV2({
                window: { title: game.i18n.localize("T20A.Ficha.TrocarSelo"), icon: "fa-solid fa-circle-nodes" },
                classes: [CLASSE_FICHA, "hf-selo-dialogo"],
                position: { width: 460 },
                content: `<div class="hf-selo-grade">${opcoes}</div>`,
                buttons: [{ action: "fechar", label: game.i18n.localize("T20A.Cancel"), icon: "fa-solid fa-xmark", default: true }]
            });
            dialogo.addEventListener("render", () => {
                dialogo.element.querySelectorAll("[data-selo]").forEach((b) => b.addEventListener("click", async () => {
                    const chave = b.dataset.selo;
                    // "arcano" é o padrão: grava sem flag, para não sobrar dado à toa
                    if (chave === "arcano") await this.actor.unsetFlag(MODULE_ID, FLAG_SELO_CD);
                    else await this.actor.setFlag(MODULE_ID, FLAG_SELO_CD, chave);
                    dialogo.close();
                }));
            }, { once: true });
            dialogo.render({ force: true });
        }

        /**
         * Responsividade: mede a largura e a altura da ficha e marca classes
         * (hf-w-md < 1000, hf-w-sm < 860, hf-w-xs < 680, hf-w-xxs < 560,
         * hf-h-baixa < 620 de altura). O CSS reorganiza o interior por elas.
         */
        _observarTamanho(root) {
            this._obsTamanho?.disconnect();
            const form = root.querySelector("form.hf-ficha") ?? root.closest?.("form.hf-ficha") ?? (root.matches?.("form.hf-ficha") ? root : null);
            if (!form) return;
            const aplicar = () => {
                const w = form.clientWidth, h = form.clientHeight;
                if (!w) return;
                form.classList.toggle("hf-w-md", w < 1000);
                form.classList.toggle("hf-w-sm", w < 860);
                form.classList.toggle("hf-w-xs", w < 680);
                form.classList.toggle("hf-w-xxs", w < 560);
                form.classList.toggle("hf-h-baixa", h < 620);
                // Guarda para o próximo redesenho já nascer com elas (sem animar a lateral)
                this._classesTamanho = ["hf-w-md", "hf-w-sm", "hf-w-xs", "hf-w-xxs", "hf-h-baixa"]
                    .filter((c) => form.classList.contains(c)).join(" ");
                // A gaveta só existe na janela estreita
                form.classList.toggle("hf-gaveta-aberta", w < 680 && !!this._gavetaAberta);
            };
            this._obsTamanho = new ResizeObserver(aplicar);
            this._obsTamanho.observe(form);
            aplicar();
            // Clicar no conteúdo fecha a gaveta
            form.querySelector(".hf-aba-conteudo")?.addEventListener("pointerdown", () => {
                if (!form.classList.contains("hf-gaveta-aberta")) return;
                this._gavetaAberta = false;
                form.classList.remove("hf-gaveta-aberta");
            });
        }

        async close(options) {
            this._obsSubtitulo?.disconnect();
            this._obsTamanho?.disconnect();
            return super.close(options);
        }

        _itemDoEvento(ev) {
            const li = ev.currentTarget.closest("[data-item-id]");
            return li ? this.actor.items.get(li.dataset.itemId) : null;
        }

        /** Menu de contexto do sistema + "Retirar do / Mostrar no Combate". */
        _onItemToggleContext(element) {
            super._onItemToggleContext(element);
            const li = element.closest("li");
            const item = this.actor.items.get(li?.dataset.itemId);
            if (!item || !item.isOwner || !this.element?.[0]?.contains(li)) return;
            const noCombate = this._emCombate(item, item.system.ativacao?.execucao || "");
            ui.context.menuItems.push({
                name: noCombate ? "T20A.Ficha.RetirarCombate" : "T20A.Ficha.MostrarCombate",
                icon: noCombate ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-swords"></i>',
                group: "hayd",
                callback: () => item.setFlag(MODULE_ID, FLAG_COMBATE, !noCombate)
            });
            const fixado = !!item.getFlag(MODULE_ID, FLAG_FIXADO);
            ui.context.menuItems.push({
                name: fixado ? "T20A.Ficha.Desafixar" : "T20A.Ficha.Fixar",
                icon: '<i class="fa-solid fa-thumbtack"></i>',
                group: "hayd",
                callback: () => item.setFlag(MODULE_ID, FLAG_FIXADO, !fixado)
            });
        }

        /** Seletor de traços do sistema, com o campo de texto livre ligado. */
        _onTraitSelector(event) {
            event.preventDefault();
            const a = event.currentTarget;
            const TraitSelector = game.tormenta20?.applications?.TraitSelector;
            if (!TraitSelector || a.dataset.options === "conditionTypes") return super._onTraitSelector(event);
            const label = a.querySelector("label") ?? a.parentElement.querySelector("label");
            return new TraitSelector(this.actor, {
                name: a.dataset.target,
                id: a.dataset.options,
                title: label?.innerText ?? "",
                choices: CONFIG.T20[a.dataset.options],
                allowCustom: true
            }).render(true);
        }

        /* ---- Navegação sem redesenhar ------------------------------------ */

        _trocarAba(aba) {
            if (!ABAS.includes(aba)) return;
            const root = this.element?.[0];
            if (!root) return;
            root.querySelectorAll("[data-hf-aba]").forEach((b) => b.classList.toggle("ativa", b.dataset.hfAba === aba));
            root.querySelectorAll(".hf-aba[data-aba]").forEach((p) => {
                const ativa = p.dataset.aba === aba;
                p.classList.toggle("ativa", ativa);
                if (ativa) animarEntrada(p);
            });
            salvarEstado(this.actor, { aba });
        }

        _trocarLateral(lateralAba) {
            if (!ABAS_LATERAIS.includes(lateralAba)) return;
            const root = this.element?.[0];
            if (!root) return;
            root.querySelectorAll("[data-hf-lateral-aba]").forEach((b) => b.classList.toggle("ativa", b.dataset.hfLateralAba === lateralAba));
            root.querySelectorAll(".hf-lateral-painel[data-painel]").forEach((p) => {
                const ativa = p.dataset.painel === lateralAba;
                p.classList.toggle("ativa", ativa);
                if (ativa) animarEntrada(p);
            });
            salvarEstado(this.actor, { lateralAba });
        }

        _alternarLateral() {
            const form = this.element?.[0]?.querySelector("form.hf-ficha");
            if (!form) return;
            // Janela estreita: a lateral é uma gaveta por cima do conteúdo; abrir e
            // fechar não mexe na preferência guardada (que vale para a janela larga)
            if (form.classList.contains("hf-w-xs")) {
                this._gavetaAberta = form.classList.toggle("hf-gaveta-aberta");
                return;
            }
            const aberta = form.classList.toggle("hf-sem-lateral") === false;
            const botao = form.querySelector("[data-hf-acao='lateral'] i");
            botao?.classList.toggle("fa-angles-left", aberta);
            botao?.classList.toggle("fa-angles-right", !aberta);
            salvarEstado(this.actor, { lateral: aberta });
        }

        _trocarDiario(diario) {
            const root = this.element?.[0];
            if (!root) return;
            root.querySelectorAll("[data-hf-diario]").forEach((b) => b.classList.toggle("ativa", b.dataset.hfDiario === diario));
            root.querySelectorAll(".hf-diario-pagina[data-pagina]").forEach((p) => {
                const ativa = p.dataset.pagina === diario;
                p.classList.toggle("ativa", ativa);
                if (ativa) animarEntrada(p);
            });
            salvarEstado(this.actor, { diario });
        }

        /** Recolhe/expande uma seção (a animação é do CSS, pela classe). */
        _alternarSecao(cabecalho) {
            const chave = cabecalho.dataset.hfSecao;
            const secao = cabecalho.closest("[data-recolhivel]");
            if (!secao) return;
            const recolhida = secao.classList.toggle("recolhida");
            const estado = lerEstado(this.actor);
            if (recolhida) estado.recolhidas[chave] = true;
            else delete estado.recolhidas[chave];
            gravarEstado(this.actor, estado);
        }

        async _alternarOrganizacao(aba) {
            if (!ABAS_ORGANIZAVEIS.includes(aba)) return;
            const estado = lerEstado(this.actor);
            estado.organizacao[aba] = estado.organizacao[aba] === "lista" ? "categorias" : "lista";
            await gravarEstado(this.actor, estado);
            this.render(false);
        }

        async _alternarCadeado() {
            const { MODES } = this.constructor;
            this._mode = this._mode === MODES.EDIT ? MODES.PLAY : MODES.EDIT;
            await this.submit();
            this.render(false);
        }

        /* ---- Edição ------------------------------------------------------ */

        /** Campo com delta (+5, -3, =7): grava sem passar pelo submit do formulário. */
        async _onDelta(ev) {
            ev.stopPropagation();
            const input = ev.currentTarget;
            const caminho = input.dataset.hfDelta;
            const alvo = input.dataset.hfDoc === "item"
                ? this.actor.items.get(input.closest("[data-item-id]")?.dataset.itemId)
                : this.actor;
            if (!alvo) return;
            const atual = Number(foundry.utils.getProperty(alvo, caminho)) || 0;
            let novo = aplicarDelta(input.value, atual);
            if (input.dataset.hfMin !== undefined) novo = Math.max(Number(input.dataset.hfMin), novo);
            if (input.dataset.hfMax !== undefined && input.dataset.hfMax !== "") novo = Math.min(Number(input.dataset.hfMax), novo);
            if (novo === atual) {
                input.value = atual;
                return;
            }
            await alvo.update({ [caminho]: novo });
        }

        /** Botões − / + (quantidade, PV, PM). */
        async _onPasso(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const el = ev.currentTarget;
            const caminho = el.dataset.hfPasso;
            const passo = Number(el.dataset.hfValor) * (ev.shiftKey ? 5 : 1);
            const alvo = el.dataset.hfDoc === "item" ? this._itemDoEvento(ev) : this.actor;
            if (!alvo) return;
            const atual = Number(foundry.utils.getProperty(alvo, caminho)) || 0;
            let novo = atual + passo;
            if (el.dataset.hfMin !== undefined) novo = Math.max(Number(el.dataset.hfMin), novo);
            await alvo.update({ [caminho]: novo });
        }

        async _onFavorito(ev) {
            ev.stopPropagation();
            const item = this._itemDoEvento(ev);
            if (!item) return;
            await item.setFlag("tormenta20", "favorito", !item.getFlag("tormenta20", "favorito"));
        }

        /**
         * Equipar direto na linha. Com os espaços de equipamento do sistema
         * ligados a escolha do espaço é pelo menu de contexto (o mesmo do
         * clique direito), então abre esse menu.
         */
        async _onEquipar(ev) {
            ev.stopPropagation();
            const item = this._itemDoEvento(ev);
            if (!item) return;
            if (game.settings.get("tormenta20", "equipmentSlots") && item.system.equipado2?.type) {
                const li = ev.currentTarget.closest("li.item");
                const r = ev.currentTarget.getBoundingClientRect();
                li.dispatchEvent(new MouseEvent("contextmenu", {
                    bubbles: true, cancelable: true, clientX: r.left, clientY: r.bottom
                }));
                return;
            }
            if (item.type === "arma") {
                const maos = item.system.empunhadura === "duas" ? 2 : 1;
                return this._onToggleWeapon(item, maos);
            }
            return this._onToggleArmor($(ev.currentTarget.closest("li.item")));
        }

        async _onExcluir(ev) {
            ev.stopPropagation();
            const item = this._itemDoEvento(ev);
            if (!item) return;
            if (ev.shiftKey) return item.delete();
            return item.deleteDialog();
        }

        async _onCriar(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const { tipo, subtipo, circulo } = ev.currentTarget.dataset;
            const system = {};
            if (subtipo) system.tipo = subtipo;
            if (circulo) {
                system.circulo = Number(circulo);
                system.ativacao = { custo: CUSTO_CIRCULO[circulo] ?? 1 };
                system.resistencia = { atributo: this.actor.system.attributes.conjuracao };
            }
            return this.actor.createEmbeddedDocuments("Item", [{
                name: localizar(`T20A.Ficha.Novo.${tipo}`),
                type: tipo,
                system
            }], { renderSheet: true });
        }

        _onEditarImagem() {
            if (!this.isEditable) return;
            const fp = new foundry.applications.apps.FilePicker.implementation({
                type: "image",
                current: this.actor.img,
                callback: (path) => this.actor.update({ img: path }),
                top: this.position.top + 40,
                left: this.position.left + 10
            });
            return fp.browse();
        }

        /* ---- Favoritos: soltar na lateral e reordenar -------------------- */

        /**
         * Arraste nos favoritos, com prévia ao vivo:
         * - reordenar: o próprio item anda até a posição enquanto é arrastado;
         * - item de fora: uma vaga fantasma aparece onde ele vai entrar;
         * nos dois casos os vizinhos deslizam para abrir espaço (animação FLIP).
         * O aviso "arraste itens para cá" só aparece quando algo vem de fora.
         */
        _ligarArrasteFavoritos(root) {
            const zona = root.querySelector(".hf-favoritos");
            if (!zona || !this.isEditable) return;
            const aviso = zona.querySelector(".hf-fav-soltar");
            let arrastado = null;   // favorito sendo reordenado
            let fantasma = null;    // vaga de um item vindo de fora

            const limpar = () => {
                arrastado?.classList.remove("hf-arrastado");
                arrastado = null;
                fantasma?.remove();
                fantasma = null;
                zona.classList.remove("hf-reordenando", "hf-recebendo");
            };

            // Move um elemento e anima os vizinhos da posição antiga para a nova
            const moverAnimado = (el, antes) => {
                if (el.nextElementSibling === antes && el.parentElement === zona) return;
                const vizinhos = [...zona.querySelectorAll(".hf-fav, .hf-fav-fantasma")];
                const antigas = new Map(vizinhos.map((v) => [v, v.getBoundingClientRect().top]));
                zona.insertBefore(el, antes);
                for (const v of vizinhos) {
                    const delta = antigas.get(v) - v.getBoundingClientRect().top;
                    if (!delta) continue;
                    v.style.transition = "none";
                    v.style.transform = `translateY(${delta}px)`;
                    requestAnimationFrame(() => {
                        v.style.transition = "transform 0.18s ease";
                        v.style.transform = "";
                    });
                }
            };

            // Elemento antes do qual o item deve entrar, pela altura do cursor
            const referencia = (y, ignorar) => {
                for (const li of zona.querySelectorAll(".hf-fav")) {
                    if (li === ignorar) continue;
                    const r = li.getBoundingClientRect();
                    if (y < r.top + r.height / 2) return li;
                }
                return aviso;
            };

            zona.addEventListener("dragstart", (ev) => {
                const li = ev.target.closest?.(".hf-fav");
                if (!li) return;
                arrastado = li;
                zona.classList.add("hf-reordenando");
                // Um quadro depois: a imagem do arraste já foi capturada sem o esmaecido
                requestAnimationFrame(() => li.classList.add("hf-arrastado"));
            }, true); // captura: o DragDrop da Foundry interrompe a propagação do dragstart

            // Arrastar uma linha de outra parte da ficha já avisa onde soltar
            root.addEventListener("dragstart", (ev) => {
                if (ev.target.closest?.(".hf-favoritos")) return;
                if (ev.target.closest?.("li.item[data-item-id]")) zona.classList.add("hf-recebendo");
            }, true);
            root.addEventListener("dragend", limpar, true);

            zona.addEventListener("dragenter", () => {
                if (!arrastado) zona.classList.add("hf-recebendo");
            });
            zona.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                if (arrastado) {
                    moverAnimado(arrastado, referencia(ev.clientY, arrastado));
                    return;
                }
                if (!fantasma) {
                    fantasma = document.createElement("li");
                    fantasma.className = "hf-fav-fantasma";
                }
                moverAnimado(fantasma, referencia(ev.clientY, fantasma));
            });
            zona.addEventListener("dragleave", (ev) => {
                if (zona.contains(ev.relatedTarget)) return;
                fantasma?.remove();
                fantasma = null;
                // Item de outra janela saiu da zona: some o aviso; da ficha, ele continua
                if (!arrastado && !root.contains(ev.relatedTarget)) zona.classList.remove("hf-recebendo");
            });
            // O drop em si é tratado em _onDrop (que lê a ordem já montada no DOM);
            // aqui só se desfaz o estado visual depois dele.
            zona.addEventListener("drop", () => setTimeout(limpar, 0));
        }

        /**
         * Fixados no topo do Combate: arrastar para mudar a ordem, com a mesma
         * prévia ao vivo dos favoritos (o cartão anda até a posição e os
         * vizinhos deslizam). É arraste nativo e interno: não passa pelo drop
         * da ficha, só grava a nova ordem.
         */
        _ligarArrasteFixados(root) {
            const grade = root.querySelector(".hf-pinos");
            if (!grade || !this.isEditable) return;
            let arrastado = null;

            const moverAnimado = (el, antes) => {
                if (el.nextElementSibling === antes) return;
                const cartoes = [...grade.querySelectorAll(".hf-pino")];
                const antigas = new Map(cartoes.map((c) => [c, c.getBoundingClientRect()]));
                grade.insertBefore(el, antes);
                for (const c of cartoes) {
                    const a = antigas.get(c), n = c.getBoundingClientRect();
                    const dx = a.left - n.left, dy = a.top - n.top;
                    if (!dx && !dy) continue;
                    c.style.transition = "none";
                    c.style.transform = `translate(${dx}px, ${dy}px)`;
                    requestAnimationFrame(() => {
                        c.style.transition = "transform 0.18s ease";
                        c.style.transform = "";
                    });
                }
            };
            // Cartão antes do qual entrar: o primeiro cujo centro fica depois do cursor
            const referencia = (x, y) => {
                for (const c of grade.querySelectorAll(".hf-pino")) {
                    if (c === arrastado) continue;
                    const r = c.getBoundingClientRect();
                    const mesmaLinha = y >= r.top && y <= r.bottom;
                    if (y < r.top || (mesmaLinha && x < r.left + r.width / 2)) return c;
                }
                return null;
            };

            grade.addEventListener("dragstart", (ev) => {
                const cartao = ev.target.closest?.(".hf-pino");
                if (!cartao) return;
                arrastado = cartao;
                ev.dataTransfer.effectAllowed = "move";
                ev.dataTransfer.setData("text/plain", "hf-pino");
                requestAnimationFrame(() => cartao.classList.add("hf-arrastado"));
            });
            grade.addEventListener("dragover", (ev) => {
                if (!arrastado) return;
                ev.preventDefault();
                moverAnimado(arrastado, referencia(ev.clientX, ev.clientY));
            });
            grade.addEventListener("drop", (ev) => {
                if (!arrastado) return;
                ev.preventDefault();
                ev.stopPropagation(); // não é um drop de item para a ficha
                const ordem = [...grade.querySelectorAll(".hf-pino")].map((c) => c.dataset.itemId);
                this.actor.setFlag(MODULE_ID, FLAG_ORDEM_FIXADOS, ordem);
            });
            grade.addEventListener("dragend", () => {
                arrastado?.classList.remove("hf-arrastado");
                arrastado = null;
            });
        }

        async _onDrop(event) {
            const zona = event.target.closest?.(".hf-favoritos");
            if (zona && this.isEditable) {
                const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
                if (data?.type === "Item") {
                    const item = await Item.implementation.fromDropData(data);
                    if (item?.parent === this.actor) return this._soltarFavorito(zona, item);
                }
            }
            return super._onDrop(event);
        }

        /**
         * Grava a ordem que ficou na tela: a prévia do arraste já pôs o item
         * (ou a vaga fantasma dele) na posição escolhida.
         */
        async _soltarFavorito(zona, item) {
            const ordem = [...zona.querySelectorAll(".hf-fav, .hf-fav-fantasma")]
                .map((el) => (el.classList.contains("hf-fav-fantasma") ? item.id : el.dataset.itemId));
            if (!ordem.includes(item.id)) ordem.push(item.id);
            const lista = [...new Set(ordem)];
            await this.actor.setFlag(MODULE_ID, FLAG_ORDEM_FAVORITOS, lista);
            if (!item.getFlag("tormenta20", "favorito")) await item.setFlag("tormenta20", "favorito", true);
        }

        /**
         * Reordenar arrastando dentro de uma lista. O do núcleo só compara itens
         * do mesmo tipo; aqui os vizinhos são os da própria lista na tela, o que
         * faz a lista livre (tipos misturados) ordenar direito.
         */
        _onSortItem(event, itemData) {
            const source = this.actor.items.get(itemData._id);
            const lista = event.target.closest(".hf-lista");
            const dropLi = event.target.closest("li.item[data-item-id]");
            if (!source || !lista || !dropLi) return super._onSortItem(event, itemData);
            const target = this.actor.items.get(dropLi.dataset.itemId);
            if (!target || target.id === source.id) return;
            const siblings = [...lista.querySelectorAll("li.item[data-item-id]")]
                .map((li) => this.actor.items.get(li.dataset.itemId))
                .filter((i) => i && i.id !== source.id);
            const updates = foundry.utils.performIntegerSort(source, { target, siblings });
            return this.actor.updateEmbeddedDocuments("Item",
                updates.map((u) => ({ _id: u.target.id, sort: u.update.sort })));
        }

        /* ---- Descrição expansível ---------------------------------------- */

        async _alternarDescricao(ev) {
            ev.preventDefault();
            const li = ev.currentTarget.closest("li.item");
            if (!li) return;
            const id = li.dataset.itemId;
            if (this._expandidos.has(id)) {
                this._expandidos.delete(id);
                li.classList.remove("hf-expandido");
                this._fecharDescricao(li);
                return;
            }
            this._expandidos.add(id);
            await this._mostrarDescricao(li, true);
        }

        /**
         * Etiquetas próprias do tipo do item, as mesmas informações da aba
         * Detalhes da ficha do item: arma (proficiência, propósito, empunhadura
         * e propriedades marcadas), equipamento (tipo, tipo de uso, Defesa e
         * penalidade) e consumível (tipo).
         */
        _etiquetasDoItem(item) {
            const sys = item.system ?? {};
            const cfg = CONFIG.T20 ?? {};
            const nome = (mapa, chave) => (chave && mapa?.[chave] ? localizar(mapa[chave]) : "");
            const tags = [];
            if (item.type === "arma") {
                tags.push(nome(cfg.weaponTypes, sys.proficiencia),
                    nome(cfg.weaponPurposeTypes, sys.proposito),
                    nome(cfg.weaponWieldingTypes, sys.empunhadura));
                for (const [prop, rotulo] of Object.entries(cfg.weaponProperties ?? {})) {
                    if (sys.propriedades?.[prop]) tags.push(localizar(rotulo));
                }
            } else if (item.type === "equipamento") {
                tags.push(nome(cfg.armorTypes, sys.tipo), nome(cfg.itemSlotTypes, sys.equipado2?.type));
                const def = Number(sys.armadura?.value) || 0;
                const pen = Number(sys.armadura?.penalidade) || 0;
                if (def) tags.push(`${localizar("T20.Defense")} ${def > 0 ? "+" : ""}${def}`);
                if (pen) tags.push(`${localizar("T20.ArmorPenalty")} ${pen}`);
            } else if (item.type === "magia") {
                // Tipo (arcana, divina, universal, engenhoca…); a engenhoca diz também
                // como se usa: empunhada ou vestida
                tags.push(nome(cfg.spellType, sys.tipo));
                if (sys.tipo === "eng") {
                    const uso = sys.equipado2?.type;
                    tags.push(uso === "hand" ? "Empunhada" : uso === "body" ? "Vestida"
                        : uso === "both" ? "Empunhada ou vestida" : "");
                }
            } else if (item.type === "consumivel") {
                const tipos = { ammo: "Munição", scroll: "Pergaminho", alchemy: "Alquímico", potion: "Poção", material: "Material", food: "Comida" };
                tags.push(tipos[sys.tipo] ?? "", sys.subtipo ?? "");
            }
            return tags.filter(Boolean);
        }

        async _montarDescricao(item) {
            let html = "";
            try {
                const chat = await item.getChatData({ secrets: this.actor.isOwner });
                html = chat.description?.value ?? "";
            } catch (err) {
                html = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                    item.system.description?.value ?? "", { secrets: this.actor.isOwner, relativeTo: item });
            }
            const tags = this._etiquetasDoItem(item);
            const l = item.labels ?? {};
            // Magia: o custo em PM não entra (já é fixo pelo círculo); vale o tipo, montado acima
            const custo = item.type === "magia" ? null : l.custoPM;
            for (const t of [l.ativacao, custo, l.range, l.alvo, l.area, l.duration, l.save, l.escola, l.nivel]) {
                if (t && t !== "Nenhum" && t !== "Instantânea" && !tags.includes(t)) tags.push(t);
            }
            const conteudo = `
                ${tags.length ? `<div class="hf-descricao-tags">${tags.map((t) => `<span>${t}</span>`).join("")}</div>` : ""}
                <div class="hf-descricao-texto">${html || `<p class="hf-vazio">${localizar("T20A.Ficha.SemDescricao")}</p>`}</div>`;
            this._descricoes.set(item.id, conteudo);
            return conteudo;
        }

        async _mostrarDescricao(li, animar) {
            const item = this.actor.items.get(li.dataset.itemId);
            if (!item || li.querySelector(".hf-descricao")) return;
            li.classList.add("hf-expandido");
            const conteudo = this._descricoes.get(item.id) ?? await this._montarDescricao(item);
            if (li.querySelector(".hf-descricao")) return;
            const div = document.createElement("div");
            div.className = "hf-descricao";
            div.innerHTML = `<div class="hf-descricao-interno"><div class="hf-descricao-caixa">${conteudo}</div></div>`;
            if (animar) div.classList.add("fechada");
            li.append(div);
            if (animar) {
                void div.offsetHeight; // aplica o estado fechado antes de abrir
                div.classList.remove("fechada");
            }
        }

        /**
         * Caixa e espaço encolhem juntos (grid 1fr → 0fr, margens dentro da
         * parte que encolhe) e só então saem do DOM.
         */
        _fecharDescricao(li) {
            li.classList.remove("hf-expandido");
            const d = li.querySelector(".hf-descricao");
            if (!d || d.classList.contains("fechada")) return;
            d.classList.add("fechada");
            const remover = () => d.remove();
            d.addEventListener("transitionend", remover, { once: true });
            setTimeout(remover, 400);
        }

        _expandirTudo(ev) {
            const aba = ev.currentTarget.closest(".hf-aba");
            const linhas = [...aba.querySelectorAll("li.item[data-item-id]")].filter((li) => li.offsetParent);
            const abrir = linhas.some((li) => !this._expandidos.has(li.dataset.itemId));
            for (const li of linhas) {
                const id = li.dataset.itemId;
                if (abrir && !this._expandidos.has(id)) {
                    this._expandidos.add(id);
                    this._mostrarDescricao(li, true);
                } else if (!abrir && this._expandidos.has(id)) {
                    this._expandidos.delete(id);
                    this._fecharDescricao(li);
                }
            }
        }

        /* ---- Busca --------------------------------------------------------- */

        _filtrar(input) {
            const aba = input.dataset.hfBusca;
            this._busca[aba] = input.value;
            const container = input.closest(".hf-aba");
            if (!container) return;
            const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
            const t = normalizar(input.value.trim());
            for (const secao of container.querySelectorAll(".hf-secao")) {
                let visiveis = 0;
                for (const li of secao.querySelectorAll("li.item[data-item-id]")) {
                    const ok = !t || normalizar(li.dataset.nome ?? li.textContent).includes(t);
                    li.hidden = !ok;
                    if (ok) visiveis++;
                }
                secao.hidden = !!t && visiveis === 0;
            }
            container.classList.toggle("hf-buscando", !!t);
        }

        /** Mudou algum item: a descrição guardada dele pode estar velha. */
        _limparDescricao(id) {
            this._descricoes.delete(id);
        }
    };
}

/* Descrição em cache fica velha quando o item muda */
Hooks.on("updateItem", (item) => {
    const actor = item.parent;
    if (!actor) return;
    for (const app of Object.values(actor.apps ?? {})) {
        if (ehFichaHayd(app)) app._limparDescricao(item.id);
    }
});
