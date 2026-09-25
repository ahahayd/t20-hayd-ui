/**
 * Origem dos poderes: anotação de em que nível e de onde veio cada poder e
 * magia da ficha de personagem. É só organização, guardada numa flag do
 * próprio item: não muda regra, rolagem nem a ordem da lista do sistema.
 *
 * Dois jeitos de ver, por usuário:
 * - "organizador": botão discreto no cabeçalho de Poderes que abre uma tela
 *   com tudo agrupado por nível, e uma etiqueta pequena ao lado de cada item
 *   anotado;
 * - "legado": o selo clicável antigo antes do ícone de cada poder.
 * O Mestre pode desligar os dois para o mundo inteiro.
 */

export const MODULE_ID = "t20-hayd-ui";

const FLAG_ORIGEM = "origemPoder";  // { categoria: string, nivel: number|null }
const FLAG_NIVEL_LEGADO = "nivelObtido"; // formato do selo antigo: 1..20 | "bonus"

/** Categorias de fábrica; qualquer outro texto é categoria criada pelo jogador. */
const CATEGORIAS = ["nivel", "origem", "devocao", "complicacao", "bonus"];
/** Categoria sugerida pelo tipo que o próprio sistema dá ao poder. */
const SUGESTAO_POR_TIPO = { origem: "origem", complicacao: "complicacao", concedido: "devocao" };
/** Categorias que, por regra, entram na criação do personagem (nível 1). */
const CATEGORIAS_DE_CRIACAO = new Set(["origem", "complicacao"]);
const TIPOS_ANOTAVEIS = new Set(["poder", "magia"]);
const MAX_CATEGORIA = 40;
const COLLATOR = new Intl.Collator("pt-BR");

/* -------------------------------------------------------------------------- */
/*  Configurações                                                              */
/* -------------------------------------------------------------------------- */

export function registrarConfiguracoes(reRender) {
    game.settings.register(MODULE_ID, "origemPoderesMundo", {
        name: "T20A.Settings.OrigemPoderesMundoName",
        hint: "T20A.Settings.OrigemPoderesMundoHint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: reRender
    });

    game.settings.register(MODULE_ID, "origemPoderes", {
        name: "T20A.Settings.OrigemPoderesName",
        hint: "T20A.Settings.OrigemPoderesHint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            organizador: "T20A.Settings.OrigemPoderesOrganizador",
            legado: "T20A.Settings.OrigemPoderesLegado",
            desligado: "T20A.Settings.OrigemPoderesDesligado"
        },
        default: "organizador",
        onChange: reRender
    });

    // Opção antiga (liga/desliga do selo). Fica registrada, fora do menu, só
    // para quem já a tinha ligado continuar no selo sem precisar mexer.
    game.settings.register(MODULE_ID, "poderesPorNivel", {
        scope: "client",
        config: false,
        type: Boolean,
        default: false
    });
}

/** "organizador" | "legado" | "desligado" para o usuário atual. */
export function modoOrigemPoderes() {
    if (!game.settings.get(MODULE_ID, "origemPoderesMundo")) return "desligado";
    let escolheu = true;
    try {
        escolheu = game.settings.storage.get("client")
            ?.getItem(`${MODULE_ID}.origemPoderes`) != null;
    } catch (_) { /* armazenamento indisponível: vale o valor lido abaixo */ }
    if (!escolheu && game.settings.get(MODULE_ID, "poderesPorNivel")) return "legado";
    const modo = game.settings.get(MODULE_ID, "origemPoderes");
    return ["organizador", "legado", "desligado"].includes(modo) ? modo : "organizador";
}

/* -------------------------------------------------------------------------- */
/*  Dados                                                                      */
/* -------------------------------------------------------------------------- */

function nivelValido(valor) {
    const n = Number(valor);
    return (Number.isInteger(n) && n >= 1 && n <= 99) ? n : null;
}

