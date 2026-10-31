/**
 * Ficha Hayd de Ameaça — ficha alternativa para os NPCs (tipo "npc") do
 * Tormenta20. Continua sendo um bloco de estatísticas: tudo numa página só,
 * na ordem em que o mestre consulta no meio do combate (vitais, testes,
 * ataques, ações, habilidades, magias), com o cadeado abrindo os campos de
 * edição no mesmo lugar em vez de numa aba "Ficha" separada.
 *
 * A classe estende a ActorSheetT20NPC do sistema: rolagens, arrastar e soltar,
 * menu de contexto dos itens, diálogos de deslocamento/resistências/traços e
 * o editor de efeitos são os do próprio sistema. A ficha só troca o template
 * e acrescenta as interações de interface.
 */

import { aplicarDelta, listarCondicoes, lerArteMestre } from "./ficha-hayd.mjs";

const MODULE_ID = "t20-hayd-ui";
const TEMPLATES = `modules/${MODULE_ID}/templates/ameaca`;
/** Arte do topo, por escolha em "Configurar ficha" (Deuses: Negativo é a padrão). */
const ARTES = {
    "deuses-positivo": "header-deuses-positivo.webp",
    "deuses-negativo": "header-deuses-negativo.webp",
    tormenta: "header-tormenta-horizontal.webp"
};
const ESCUDO = `modules/${MODULE_ID}/assets/icones/escudo-defesa.webp`;

/** Classe CSS da janela (o tema usa para reconhecer a ficha). */
export const CLASSE_AMEACA = "hayd-ameaca";

const ABAS = ["ameaca", "pericias", "inventario", "poderes", "efeitos", "diario"];
/** Tipos de poder, na ordem das seções da aba Poderes (a mesma da Ficha Hayd). */
const TIPOS_PODER = ["ability", "classe", "racial", "origem", "geral", "concedido", "distincao", "complicacao"];

/** Categorias do inventário, na ordem da Ficha Hayd. */
const INVENTARIO = [
    { tipo: "arma", icone: "fa-solid fa-khanda", rotulo: "T20.Weapons" },
    { tipo: "equipamento", icone: "fa-solid fa-shield-halved", rotulo: "T20.Equipment" },
    { tipo: "consumivel", icone: "fa-solid fa-flask", rotulo: "T20A.Ficha.Consumiveis" },
    { tipo: "tesouro", icone: "fa-solid fa-gem", rotulo: "T20A.Ficha.Tesouros" }
];
/** Moedas do rodapé (a platina só com a opção do sistema ligada ou se a ameaça tiver alguma). */
const MOEDAS = [
    { chave: "tl", rotulo: "T20.CurrencyPlat" },
    { chave: "to", rotulo: "T20.CurrencyGold" },
    { chave: "tp", rotulo: "T20.CurrencySilver" },
    { chave: "tc", rotulo: "T20.CurrencyCopper" }
];

/** Perícias que o topo e a linha discreta já mostram: ficam fora da lista de treinadas. */
const PERICIAS_DESTACADAS = new Set(["inic", "perc", "fort", "refl", "vont"]);
/** Especialidades de Ofício do sistema: só entram na lista se a ameaça tiver alguma. */
const OFICIOS = new Set(["alfa", "alqu", "arme", "arte", "cozi", "enge"]);

/** Iniciativa e Percepção: no topo, mas sem o destaque das resistências. */
const TESTES_MENORES = [
    { key: "inic", rotulo: "T20.SkillInic" },
    { key: "perc", rotulo: "T20.SkillPerc" }
];
/** Os testes de resistência são os que mais importam na ameaça: ganham o destaque. */
const RESISTENCIAS = [
    { key: "fort", rotulo: "T20.SkillFortAbbr", icone: "fa-heart-pulse" },
    { key: "refl", rotulo: "T20.SkillReflAbbr", icone: "fa-wind" },
    { key: "vont", rotulo: "T20.SkillVontAbbr", icone: "fa-brain" }
];

const ICONES_TIPO = {
    ani: "fa-paw", con: "fa-gears", esp: "fa-ghost",
    hum: "fa-person", mon: "fa-dragon", mor: "fa-skull"
};
const ICONES_PAPEL = { solo: "fa-crown", lackey: "fa-users", special: "fa-star" };
const ICONES_EXECUCAO = {
    action: "fa-hand-fist", move: "fa-person-running", full: "fa-hourglass-half",
    reaction: "fa-bolt", free: "fa-feather", special: "fa-star",
    minute: "fa-clock", hour: "fa-clock", day: "fa-sun"
};
const CUSTO_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

/**
 * Brasão do ND pelo patamar de jogo do livro (o mesmo dos personagens):
 * Iniciante 1–4, Veterano 5–10, Campeão 11–16, Lenda 17–20. Acima de 20
 * (e os ND "S" e "S+") é Lenda+. ND fracionário (1/2, 1/4) é Iniciante.
 */
const PATAMARES = [
    { chave: "iniciante", ate: 4 },
    { chave: "veterano", ate: 10 },
    { chave: "campeao", ate: 16 },
    { chave: "lenda", ate: 20 },
    { chave: "lenda-plus", ate: Infinity }
];
export function patamarDoND(nd) {
    const texto = String(nd ?? "").trim().toUpperCase();
    if (texto.startsWith("S")) return "lenda-plus";
    const [a, b] = texto.split("/").map(Number);
    const valor = b ? a / b : a;
    if (!Number.isFinite(valor)) return "iniciante";
    return PATAMARES.find((p) => valor <= p.ate).chave;
}

/** Seções recolhidas: vale para todas as ameaças (é preferência de quem mestra, não do NPC). */
const SETTING_RECOLHIDAS = "fichaAmeacaRecolhidas";

const localizar = (chave) => game.i18n.localize(chave);
const menosMovimento = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
/** Número de um valor da ficha ("+11", "−2", "60"); NaN se não for número. */
const numero = (texto) => Number(String(texto ?? "").replace("−", "-").replace("+", "").trim() || NaN);

/** Texto para comparar na busca: sem acento e sem maiúscula ("Cabeçada" acha com "cabecada"). */
const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Marca o trecho buscado no nome. Tirar os acentos não muda a contagem de
 * letras (texto em NFC), então a posição achada no texto normalizado vale no original.
 */