/** Anotação salva no item, ou null. Lê também o formato do selo antigo. */
export function origemDoItem(item) {
    const salvo = item.getFlag(MODULE_ID, FLAG_ORIGEM);
    if (salvo && typeof salvo === "object") {
        const categoria = typeof salvo.categoria === "string" ? salvo.categoria.trim() : "";
        const nivel = nivelValido(salvo.nivel);
        return (categoria || nivel) ? { categoria, nivel } : null;
    }
    const legado = item.getFlag(MODULE_ID, FLAG_NIVEL_LEGADO);
    const nivel = nivelValido(legado);
    if (nivel) return { categoria: "nivel", nivel };
    if (legado === "bonus") return { categoria: "bonus", nivel: null };
    return null;
}

/** Palpite para item ainda não anotado, a partir do tipo do poder no sistema. */
function sugestaoDoItem(item) {
    if (item.type !== "poder") return null;
    const categoria = SUGESTAO_POR_TIPO[item.system?.tipo];
    if (!categoria) return null;
    return { categoria, nivel: CATEGORIAS_DE_CRIACAO.has(categoria) ? 1 : null };
}

function rotuloCategoria(categoria) {
    return CATEGORIAS.includes(categoria)
        ? game.i18n.localize(`T20A.OrigemPoderes.Categorias.${categoria}`)
        : categoria;
}

/** Texto digitado → chave de fábrica quando bate com o nome de uma, senão o próprio texto. */
function categoriaDoTexto(texto) {
    const limpo = String(texto ?? "").trim().slice(0, MAX_CATEGORIA);
    if (!limpo) return "";
    const comparavel = limpo.toLocaleLowerCase("pt-BR");
    return CATEGORIAS.find(c =>
        c === comparavel || rotuloCategoria(c).toLocaleLowerCase("pt-BR") === comparavel
    ) ?? limpo;
}

function textoDaEtiqueta({ categoria, nivel }) {
    const partes = [];
    if (nivel) partes.push(game.i18n.format("T20A.OrigemPoderes.NivelCurto", { nivel }));
    if (categoria && categoria !== "nivel") partes.push(rotuloCategoria(categoria));
    return partes.join(" · ");
}

/* -------------------------------------------------------------------------- */
/*  Ficha                                                                      */
/* -------------------------------------------------------------------------- */

/** Aplica o modo escolhido na ficha recém-renderizada. */
export function decorarFicha(actor, root) {
    const modo = modoOrigemPoderes();
    if (modo === "legado") marcarSelosLegados(actor, root);
    else if (modo === "organizador") marcarOrganizador(actor, root);
}

function linhasDeItens(root) {
    return [...root.querySelectorAll("li.item[data-item-id]")].filter(li =>
        !li.classList.contains("item-header") && !li.closest(".list-favorites, .favorites")
    );
}

function marcarOrganizador(actor, root) {
    for (const li of linhasDeItens(root)) {
        if (li.querySelector(".t20a-po-tag")) continue;
        const item = actor.items.get(li.dataset.itemId);
        if (!TIPOS_ANOTAVEIS.has(item?.type)) continue;
        const origem = origemDoItem(item);
        const nome = li.querySelector(".item-name label");
        if (!origem || !nome) continue;

        const tag = document.createElement("span");
        tag.className = "t20a-po-tag";
        tag.textContent = textoDaEtiqueta(origem);
        // Dentro do nome, como segunda linha: não disputa espaço com as colunas.
        nome.append(tag);
    }

    if (!actor.isOwner) return;
    // Ao lado do título do primeiro cabeçalho de Poderes (na ficha em abas há
    // vários); os controles do sistema têm largura fixa e não comportam mais um.
    const titulo = root.querySelector('li.item-header .item-create[data-type="poder"]')
        ?.closest("li.item-header")?.querySelector(".item-name");
    if (!titulo || titulo.querySelector(".t20a-po-abrir")) return;

    const rotulo = game.i18n.localize("T20A.OrigemPoderes.Botao");
    const botao = document.createElement("a");
    botao.className = "t20a-po-abrir";
    botao.innerHTML = '<i class="fa-solid fa-timeline" inert></i>';
    botao.dataset.tooltip = rotulo;
    botao.setAttribute("aria-label", rotulo);
    botao.setAttribute("role", "button");
    botao.tabIndex = 0;
    const abrir = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const janela = root.closest(".window-app") ?? root;
        abrirOrganizador(actor, janela);
    };
    botao.addEventListener("click", abrir);
    botao.addEventListener("keydown", ev => {
        if (ev.key === "Enter" || ev.key === " ") abrir(ev);
    });
    titulo.append(botao);
}