function destacarBusca(el, termo) {
    for (const marca of el.querySelectorAll("mark.ha-achado")) marca.replaceWith(marca.textContent);
    el.normalize();
    if (!termo) return;
    const andarilho = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let no = andarilho.nextNode(); no; no = andarilho.nextNode()) {
        const i = normalizar(no.data).indexOf(termo);
        if (i < 0) continue;
        const achado = no.splitText(i);
        achado.splitText(termo.length);
        const marca = document.createElement("mark");
        marca.className = "ha-achado";
        achado.replaceWith(marca);
        marca.append(achado);
        return;
    }
}

/** Primeira frase da regra, sem HTML, para a linha de prévia das ações e habilidades recolhidas. */
function previaDoTexto(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html ?? "");
    return div.textContent.replace(/\s+/g, " ").trim().slice(0, 220);
}

/** Reinicia uma animação de CSS no elemento (a classe sai sozinha ao terminar). */
function animarClasse(el, classe, limite = 800) {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    const tirar = () => el.classList.remove(classe);
    el.addEventListener("animationend", tirar, { once: true });
    setTimeout(tirar, limite);
}

/** Conta de um número até outro (PV 70 → 60 rola os algarismos em vez de trocar seco). */
function contar(el, de, para, duracao = 420) {
    const escrever = (v) => { if (el.tagName === "INPUT") el.value = v; else el.textContent = v; };
    const inicio = performance.now();
    const passo = (agora) => {
        if (!el.isConnected || document.activeElement === el) return escrever(para);
        const t = Math.min(1, (agora - inicio) / duracao);
        const suave = 1 - (1 - t) ** 3;
        escrever(Math.round(de + (para - de) * suave));
        if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
}
/** Largura dos campos de PV/PM: quantos dígitos tem o maior entre o atual e o máximo (com o sinal, se negativo). */
const digitos = (valor, max) => Math.max(2, ...[valor, max].map((n) => String(Math.trunc(Number(n) || 0)).length));
const pct = (valor, max) => (max > 0 ? Math.clamp(Math.round((valor / max) * 100), 0, 100) : 0);
const comSinal = (n) => {
    const v = Number(n) || 0;
    return { sinal: v < 0 ? "−" : "+", valor: Math.abs(v), negativo: v < 0 };
};

/** A ficha é uma Ficha de Ameaça? (o tema só lhe passa a cor de destaque) */
export function ehFichaAmeaca(app) {
    return !!app?.constructor?.FICHA_AMEACA;
}

/**
 * Registra a ficha. Precisa rodar depois do init do sistema, que é quem cria
 * a ActorSheetT20NPC que ela estende.
 */
export async function registrarFichaAmeaca() {
    const Base = game.tormenta20?.applications?.ActorSheetT20NPC
        ?? CONFIG.Actor.sheetClasses?.npc?.["tormenta20.ActorSheetT20NPC"]?.cls;
    if (!Base) {
        console.warn(`${MODULE_ID} | ficha de ameaça do sistema não encontrada; Ficha de Ameaça não registrada.`);
        return;
    }
    game.settings.register(MODULE_ID, SETTING_RECOLHIDAS, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });
    foundry.documents.collections.Actors.registerSheet(MODULE_ID, criarClasseFicha(Base), {
        types: ["npc"],
        makeDefault: false,
        label: "T20A.Ameaca.Nome"
    });
    await foundry.applications.handlebars.loadTemplates([
        `${TEMPLATES}/ficha.hbs`,
        `${TEMPLATES}/cabecalho.hbs`,
        `${TEMPLATES}/aba-ameaca.hbs`,
        `${TEMPLATES}/aba-pericias.hbs`,
        `${TEMPLATES}/aba-inventario.hbs`,
        `${TEMPLATES}/aba-poderes.hbs`,
        `${TEMPLATES}/aba-efeitos.hbs`,
        `${TEMPLATES}/linha-item.hbs`
    ]);
}

/* -------------------------------------------------------------------------- */
/*  Janelas de configuração do sistema abertas pela ficha de ameaça            */
/* -------------------------------------------------------------------------- */

/**
 * Resistências, deslocamento e traços (imunidades, sentidos, idiomas) são
 * janelas do sistema. Abertas a partir da ficha de ameaça, elas salvam sozinhas
 * a cada mudança (o "Enviar" lá embaixo passava despercebido), abrem inteiras
 * dentro da tela e mantêm o campo em foco quando se redesenham após salvar.
 * O botão de enviar continua lá, e agora também fecha a janela.
 */
function ajustarConfiguracaoDaAmeaca(app, html) {
    const doc = app.document ?? app.object;
    if (!(doc instanceof Actor)) return;
    const aberta = Object.values(ui.windows).some((w) => w.constructor.FICHA_AMEACA && w.actor === doc);
    if (!aberta) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const janela = root?.closest?.(".app, .application") ?? app.element?.[0] ?? app.element;
    if (!janela) return;

    const v2 = !!app.options?.form;
    if (v2) app.options.form.submitOnChange = true;
    else app.options.submitOnChange = true;
    // Salvar ao mudar não fecha; só o botão de enviar fecha
    const definirFechar = (fechar) => {
        if (v2) app.options.form.closeOnSubmit = fechar;
        else app.options.closeOnSubmit = fechar;
    };
    definirFechar(false);
    for (const botao of janela.querySelectorAll('button[type="submit"]')) {
        botao.addEventListener("click", () => definirFechar(true), { capture: true });
    }

    // O redesenho depois de salvar não pode tirar o cursor do campo
    const form = janela.querySelector("form") ?? janela;
    form.addEventListener("focusin", (ev) => { if (ev.target.name) app._haFoco = ev.target.name; });
    if (app._haFoco) {
        const campo = form.querySelector(`[name="${CSS.escape(app._haFoco)}"]`);
        if (campo && document.activeElement !== campo) {
            campo.focus({ preventScroll: true });
            try { campo.select?.(); } catch (_) { /* checkbox */ }
        }
    }

    // Abre inteira e dentro da tela (só na primeira vez: depois o usuário pode arrastar)
    if (app._haPosicionada) return;
    app._haPosicionada = true;
    requestAnimationFrame(() => {
        app.setPosition({ height: "auto" });
        const caixa = janela.getBoundingClientRect();
        const limite = window.innerHeight - 12;
        if (caixa.bottom > limite) app.setPosition({ top: Math.max(12, limite - caixa.height) });
    });
}
for (const classe of ["ActorResistanceConfig", "ActorMovementConfig", "TraitSelector"]) {
    Hooks.on(`render${classe}`, ajustarConfiguracaoDaAmeaca);
}