/* -------------------------------------------------------------------------- */
/*  Tela de organização                                                        */
/* -------------------------------------------------------------------------- */

function escapar(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML.replaceAll('"', "&quot;");
}

function subtituloDoItem(item) {
    if (item.type === "magia") {
        return game.i18n.format("T20A.OrigemPoderes.Magia", { circulo: item.system?.circulo ?? "?" });
    }
    return item.labels?.tipo ?? game.i18n.localize("TYPES.Item.poder");
}

export async function abrirOrganizador(actor, janela) {
    const itens = actor.items.filter(i => TIPOS_ANOTAVEIS.has(i.type));
    if (!itens.length) {
        ui.notifications.info(game.i18n.localize("T20A.OrigemPoderes.Vazio"));
        return;
    }

    const linhas = itens.map(item => {
        const salvo = origemDoItem(item);
        const sugerido = salvo ? null : sugestaoDoItem(item);
        return { item, salvo, valor: salvo ?? sugerido ?? { categoria: "", nivel: null }, sugerido: !!sugerido };
    });

    // Agrupa por nível (sem nível por último); dentro do grupo, pela ordem das
    // categorias de fábrica, depois as criadas pelo jogador, depois o nome.
    const ordemCategoria = c => {
        const i = CATEGORIAS.indexOf(c);
        return i >= 0 ? i : (c ? CATEGORIAS.length : CATEGORIAS.length + 1);
    };
    linhas.sort((a, b) =>
        (a.valor.nivel ?? Infinity) - (b.valor.nivel ?? Infinity)
        || ordemCategoria(a.valor.categoria) - ordemCategoria(b.valor.categoria)
        || COLLATOR.compare(a.item.name, b.item.name)
    );
    const grupos = new Map();
    for (const linha of linhas) {
        const chave = linha.valor.nivel ?? 0;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(linha);
    }

    // Sugestões do campo: as de fábrica e as que o jogador já criou na ficha.
    const criadas = new Set();
    for (const item of actor.items) {
        const c = TIPOS_ANOTAVEIS.has(item.type) ? origemDoItem(item)?.categoria : null;
        if (c && !CATEGORIAS.includes(c)) criadas.add(c);
    }
    const idLista = `t20a-po-categorias-${actor.id ?? "ator"}`;
    const opcoes = [...CATEGORIAS.map(rotuloCategoria), ...[...criadas].sort(COLLATOR.compare)]
        .map(c => `<option value="${escapar(c)}"></option>`).join("");

    const i18n = k => game.i18n.localize(`T20A.OrigemPoderes.${k}`);
    const linhaHTML = ({ item, valor, sugerido }) => `
        <li class="t20a-po-linha" data-item-id="${item.id}">
            <img src="${escapar(item.img)}" alt="" loading="lazy">
            <span class="t20a-po-nome">
                <span>${escapar(item.name)}</span>
                <small>${escapar(subtituloDoItem(item))}</small>
            </span>
            <input type="text" name="categoria.${item.id}" list="${idLista}"
                   value="${escapar(valor.categoria ? rotuloCategoria(valor.categoria) : "")}"
                   placeholder="${escapar(i18n("Categoria"))}" maxlength="${MAX_CATEGORIA}"
                   autocomplete="off" spellcheck="false"
                   aria-label="${escapar(`${i18n("Categoria")}: ${item.name}`)}"
                   ${sugerido ? 'class="is-sugerido"' : ""}>
            <input type="number" name="nivel.${item.id}" min="1" max="20" step="1"
                   value="${valor.nivel ?? ""}" placeholder="—" inputmode="numeric"
                   aria-label="${escapar(`${i18n("Nivel")}: ${item.name}`)}"
                   ${sugerido ? 'class="is-sugerido"' : ""}>
        </li>`;
    const grupoHTML = ([nivel, itensDoGrupo]) => `
        <section class="t20a-po-grupo">
            <h4>${escapar(nivel ? game.i18n.format("T20A.OrigemPoderes.NivelN", { nivel }) : i18n("SemNivel"))}
                <span>${itensDoGrupo.length}</span></h4>
            <ul>${itensDoGrupo.map(linhaHTML).join("")}</ul>
        </section>`;

    const nivelPersonagem = Number(actor.system?.attributes?.nivel?.value) || null;
    const content = `
        <div class="t20a-po">
            <p class="t20a-po-intro">${escapar(i18n("Intro"))}
                ${linhas.some(l => l.sugerido) ? `<em>${escapar(i18n("Sugestao"))}</em>` : ""}</p>
            <div class="t20a-po-linha t20a-po-colunas" aria-hidden="true">
                <span></span>
                <span>${nivelPersonagem ? escapar(game.i18n.format("T20A.OrigemPoderes.NivelPersonagem", { nivel: nivelPersonagem })) : ""}</span>
                <span>${escapar(i18n("Categoria"))}</span>
                <span>${escapar(i18n("Nivel"))}</span>
            </div>
            <div class="t20a-po-lista">${[...grupos].map(grupoHTML).join("")}</div>
            <datalist id="${idLista}">${opcoes}</datalist>
        </div>`;

    const acento = janela ? getComputedStyle(janela).getPropertyValue("--t20a-cor-destaque").trim() : "";

    const resultado = await foundry.applications.api.DialogV2.prompt({
        window: {
            title: game.i18n.format("T20A.OrigemPoderes.Titulo", { nome: actor.name }),
            icon: "fa-solid fa-timeline"
        },
        position: { width: 620 },
        classes: ["t20a-po-dialog"],
        content,
        render: (_event, dialog) => {
            const el = dialog.element;
            if (acento) el.style.setProperty("--t20a-po-acento", acento);
            el.addEventListener("input", ev => {
                const campo = ev.target;
                if (!(campo instanceof HTMLInputElement)) return;
                const linha = campo.closest(".t20a-po-linha");
                // Mexeu na linha: a sugestão vira escolha do jogador.
                linha?.querySelectorAll(".is-sugerido").forEach(i => i.classList.remove("is-sugerido"));
                if (campo.type !== "text") return;
                // Origem e complicação vêm na criação: preenche o nível 1 se vazio.
                const nivel = linha?.querySelector('input[type="number"]');
                if (nivel && !nivel.value && CATEGORIAS_DE_CRIACAO.has(categoriaDoTexto(campo.value))) {
                    nivel.value = "1";
                }
            });
        },
        ok: {
            label: game.i18n.localize("T20A.Confirm"),
            icon: "fa-solid fa-check",
            callback: (_event, button) => {
                const campos = button.form.elements;
                return linhas.map(({ item }) => ({
                    item,
                    categoria: categoriaDoTexto(campos[`categoria.${item.id}`]?.value),
                    nivel: nivelValido(campos[`nivel.${item.id}`]?.value)
                }));
            }
        },
        rejectClose: false,
        modal: false
    });
    if (!Array.isArray(resultado)) return;

    const salvoPorId = new Map(linhas.map(l => [l.item.id, l.salvo]));
    const updates = [];
    for (const { item, categoria, nivel } of resultado) {
        const salvo = salvoPorId.get(item.id);
        const igual = (salvo?.categoria ?? "") === categoria && (salvo?.nivel ?? null) === nivel;
        if (igual && !item.getFlag(MODULE_ID, FLAG_NIVEL_LEGADO)) continue;
        updates.push({
            _id: item.id,
            [`flags.${MODULE_ID}.${FLAG_ORIGEM}`]: (categoria || nivel) ? { categoria, nivel } : null,
            // O formato antigo sai de cena: a anotação nova é a única fonte.
            [`flags.${MODULE_ID}.${FLAG_NIVEL_LEGADO}`]: null
        });
    }
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

/* -------------------------------------------------------------------------- */
/*  Selo legado                                                                */
/*  Um selo compacto ANTES do ícone de cada poder mostra o nível anotado       */
/*  ("1".."20" ou "B"). Clique: +1 · clique direito: −1 · passa por Bônus.     */
/* -------------------------------------------------------------------------- */

function nivelDoSelo(item) {
    return origemDoItem(item)?.nivel ?? "bonus";
}

/** Ajuste em andamento por poder: cliques rápidos esperam o anterior gravar,
 *  senão todos leriam a mesma flag antiga e contariam como um só. */
const _ajustesDeNivel = new Map();
/** Poder cujo selo foi usado pelo teclado: devolve o foco após o re-render. */
let _seloComFoco = null;

function ajustarNivelDoSelo(item, delta) {
    const anterior = _ajustesDeNivel.get(item.uuid) ?? Promise.resolve();
    const proximo = anterior.then(() => {
        const max = Number(item.parent?.system?.attributes?.nivel?.value) || 20;
        const atual = nivelDoSelo(item);
        let novo;
        if (delta > 0) novo = (atual === "bonus") ? 1 : (atual >= max ? "bonus" : atual + 1);
        else novo = (atual === "bonus") ? max : (atual <= 1 ? "bonus" : atual - 1);
        // Mantém a categoria anotada no organizador; o selo só conhece o nível.
        const categoriaAtual = origemDoItem(item)?.categoria;
        const valor = (novo === "bonus")
            ? { categoria: "bonus", nivel: null }
            : { categoria: (categoriaAtual && categoriaAtual !== "bonus") ? categoriaAtual : "nivel", nivel: novo };
        return item.update({
            [`flags.${MODULE_ID}.${FLAG_ORIGEM}`]: valor,
            [`flags.${MODULE_ID}.${FLAG_NIVEL_LEGADO}`]: null
        });
    }).catch(err => console.error(`${MODULE_ID} | falha ao ajustar nível do poder:`, err))
      .finally(() => {
          if (_ajustesDeNivel.get(item.uuid) === proximo) _ajustesDeNivel.delete(item.uuid);
      });
    _ajustesDeNivel.set(item.uuid, proximo);
}

function marcarSelosLegados(actor, root) {
    for (const li of linhasDeItens(root)) {
        if (li.querySelector(".t20a-pn-badge")) continue;
        const item = actor.items.get(li.dataset.itemId);
        if (item?.type !== "poder") continue;

        const nivel = nivelDoSelo(item);
        const bonus = nivel === "bonus";
        const badge = document.createElement("a");
        badge.className = `t20a-pn-badge${bonus ? " t20a-pn-bonus" : ""}`;
        badge.textContent = bonus ? "B" : String(nivel);
        const estado = bonus
            ? game.i18n.localize("T20A.PoderNivel.Bonus")
            : game.i18n.format("T20A.PoderNivel.Nivel", { nivel });
        badge.dataset.tooltip = `${estado} — ${game.i18n.localize("T20A.PoderNivel.Uso")}`;
        badge.setAttribute("role", "button");
        badge.setAttribute("aria-label", `${item.name}: ${estado}`);
        badge.tabIndex = 0;

        const ajustar = (ev, delta) => {
            ev.preventDefault();
            ev.stopPropagation();
            ajustarNivelDoSelo(item, delta);
        };
        badge.addEventListener("click", ev => ajustar(ev, +1));
        badge.addEventListener("contextmenu", ev => ajustar(ev, -1));
        badge.addEventListener("keydown", ev => {
            const delta = { Enter: +1, " ": +1, ArrowUp: +1, ArrowRight: +1,
                            ArrowDown: -1, ArrowLeft: -1 }[ev.key];
            if (!delta) return;
            _seloComFoco = item.uuid;
            ajustar(ev, delta);
        });

        // Antes do ícone do poder; sem ícone, no início da linha
        const nome = li.querySelector(".item-name") ?? li;
        const img = nome.querySelector(".item-image");
        if (img) img.before(badge);
        else nome.prepend(badge);

        // A ficha foi redesenhada pelo ajuste feito no teclado: o foco volta
        // ao selo em vez de cair no início do documento.
        if (_seloComFoco === item.uuid) {
            _seloComFoco = null;
            badge.focus({ preventScroll: true });
        }
    }
}