function criarClasseFicha(Base) {
    return class FichaHaydAmeaca extends Base {
        static FICHA_AMEACA = true;

        /** Aba aberta (só na memória da janela: reabrir a ficha volta ao bloco). */
        _aba = "ameaca";
        /** Habilidades e magias com a descrição aberta, mantidas entre renders. */
        _abertas = new Set();
        /** Busca digitada na aba Ameaça (só na memória da janela, como na Ficha Hayd). */
        _busca = "";

        static get defaultOptions() {
            const opcoes = foundry.utils.mergeObject(super.defaultOptions, {
                width: 640,
                height: 820,
                tabs: [],
                scrollY: [".ha-aba"],
                dragDrop: [{ dragSelector: ".item-list .item" }]
            });
            // Sem "tormenta20": o CSS do sistema é todo preso a essa classe
            opcoes.classes = ["tormenta20-hayd", "sheet", "actor", "npc", CLASSE_AMEACA];
            return opcoes;
        }

        get template() {
            if (!game.user.isGM && this.actor.limited) return super.template;
            return `${TEMPLATES}/ficha.hbs`;
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
            const desbloqueada = this.desbloqueada;
            const T20 = CONFIG.T20;
            const pv = sys.attributes.pv;
            const pm = sys.attributes.pm;
            const papel = sys.detalhes.role;
            const pericias = sys.pericias ?? {};

            const ataques = (data.actor.inventario?.arma?.items ?? []).map((i) => this._ataque(i));
            const poderes = (data.actor.poderes ?? []).map((i) => this._poder(i));

            const arteEscolhida = lerArteMestre(actor, "deuses-negativo");
            const ha = {
                aba: ABAS.includes(this._aba) ? this._aba : "ameaca",
                desbloqueada,
                editavel: this.isEditable,
                arteChave: arteEscolhida ?? "sem-arte",
                arte: arteEscolhida ? foundry.utils.getRoute(`modules/${MODULE_ID}/assets/fundos/${ARTES[arteEscolhida]}`) : "",
                escudo: foundry.utils.getRoute(ESCUDO),
                nd: sys.attributes.nd || "—",
                patamar: (() => {
                    const chave = patamarDoND(sys.attributes.nd);
                    return {
                        chave,
                        rotulo: localizar(`T20A.Ameaca.Patamar.${chave}`),
                        brasao: foundry.utils.getRoute(`modules/${MODULE_ID}/assets/brasoes/nd-${chave}.webp`)
                    };
                })(),
                xp: sys.attributes.nivel?.xp?.value ?? 0,
                papel: papel ? { key: papel, rotulo: localizar(T20.creatureRoles[papel] ?? papel), icone: ICONES_PAPEL[papel] ?? "fa-star" } : null,
                tipo: sys.detalhes.tipo ? { rotulo: localizar(T20.creatureTypes[sys.detalhes.tipo] ?? sys.detalhes.tipo), icone: ICONES_TIPO[sys.detalhes.tipo] ?? "fa-circle" } : null,
                raca: sys.detalhes.raca,
                tamanho: localizar(T20.actorSizes[sys.tracos.tamanho] ?? ""),
                pv: { ...pv, pct: pct(pv.value, pv.max), tempPct: pct(pv.temp, pv.max), digitos: digitos(pv.value, pv.max), digitosTemp: String(Math.trunc(Number(pv.temp) || 0)).length },
                pm: { ...pm, pct: pct(pm.value, pm.max), tempPct: pct(pm.temp, pm.max), digitos: digitos(pm.value, pm.max), digitosTemp: String(Math.trunc(Number(pm.temp) || 0)).length },
                temPM: pm.max > 0 || desbloqueada,
                defesa: sys.attributes.defesa.value,
                testesMenores: TESTES_MENORES.map(({ key, rotulo }) => ({ key, rotulo: localizar(rotulo), ...comSinal(pericias[key]?.value) })),
                resistencias: RESISTENCIAS.map(({ key, rotulo, icone }) => ({
                    key,
                    icone,
                    rotulo: localizar(rotulo),
                    nome: pericias[key]?.label || localizar(rotulo),
                    ...comSinal(pericias[key]?.value)
                })),
                atributos: Object.entries(sys.atributos).map(([key, atr]) => ({
                    key,
                    abbr: localizar(T20.atributosAbr[key]),
                    label: localizar(T20.atributos[key]),
                    base: atr.base,
                    ...comSinal(atr.value)
                })),
                tracos: this._tracos(data),
                corpoACorpo: ataques.filter((a) => a.melee),
                distancia: ataques.filter((a) => !a.melee),
                acoes: poderes.filter((p) => p.execucao),
                habilidades: poderes.filter((p) => !p.execucao),
                poderesPorTipo: this._poderesPorTipo(poderes),
                magias: this._magias(data.actor.magias),
                cd: sys.attributes.cd,
                listaPericias: this._listaPericias(sys),
                equipamento: this._equipamento(data.actor.inventario, sys.detalhes.equipamento),
                inventario: this._inventario(data.actor.inventario),
                get espacosTotais() {
                    const soma = this.inventario.flatMap((c) => c.itens).reduce((t, i) => t + i.espacos, 0);
                    return Math.round(soma * 100) / 100;
                },
                moedas: MOEDAS
                    .filter((m) => m.chave !== "tl" || data.mostrarPlatina || Number(sys.dinheiro?.tl) > 0)
                    .map((m) => ({
                        ...m,
                        rotulo: localizar(m.rotulo),
                        valor: Number(sys.dinheiro?.[m.chave]) || 0,
                        icone: foundry.utils.getRoute(`modules/${MODULE_ID}/assets/moedas/moeda-${m.chave}.webp`)
                    })),
                tesouro: sys.detalhes.tesouro,
                // Tesouro de chefão costuma ser um parágrafo inteiro: recolhido em poucas linhas, abre ao clicar
                tesouroLongo: String(sys.detalhes.tesouro ?? "").length > 180,
                tesouroAberto: this._abertas.has("tesouro"),
                efeitos: actor.effects.size,
                condicoes: listarCondicoes(actor),
                recolhidas: game.settings.get(MODULE_ID, SETTING_RECOLHIDAS) ?? {},
                busca: this._busca
            };
            ha.pericias = ha.listaPericias.filter((p) => p.treinado && !PERICIAS_DESTACADAS.has(p.key));
            // A busca da aba Ameaça acha qualquer perícia: as que não aparecem ficam prontas, escondidas
            ha.periciasBusca = ha.listaPericias.map((p) => ({ ...p, soBusca: !p.treinado || PERICIAS_DESTACADAS.has(p.key) }));
            ha.temAtaques = ataques.length > 0 || !!(sys.detalhes.ataquescac || sys.detalhes.ataquesad);
            ha.temMagias = ha.magias.length > 0;
            ha.abas = [
                { id: "ameaca", rotulo: localizar("T20A.Ameaca.Abas.Ameaca"), icone: "fa-solid fa-dragon" },
                { id: "pericias", rotulo: localizar("T20.Skills"), icone: "fa-solid fa-list-check" },
                { id: "inventario", rotulo: localizar("T20A.Ameaca.Abas.Inventario"), icone: "fa-solid fa-sack" },
                { id: "poderes", rotulo: localizar("T20A.Ameaca.Abas.Poderes"), icone: "fa-solid fa-fire-flame-curved" },
                { id: "efeitos", rotulo: localizar("T20A.Ameaca.Abas.Efeitos"), icone: "fa-solid fa-bolt", contagem: ha.efeitos || null },
                { id: "diario", rotulo: localizar("T20A.Ameaca.Abas.Diario"), icone: "fa-solid fa-book-open" }
            ].map((a) => ({ ...a, ativa: a.id === ha.aba }));
            data.ha = ha;
            data.editMode = desbloqueada;
            return data;
        }

        /** Linha de ataque: número de ataques, bônus, dano e crítico já prontos. */
        _ataque(i) {
            const item = this.actor.items.get(i._id);
            const labels = item?.labels ?? {};
            const descricao = typeof i.system.description === "string" ? i.system.description : i.system.description?.value ?? "";
            return {
                id: i._id,
                nome: i.name,
                img: i.img,
                aberta: this._abertas.has(i._id),
                descricao,
                melee: !!i.melee,
                ataques: i.system.ataques > 1 ? i.system.ataques : null,
                acerto: labels.toHit ?? "",
                dano: labels.dano ?? "",
                // O sistema junta os tipos com vírgula e às vezes deixa uma sobrando no fim
                tipoDano: String(labels.damageTypes ?? "").replace(/[\s,]+$/, ""),
                critico: labels.critico ?? "",
                alcance: [
                    i.melee ? localizar("T20.Melee") : null,
                    i.ranged ? (rotuloAlcance(i.system.alcance) || localizar("T20.Ranged")) : null
                ].filter(Boolean).join(" · ")
            };
        }

        /** Poder: execução e custo viram etiquetas; a descrição já vem enriquecida do sistema. */
        _poder(i) {
            const exec = i.system.ativacao?.execucao;
            const ativa = exec && exec !== "passive";
            const descricao = typeof i.system.description === "string" ? i.system.description : i.system.description?.value ?? "";
            return {
                id: i._id,
                nome: i.name,
                img: i.img,
                tipo: i.system.tipo,
                execucao: ativa ? localizar(CONFIG.T20.abilityActivationTypes[exec] ?? exec) : null,
                // Só Reação, Livre e Completa ganham cor (são as que mudam o turno); o resto fica neutro
                execKey: ativa ? exec : null,
                iconeExecucao: ICONES_EXECUCAO[exec] ?? "fa-star",
                custo: Number(i.system.ativacao?.custo) || 0,
                aberta: this._abertas.has(i._id),
                previa: previaDoTexto(descricao),
                descricao
            };
        }

        /** Todos os poderes agrupados por tipo; destravada, os tipos vazios aparecem para o "+". */
        _poderesPorTipo(poderes) {
            const tipos = CONFIG.T20.powerType ?? {};
            const grupo = (tipo, rotulo, itens) => ({ tipo, chave: `poderes-${tipo ?? "outros"}`, rotulo, itens });
            const grupos = TIPOS_PODER.map((tipo) => grupo(tipo, localizar(tipos[tipo] ?? tipo), poderes.filter((p) => p.tipo === tipo)));
            const outros = poderes.filter((p) => !TIPOS_PODER.includes(p.tipo));
            if (outros.length) grupos.push(grupo(null, localizar("T20A.Ficha.Outros"), outros));
            return grupos.filter((g) => g.itens.length || this.desbloqueada);
        }

        _magias(grimorio = {}) {
            return Object.entries(grimorio)
                .filter(([, c]) => c.spells?.length)
                .map(([circulo, c]) => ({
                    circulo,
                    custo: CUSTO_CIRCULO[circulo],
                    itens: c.spells.map((m) => {
                        const exec = m.system.ativacao?.execucao;
                        return {
                            id: m._id,
                            nome: m.name,
                            img: m.img,
                            execucao: localizar(CONFIG.T20.abilityActivationTypes[exec] ?? ""),
                            execKey: exec || null,
                            aberta: this._abertas.has(m._id),
                            tags: this._etiquetasDaMagia(this.actor.items.get(m._id)),
                            descricao: m.system.description?.value ?? ""
                        };
                    })
                }));
        }

        /**
         * Etiquetas da magia, as mesmas que a Ficha Hayd mostra na descrição
         * aberta: tipo (arcana, divina…), ativação, alcance, alvo, área,
         * duração, resistência, escola e círculo. O custo fica de fora (é o do círculo).
         */
        _etiquetasDaMagia(item) {
            if (!item) return [];
            const l = item.labels ?? {};
            const tipo = CONFIG.T20.spellType?.[item.system.tipo];
            const tags = [tipo ? localizar(tipo) : ""];
            for (const t of [l.ativacao, l.range, l.alvo, l.area, l.duration, l.save, l.escola, l.nivel]) {
                if (t && t !== "Nenhum" && t !== "Instantânea" && !tags.includes(t)) tags.push(t);
            }
            return tags.filter(Boolean);
        }

        /**
         * Todas as perícias, em ordem alfabética. Ameaças importadas de bloco
         * costumam guardar só algumas; as que faltam saem com o valor que o
         * próprio sistema calcularia (meio nível + atributo), marcadas como
         * "não salvas" para a rolagem e a edição gravarem a perícia antes.
         */
        _listaPericias(sys) {
            const T20 = CONFIG.T20;
            const salvas = sys.pericias ?? {};
            const chaves = new Set([...Object.keys(T20.pericias ?? {}).filter((k) => !OFICIOS.has(k)), ...Object.keys(salvas)]);
            const lista = [];
            for (const key of chaves) {
                if (key.startsWith("_")) continue;
                const salva = salvas[key];
                const dados = salva ?? this._periciaPadrao(key);
                const label = salva?.label || T20.pericias[key]?.label;
                if (!label || label === key) continue; // entradas quebradas, como "ofi0"
                lista.push({
                    key,
                    label: localizar(label),
                    atributo: dados.atributo,
                    abbr: localizar(T20.atributosAbr[dados.atributo] ?? ""),
                    treinado: !!dados.treinado,
                    outros: dados.outros ?? 0,
                    salva: !!salva,
                    ...comSinal(dados.value)
                });
            }
            return lista.sort((a, b) => a.label.localeCompare(b.label));
        }

        /** Perícia que a ameaça não guarda, com o valor calculado pela fórmula do sistema. */
        _periciaPadrao(key) {
            const base = {
                atributo: CONFIG.T20.pericias[key]?.abl ?? "for", treinado: false, st: false, pda: false,
                size: false, outros: 0, condi: 0, bonus: [], custom: false, label: ""
            };
            try { return this.actor.system.prepareSkill(key, { skillData: base }); }
            catch (_) { return { ...base, value: 0 }; }
        }

        /** Imunidades, reduções, vulnerabilidades, sentidos, deslocamento e idiomas como chips. */
        _tracos(data) {
            const sys = data.system;
            const T20 = CONFIG.T20;
            const imunidades = [];
            const reducoes = [];
            const vulnerabilidades = [];
            // Dano extra por dado: a criatura sofre +1 de dano por dado daquele tipo
            const porDado = [];
            // Mesma prioridade da ficha do sistema (traits.hbs): imunidade, por dado, vulnerabilidade, exceção, redução
            for (const [k, r] of Object.entries(sys.tracos.resistencias ?? {})) {
                const nome = localizar(T20.damageTypes?.[k] ?? k);
                if (r.imunidade) imunidades.push(nome);
                else if (r.danoPorDado) porDado.push(nome);
                else if (r.vulnerabilidade) vulnerabilidades.push(nome);
                else if (r.excecao > 0) reducoes.push(`${r.excecao}/${nome}`);
                else if (r.value > 0) reducoes.push(`${nome} ${r.value}`);
            }
            // Imunidade a condições tem linha própria: misturada às de dano, "Atordoado" parecia um tipo de dano.
            // Vem já preparada (inclui as de efeitos ativos, como as "Imunidades Dracônicas", e a personalizada).
            const condicoes = Object.values(sys.tracos.ic?.selected ?? {}).map((v) => localizar(v));
            const deslocamento = Object.values(data.movement ?? {});
            if (sys.detalhes.movimento) deslocamento.push(sys.detalhes.movimento);
            const idiomas = data.enableLanguages ? Object.values(sys.tracos.idiomas?.selected ?? {}) : [];
            return {
                imunidades,
                condicoes,
                reducoes,
                vulnerabilidades,
                porDado,
                resistenciasTexto: sys.detalhes.resistencias,
                sentidos: (data.senses?.value ?? []).map((s) => localizar(s)),
                deslocamento,
                idiomas,
                temDefesas: imunidades.length || reducoes.length || vulnerabilidades.length || porDado.length || !!sys.detalhes.resistencias
            };
        }

        /** Inventário por categoria: todas aparecem destravada (para o "+"), só as com itens travada. */
        _inventario(inventario = {}) {
            return INVENTARIO.map(({ tipo, icone, rotulo }) => ({
                tipo,
                icone,
                chave: `inv-${tipo}`,
                rotulo: localizar(rotulo),
                itens: (inventario[tipo]?.items ?? []).map((i) => this._linhaInventario(i))
            })).filter((c) => c.itens.length || this.desbloqueada);
        }

        /**
         * Linha do inventário com as colunas da categoria, como no inventário do
         * jogador: armas com ataque, dano e crítico; equipamento com Defesa e
         * penalidade; todos com quantidade e espaços (quantidade × espaços de um).
         */
        _linhaInventario(i) {
            const T20 = CONFIG.T20;
            const sys = i.system;
            const item = this.actor.items.get(i._id);
            const labels = item?.labels ?? {};
            const nome = (mapa, chave) => (chave && mapa?.[chave] ? localizar(mapa[chave]) : "");
            const qtd = Number(sys.qtd) || 0;
            const linha = {
                id: i._id,
                nome: i.name,
                img: i.img,
                tipo: i.type,
                qtd,
                espacos: Math.round(qtd * (Number(sys.espacos) || 0) * 100) / 100,
                aberta: this._abertas.has(i._id),
                descricao: sys.description?.value ?? ""
            };
            const sub = [];
            if (i.type === "arma") {
                sub.push(nome(T20.weaponTypes, sys.proficiencia), nome(T20.weaponPurposeTypes, sys.proposito));
                linha.ataque = labels.toHit ?? "";
                linha.dano = labels.dano ?? "";
                linha.critico = labels.dano ? (labels.critico ?? "") : "";
                if (Number(sys.equipado) > 0) linha.equipado = true;
            } else if (i.type === "equipamento") {
                sub.push(nome(T20.armorTypes, sys.tipo));
                const a = sys.armadura ?? {};
                const def = Number(a.value) || 0;
                const pen = Number(a.penalidade) || 0;
                linha.defesa = def ? `${def > 0 ? "+" : ""}${def}` : "—";
                linha.penalidade = pen ? String(pen).replace("-", "−") : "—";
                if (sys.equipado) linha.equipado = true;
            } else if (i.type === "consumivel") {
                const tipos = { ammo: "Munição", scroll: "Pergaminho", alchemy: "Alquímico", potion: "Poção", material: "Material", food: "Comida" };
                sub.push(tipos[sys.tipo] ?? "", sys.subtipo ?? "");
            }
            linha.sub = sub.filter(Boolean).join(" · ");
            return linha;
        }

        /** Texto livre do equipamento + os itens (menos armas naturais), como no bloco do livro. */
        _equipamento(inventario = {}, texto) {
            const itens = [];
            for (const lista of Object.values(inventario)) {
                for (const i of lista.items ?? []) {
                    if (i.type === "arma" && i.system.proficiencia === "natural") continue;
                    itens.push({ id: i._id, img: i.img, nome: i.system.qtd > 1 ? `${i.name} ×${i.system.qtd}` : i.name });
                }
            }
            return { texto, itens };
        }

        /* ------------------------------------------------------------------ */
        /*  Interações                                                         */
        /* ------------------------------------------------------------------ */

        activateListeners(html) {
            super.activateListeners(html);
            const root = html[0] ?? html;
            const ligar = (seletor, evento, fn) => root.querySelectorAll(seletor).forEach((el) => el.addEventListener(evento, fn));

            // Só interface (abas, seções, descrições): troca classes, sem redesenhar a janela
            ligar("[data-ha-aba]", "click", (ev) => this._trocarAba(root, ev.currentTarget.dataset.haAba));
            ligar("[data-ha-recolher]", "click", (ev) => this._alternarSecao(ev));
            ligar("[data-ha-alternar]", "click", (ev) => this._alternarDescricao(ev));
            // Texto longo (tesouro de chefão): três linhas; clique ou Enter mostra tudo e recolhe de novo
            const alternarLongo = (el) => {
                const chave = el.dataset.haLongo;
                if (el.classList.toggle("aberto")) this._abertas.add(chave);
                else this._abertas.delete(chave);
            };
            ligar("[data-ha-longo]", "click", (ev) => alternarLongo(ev.currentTarget));
            ligar("[data-ha-longo]", "keydown", (ev) => {
                if (ev.key !== "Enter" && ev.key !== " ") return;
                ev.preventDefault();
                alternarLongo(ev.currentTarget);
            });
            // Olho sobre o retrato: abre a arte em tamanho cheio (qualquer um que veja a ficha)
            ligar("[data-ha-acao='ver-arte']", "click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation(); // não abre o seletor de imagem do retrato
                new foundry.applications.apps.ImagePopout({
                    src: this.actor.img,
                    uuid: this.actor.uuid,
                    window: { title: this.actor.name }
                }).render({ force: true });
            });
            // Busca: filtra enquanto digita; Esc limpa; não passa pelo submit do formulário
            const busca = root.querySelector("input[data-ha-busca]");
            if (busca) {
                busca.addEventListener("input", () => this._filtrar(busca));
                busca.addEventListener("change", (ev) => ev.stopPropagation());
                busca.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") ev.preventDefault();
                    if (ev.key !== "Escape" || !busca.value) return;
                    ev.preventDefault();
                    ev.stopPropagation(); // Esc com texto limpa a busca, não fecha a janela
                    busca.value = "";
                    this._filtrar(busca);
                });
                if (busca.value) this._filtrar(busca);
            }
            if (!this.isEditable) return;

            ligar("[data-ha-acao='cadeado']", "click", () => {
                const { MODES } = this.constructor;
                this._mode = this.desbloqueada ? MODES.PLAY : MODES.EDIT;
                this.render();
            });
            ligar("[data-ha-acao='condicao']", "click", (ev) => {
                // Resposta imediata: o botão acende já no clique; o redesenho só confirma
                const botao = ev.currentTarget;
                botao.classList.toggle("ativa");
                this.actor.toggleStatusEffect(botao.dataset.condicao);
            });
            ligar("[data-ha-acao='editar-item']", "click", (ev) => this._itemDoEvento(ev)?.sheet.render(true));
            ligar("[data-ha-acao='apagar-item']", "click", (ev) => this._apagarItem(ev));
            ligar("[data-ha-acao='nova-magia']", "click", (ev) => this._criarItem(ev, "magia"));
            ligar("[data-ha-acao='novo-poder']", "click", (ev) => this._criarItem(ev, "poder"));
            ligar("[data-ha-acao='nova-arma']", "click", (ev) => this._criarItem(ev, "arma"));
            ligar("[data-ha-acao='novo-item']", "click", (ev) => this._criarItem(ev, ev.currentTarget.dataset.tipo));
            // − / + da quantidade no inventário (nunca abaixo de zero)
            ligar("[data-ha-passo]", "click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const item = this.actor.items.get(ev.currentTarget.closest("[data-item-id]")?.dataset.itemId);
                if (!item) return;
                const novo = Math.max(0, (Number(item.system.qtd) || 0) + Number(ev.currentTarget.dataset.haPasso));
                if (novo !== item.system.qtd) item.update({ "system.qtd": novo });
            });
            ligar("[data-ha-acao='rolar-pericia']", "click", (ev) => this._rolarPericiaNaoSalva(ev));
            ligar("[data-ha-campo]", "change", (ev) => this._editarPericia(ev));
            root.querySelectorAll("input[data-ha-delta]").forEach((el) => {
                el.addEventListener("focus", (ev) => ev.currentTarget.select());
                el.addEventListener("change", (ev) => this._onDelta(ev));
                el.addEventListener("keydown", (ev) => {
                    if (ev.key !== "Escape") return;
                    ev.currentTarget.value = ev.currentTarget.defaultValue;
                    ev.currentTarget.blur();
                });
            });
            // Clicar em qualquer ponto da barra foca o valor atual
            ligar("[data-ha-barra]", "click", (ev) => {
                if (ev.target.closest("input, label")) return;
                ev.currentTarget.querySelector("input[data-ha-delta]")?.focus();
            });
        }

        _trocarAba(root, aba) {
            if (!ABAS.includes(aba) || aba === this._aba) return;
            this._aba = aba;
            root.querySelectorAll(".ha-aba-botao[data-ha-aba]").forEach((b) => b.classList.toggle("ativa", b.dataset.haAba === aba));
            root.querySelectorAll(".ha-aba").forEach((a) => {
                const ativa = a.dataset.aba === aba;
                a.classList.toggle("ativa", ativa);
                // Só a troca de aba anima; os redesenhos da ficha não
                if (ativa && !menosMovimento()) animarClasse(a, "ha-anim-entrar", 400);
            });
        }

        /**
         * Mostra só o que tem o termo no nome: linhas, chips de perícia e de
         * equipamento. Grupo (corpo a corpo, círculo) e seção sem nada somem;
         * seções recolhidas abrem enquanto a busca está ativa (pelo CSS).
         */
        _filtrar(input) {
            const aba = input.closest(".ha-aba");
            if (!aba) return;
            this._busca = input.value;
            const termo = normalizar(input.value.trim());
            aba.classList.toggle("ha-buscando", !!termo);
            let total = 0;
            for (const secao of aba.querySelectorAll(".ha-secao")) {
                let visiveis = 0;
                for (const alvo of secao.querySelectorAll("li.item[data-nome], .ha-chip-rolavel[data-nome]")) {
                    const ok = !termo || normalizar(alvo.dataset.nome).includes(termo);
                    alvo.hidden = !ok;
                    destacarBusca(alvo.querySelector(".ha-item-nome, .ha-chip-nome") ?? alvo, ok ? termo : "");
                    if (ok) visiveis++;
                }
                for (const grupo of secao.querySelectorAll(".ha-grupo")) {
                    const lista = grupo.nextElementSibling;
                    grupo.hidden = !!termo && !!lista?.matches("ol") && !lista.querySelector("li.item:not([hidden])");
                }
                secao.hidden = !!termo && visiveis === 0;
                total += visiveis;
            }
            const vazio = aba.querySelector(".ha-sem-resultado");
            if (vazio) {
                vazio.hidden = !termo || total > 0;
                vazio.querySelector("b").textContent = input.value.trim();
            }
        }

        /** Recolhe/expande uma seção pelo cabeçalho (a animação é do CSS) e lembra a escolha. */
        _alternarSecao(ev) {
            if (ev.target.closest(".ha-secao-criar, .effect-control, input, select")) return;
            const secao = ev.currentTarget.closest("[data-ha-secao]");
            if (!secao) return;
            const recolhida = secao.classList.toggle("recolhida");
            const todas = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_RECOLHIDAS) ?? {});
            if (recolhida) todas[secao.dataset.haSecao] = true;
            else delete todas[secao.dataset.haSecao];
            game.settings.set(MODULE_ID, SETTING_RECOLHIDAS, todas);
        }

        /** Abre/fecha a regra de uma habilidade ou magia. O ícone e os controles fazem o deles. */
        _alternarDescricao(ev) {
            if (ev.target.closest(".item-image, .ha-controles, .rollable, input, select, button")) return;
            const li = ev.currentTarget.closest("li[data-item-id]");
            if (!li?.querySelector(".ha-descricao-corpo")) return;
            const id = li.dataset.itemId;
            if (li.classList.toggle("aberta")) this._abertas.add(id);
            else this._abertas.delete(id);
        }

        /** Confirma, recolhe a linha e só então apaga: o item não some num estalo. */
        async _apagarItem(ev) {
            const item = this._itemDoEvento(ev);
            if (!item) return;
            const li = ev.currentTarget.closest("li.item");
            const tipo = localizar(CONFIG.Item.typeLabels?.[item.type] ?? "DOCUMENT.Item");
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: `${localizar("T20.Delete")}: ${item.name}`, icon: "fa-solid fa-trash" },
                content: `<p><strong>${localizar("AreYouSure")}</strong> ${game.i18n.format("SIDEBAR.DeleteWarning", { type: tipo })}</p>`,
                rejectClose: false
            });
            if (!ok) return;
            if (li && !menosMovimento()) {
                li.style.height = `${li.offsetHeight}px`;
                void li.offsetHeight;
                li.classList.add("ha-saindo");
                li.style.height = "0px";
                await new Promise((r) => setTimeout(r, 240));
            }
            return item.delete();
        }

        /* ------------------------------------------------------------------ */
        /*  Redesenho sem solavanco                                            */
        /* ------------------------------------------------------------------ */

        /**
         * Toda mudança no ator redesenha a ficha (é assim no sistema). Para não
         * parecer que a página recarregou, a ficha guarda antes o que está na
         * tela — foco e cursor, barras, números, itens — e depois anima só a
         * diferença: a barra desliza, o número conta, o item novo entra.
         */
        async _render(force, options = {}) {
            const antes = this._fotografar();
            await super._render(force, options);
            if (antes) this._animarMudancas(antes);
        }

        _fotografar() {
            const root = this.element?.[0]?.querySelector?.("form.ha-ficha");
            if (!root) return null;
            const valores = {};
            for (const el of root.querySelectorAll("[data-ha-valor]")) {
                valores[el.dataset.haValor] = el.tagName === "INPUT" ? el.defaultValue : el.textContent.trim();
            }
            const barras = {};
            for (const el of root.querySelectorAll("[data-ha-barra]")) {
                barras[el.dataset.haBarra] = parseFloat(el.style.getPropertyValue("--ha-pct")) || 0;
            }
            const itens = new Set([...root.querySelectorAll("li.item[data-item-id], li.effect[data-effect-id]")]
                .map((li) => li.dataset.itemId ?? li.dataset.effectId));
            const ativo = document.activeElement;
            let foco = null;
            if (ativo && root.contains(ativo) && ativo.matches("input, select, textarea")) {
                let inicio = null;
                let fim = null;
                try { inicio = ativo.selectionStart; fim = ativo.selectionEnd; } catch (_) { /* number/select */ }
                foco = { seletor: this._seletorDoCampo(ativo), inicio, fim, delta: !!ativo.dataset.haDelta };
            }
            return { valores, barras, itens, foco, modo: this._mode };
        }

        /** Seletor estável para achar o mesmo campo no HTML novo. */
        _seletorDoCampo(el) {
            if (el.dataset.haBusca !== undefined) return "[data-ha-busca]";
            const pericia = el.closest("[data-pericia]")?.dataset.pericia;
            if (pericia && el.dataset.haCampo) return `[data-pericia="${pericia}"] [data-ha-campo="${el.dataset.haCampo}"]`;
            // Quantidade: o mesmo campo existe em cada linha, então o item entra no seletor
            if (el.dataset.haDelta && el.dataset.haDoc === "item") {
                return `[data-item-id="${el.closest("[data-item-id]")?.dataset.itemId}"] [data-ha-delta="${el.dataset.haDelta}"]`;
            }
            if (el.dataset.haDelta) return `[data-ha-delta="${el.dataset.haDelta}"]`;
            if (el.name) return `[name="${el.name}"]`;
            return null;
        }

        _animarMudancas(antes) {
            const root = this.element?.[0]?.querySelector?.("form.ha-ficha");
            if (!root) return;

            // Foco e cursor voltam para o mesmo campo (Tab entre perícias segue funcionando)
            const campo = antes.foco?.seletor ? root.querySelector(antes.foco.seletor) : null;
            if (campo) {
                campo.focus({ preventScroll: true });
                // Campo de delta volta todo selecionado, pronto para o próximo "-5"
                if (!antes.foco.delta && antes.foco.inicio !== null) {
                    try { campo.setSelectionRange(antes.foco.inicio, antes.foco.fim); } catch (_) { /* sem cursor */ }
                }
            }
            if (menosMovimento()) return;

            // Cadeado: os campos de edição surgem em vez de aparecer num estalo
            if (antes.modo !== this._mode) animarClasse(root, "ha-modo-mudou", 600);

            // Barras de PV/PM deslizam do valor antigo; no dano, o pedaço perdido esvazia depois
            for (const [id, pctAntes] of Object.entries(antes.barras)) {
                const barra = root.querySelector(`[data-ha-barra="${id}"]`);
                if (!barra) continue;
                const pctAgora = parseFloat(barra.style.getPropertyValue("--ha-pct")) || 0;
                if (pctAgora === pctAntes) continue;
                const perdeu = pctAgora < pctAntes;
                barra.classList.add("ha-sem-transicao");
                barra.style.setProperty("--ha-pct", `${pctAntes}%`);
                barra.style.setProperty("--ha-rastro", `${pctAntes}%`);
                void barra.offsetWidth;
                barra.classList.remove("ha-sem-transicao");
                barra.style.setProperty("--ha-pct", `${pctAgora}%`);
                animarClasse(barra, perdeu ? "ha-perdeu" : "ha-ganhou", 700);
                setTimeout(() => barra.style.setProperty("--ha-rastro", `${pctAgora}%`), perdeu ? 380 : 0);
            }

            // Números que mudaram: contam até o novo valor e acendem (verde subiu, vermelho caiu)
            for (const el of root.querySelectorAll("[data-ha-valor]")) {
                const antigo = antes.valores[el.dataset.haValor];
                const atual = el.tagName === "INPUT" ? el.defaultValue : el.textContent.trim();
                if (antigo === undefined || antigo === atual) continue;
                const de = numero(antigo);
                const para = numero(atual);
                if (Number.isNaN(de) || Number.isNaN(para)) continue;
                if (/^-?\d+$/.test(antigo) && /^-?\d+$/.test(atual)) contar(el, de, para);
                animarClasse(el, para < de ? "ha-caiu" : "ha-subiu", 900);
            }

            // Itens e efeitos novos entram deslizando
            for (const li of root.querySelectorAll("li.item[data-item-id], li.effect[data-effect-id]")) {
                if (!antes.itens.has(li.dataset.itemId ?? li.dataset.effectId)) animarClasse(li, "ha-surgiu", 700);
            }
        }

        _itemDoEvento(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            return this.actor.items.get(ev.currentTarget.closest("[data-item-id]")?.dataset.itemId);
        }

        /** Cria o item já do tipo certo (arma corpo a corpo ou à distância, poder, magia). */
        _criarItem(ev, tipo) {
            ev.preventDefault();
            const nomes = {
                arma: "T20A.Ameaca.NovoAtaque", poder: "T20A.Ameaca.NovaHabilidade", magia: "T20A.Ameaca.NovaMagia",
                equipamento: "T20A.Ameaca.NovoItem", consumivel: "T20A.Ameaca.NovoItem", tesouro: "T20A.Ameaca.NovoItem"
            };
            if (!nomes[tipo]) return;
            const system = {};
            if (tipo === "poder") system.tipo = ev.currentTarget.dataset.poderTipo ?? "ability";
            if (tipo === "arma") system.proposito = ev.currentTarget.dataset.proposito ?? "corpo-a-corpo";
            return this.actor.createEmbeddedDocuments("Item", [{ name: localizar(nomes[tipo]), type: tipo, system }], { renderSheet: true });
        }

        /** Dados mínimos para gravar uma perícia que a ameaça ainda não guarda. */
        _novaPericia(key, mudancas = {}) {
            return { atributo: CONFIG.T20.pericias[key]?.abl ?? "for", treinado: false, outros: 0, ...mudancas };
        }

        /** Rolar uma perícia não salva: grava com os valores padrão e rola pelo sistema. */
        async _rolarPericiaNaoSalva(ev) {
            ev.preventDefault();
            const key = ev.currentTarget.closest("[data-pericia]")?.dataset.pericia;
            if (!key) return;
            if (!this.actor.system.pericias?.[key]) {
                await this.actor.update({ [`system.pericias.${key}`]: this._novaPericia(key) });
            }
            return this.actor.rollPericia(key, { event: ev, message: true });
        }

        /**
         * Treino, atributo e "outros" na aba Perícias. Os campos não têm name:
         * gravam só a perícia mexida (e criam a que ainda não existia), em vez
         * de o formulário inteiro salvar todas as perícias calculadas.
         */
        async _editarPericia(ev) {
            ev.stopPropagation();
            const el = ev.currentTarget;
            const key = el.closest("[data-pericia]")?.dataset.pericia;
            const campo = el.dataset.haCampo;
            if (!key) return;
            const valor = campo === "treinado" ? el.checked : campo === "outros" ? Number(el.value) || 0 : el.value;
            // O losango acende na hora; o valor novo chega com o redesenho
            if (campo === "treinado") el.closest(".ha-pericia")?.classList.toggle("treinada", valor);
            if (this.actor._source.system.pericias?.[key]) {
                return this.actor.update({ [`system.pericias.${key}.${campo}`]: valor });
            }
            return this.actor.update({ [`system.pericias.${key}`]: this._novaPericia(key, { [campo]: valor }) });
        }

        /** Campo com delta (+5, -3, =7). Dano gasta primeiro os pontos temporários. */
        async _onDelta(ev) {
            ev.stopPropagation();
            const input = ev.currentTarget;
            const caminho = input.dataset.haDelta;
            // Quantidade do inventário é do item; o resto (PV, PM, moedas) é do ator
            const alvo = input.dataset.haDoc === "item"
                ? this.actor.items.get(input.closest("[data-item-id]")?.dataset.itemId)
                : this.actor;
            if (!alvo) return;
            const atual = Number(foundry.utils.getProperty(alvo, caminho)) || 0;
            let novo = aplicarDelta(input.value, atual);
            if (input.dataset.haMin !== undefined) novo = Math.max(Number(input.dataset.haMin), novo);
            if (input.dataset.haMax) novo = Math.min(Number(input.dataset.haMax), novo);
            if (novo === atual) {
                input.value = atual;
                return;
            }
            if (alvo !== this.actor) return alvo.update({ [caminho]: novo });
            const m = caminho.match(/^(system\.attributes\.(?:pv|pm))\.value$/);
            const temp = m ? Number(foundry.utils.getProperty(this.actor, `${m[1]}.temp`)) || 0 : 0;
            if (!temp || novo >= atual) return this.actor.update({ [caminho]: novo });
            const gastoTemp = Math.min(temp, atual - novo);
            return this.actor.update({ [caminho]: novo + gastoTemp, [`${m[1]}.temp`]: temp - gastoTemp });
        }
    };
}

/** Alcance da arma à distância ("curto", "médio"…) pelo rótulo do sistema. */
function rotuloAlcance(chave) {
    const rotulo = CONFIG.T20.distanceUnits?.[chave];
    return rotulo ? localizar(rotulo) : "";
}
