/**
 * t20-hayd-ui | chat-cartoes.mjs
 * Cartões de chat estruturados por tipo (ataque, magia, poder, consumível,
 * item) e a cor de destaque do jogador numa forma sempre legível.
 *
 * Só reorganiza o DOM já renderizado: o conteúdo gravado na mensagem não muda,
 * as classes do sistema (.chat-card, .item-card, .roll, .chat-spend-mana,
 * .chat-apply-ae…) continuam nos mesmos elementos e os botões continuam sendo
 * os do sistema — gmtools, itens e loja seguem achando o que procuram.
 */

import { FUNDO_MENSAGEM, corLegivel, razaoContrasteRGB } from "./chat-contraste.mjs";

const TIPOS = {
    arma: "ataque",
    magia: "magia",
    poder: "poder",
    consumivel: "consumivel"
};

const ICONES = {
    ataque: "fa-solid fa-sword",
    magia: "fa-solid fa-wand-sparkles",
    poder: "fa-solid fa-star",
    consumivel: "fa-solid fa-flask",
    item: "fa-solid fa-box-open"
};

/** Descrições acima disso (em caracteres de texto) mostram só o início primeiro. */
const LIMITE_DESCRICAO = 280;

/** Descrições que o usuário abriu/fechou: sobrevive a re-renders da mensagem. */
const estadoDescricao = new Map(); // messageId → "oculta" | "inicio" | "toda"

/* -------------------------------------------------------------------------- */
/*  Cor de destaque legível                                                    */
/* -------------------------------------------------------------------------- */

function hexParaRGB(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
}

const css = (rgb) => `rgb(${rgb.map(Math.round).join(" ")})`;

/**
 * Variações da cor do jogador para uma mensagem com fundo claro ou escuro.
 *  - `texto`: a própria matiz ajustada até 4.5:1 sobre o fundo (texto, bordas
 *    de botão, títulos). É o que vai em --t20a-chat-cor, que gmtools e loja
 *    já usam como cor de texto dentro dos cartões deles.
 *  - `marca`: até 3:1 (WCAG para elementos gráficos): faixa lateral e filetes.
 *  - `sobre`: preto ou branco para texto em cima de um preenchimento `texto`.
 */
export function variacoesDaCor(hex, claro) {
    const rgb = hexParaRGB(hex) ?? [150, 5, 5];
    const fundo = claro ? FUNDO_MENSAGEM.claro : FUNDO_MENSAGEM.escuro;
    // A cor que já alcança o mínimo fica intacta.
    const ajustar = (minimo) => razaoContrasteRGB(rgb, fundo) >= minimo ? rgb : corLegivel(rgb, 1, fundo, minimo);
    const texto = ajustar(4.5);
    const marca = ajustar(3);
    // No fundo claro a cor de texto é escura (texto branco por cima); no
    // escuro ela é clara (texto escuro por cima).
    const sobre = claro ? "#ffffff" : "#15151a";
    return { original: css(rgb), texto: css(texto), marca: css(marca), sobre };
}

/* -------------------------------------------------------------------------- */
/*  Estrutura do cartão                                                        */
/* -------------------------------------------------------------------------- */

function tipoDoCartao(card, actor) {
    const item = card.dataset.itemId ? actor?.items?.get(card.dataset.itemId) : null;
    if (item) return TIPOS[item.type] ?? "item";
    if (card.querySelector(".chat-spend-mana")) return "magia";
    if (card.querySelector(".roll--dano")) return "ataque";
    return "item";
}

function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
}

/** Rótulo do tipo, com o círculo/escola da magia quando o sistema os deu. */
function montarEtiqueta(card, tipo) {
    const etiqueta = el("span", "t20a-cartao-tipo");
    etiqueta.append(el("i", ICONES[tipo]));
    let texto = game.i18n.localize(`T20A.Chat.Tipo.${tipo}`);
    const sub = card.querySelector(":scope > .card-item-header > h4");
    const detalhe = sub?.textContent.replace(/\s+/g, " ").trim();
    if (detalhe) {
        texto = detalhe;
        sub.classList.add("t20a-oculto");
    }
    etiqueta.append(el("span", null, texto));
    return etiqueta;
}

/**
 * "<b>Execução:</b> padrão; <b>Alcance:</b> curto;" → grade de pares.
 * O parágrafo original fica escondido (não removido).
 */
function montarFicha(card) {
    const p = card.querySelector(":scope > .card-item-header > p");
    const rotulos = p ? [...p.querySelectorAll(":scope > b")] : [];
    if (!rotulos.length) return;
    const dl = el("dl", "t20a-cartao-ficha");
    for (const b of rotulos) {
        let valor = "";
        for (let no = b.nextSibling; no && no.nodeName !== "B"; no = no.nextSibling) {
            valor += no.textContent;
        }
        valor = valor.replace(/;\s*$/, "").trim();
        if (!valor) continue;
        const par = el("div", "t20a-cartao-ficha-par");
        par.append(el("dt", null, b.textContent.replace(/:\s*$/, "").trim()), el("dd", null, valor));
        dl.append(par);
    }
    if (!dl.children.length) return;
    p.classList.add("t20a-oculto");
    p.after(dl);
}

/** Junta cada título (.row) com sua rolagem (.roll) num bloco, lado a lado. */
function agruparRolagens(card) {
    const rolagens = [...card.querySelectorAll(":scope > .roll")];
    if (!rolagens.length) return;
    // Título de cada rolagem: o .row anterior com o mesmo texto do
    // data-roll-title. Outros módulos inserem coisas entre os dois (o botão
    // Manobra do gmtools, por exemplo); elas vão junto para o bloco, na mesma
    // ordem. Tudo lido antes de mexer no DOM.
    const grupos = rolagens.map(roll => {
        const nome = (roll.dataset.rollTitle ?? "").trim();
        const meio = [];
        for (let s = roll.previousElementSibling; s && !s.matches(".roll"); s = s.previousElementSibling) {
            if (s.matches(".row") && s.textContent.trim() === nome) return { titulo: s, meio: meio.reverse() };
            meio.push(s);
        }
        const anterior = roll.previousElementSibling;
        return { titulo: anterior?.matches(".row") ? anterior : null, meio: [] };
    });
    const grade = el("div", "t20a-cartao-rolagens");
    (grupos[0].titulo ?? rolagens[0]).before(grade);
    for (const [i, roll] of rolagens.entries()) {
        const { titulo, meio } = grupos[i];
        const bloco = el("div", "t20a-rolagem");
        bloco.classList.add(roll.classList.contains("roll--dano") ? "t20a-rolagem--dano" : "t20a-rolagem--teste");
        if (roll.querySelector(".dice-total.critical") || roll.classList.contains("critico")) bloco.classList.add("t20a-rolagem--critico");
        if (roll.querySelector(".dice-total.fumble") || roll.classList.contains("falha")) bloco.classList.add("t20a-rolagem--falha");
        if (titulo) {
            titulo.classList.add("t20a-rolagem-titulo");
            bloco.append(titulo);
        }
        bloco.append(...meio, roll);
        grade.append(bloco);
    }
}

/** O que clicar dentro da descrição já faz algo por conta própria. */
const INTERATIVOS_DESCRICAO = "a, button, input, select, textarea, .inline-roll, .content-link, [data-action]";

/**
 * Descrição em três estados, sem botão extra:
 *   oculta → (clique no nome) → início → (clique na descrição) → toda
 *   início/toda → (clique no nome) → oculta
 * Assume o clique no nome que o sistema usa para mostrar/esconder: o ouvinte
 * fica no cabeçalho, na fase de captura, e não deixa o clique chegar ao
 * handler do sistema (que alternaria o display inline por conta própria).
 */
function controlarDescricao(card, message, header) {
    const desc = card.querySelector(":scope > .card-content");
    const nome = header?.querySelector(".item-name");
    if (!desc || !nome || !desc.textContent.trim()) return;
    const longa = desc.textContent.trim().length > LIMITE_DESCRICAO;

    desc.classList.add("t20a-descricao");
    card.classList.add("t20a-cartao--com-descricao");
    const aplicar = (estado) => {
        estadoDescricao.set(message.id, estado);
        desc.classList.toggle("t20a-descricao--oculta", estado === "oculta");
        desc.classList.toggle("t20a-recolhida", estado === "inicio" && longa);
        nome.setAttribute("aria-expanded", String(estado !== "oculta"));
    };
    aplicar(estadoDescricao.get(message.id) ?? "oculta");

    nome.setAttribute("role", "button");
    nome.tabIndex = 0;
    const alternarNome = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        aplicar(estadoDescricao.get(message.id) === "oculta" ? "inicio" : "oculta");
    };
    header.addEventListener("click", (ev) => {
        if (ev.target.closest(".item-name") === nome) alternarNome(ev);
    }, { capture: true });
    nome.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") alternarNome(ev); });

    desc.addEventListener("click", (ev) => {
        if (estadoDescricao.get(message.id) !== "inicio" || ev.target.closest(INTERATIVOS_DESCRICAO)) return;
        aplicar("toda");
    });
}

/* -------------------------------------------------------------------------- */
/*  Efeitos de uso (encantos, melhorias, aprimoramentos) em uma linha          */
/* -------------------------------------------------------------------------- */

/** Popover aberto no momento (só um por vez). */
let popoverAberto = null;

function fecharPopover() {
    if (!popoverAberto) return;
    popoverAberto.painel.remove();
    popoverAberto.gatilho.setAttribute("aria-expanded", "false");
    if (popoverAberto.quadro) cancelAnimationFrame(popoverAberto.quadro);
    document.removeEventListener("pointerdown", aoClicarFora, true);
    document.removeEventListener("keydown", aoTeclar, true);
    document.removeEventListener("scroll", reposicionar, true);
    window.removeEventListener("resize", reposicionar);
    popoverAberto = null;
}

function aoClicarFora(ev) {
    if (!popoverAberto) return;
    if (popoverAberto.painel.contains(ev.target) || popoverAberto.gatilho.contains(ev.target)) return;
    fecharPopover();
}

function aoTeclar(ev) {
    if (ev.key !== "Escape" || !popoverAberto) return;
    const gatilho = popoverAberto.gatilho;
    fecharPopover();
    gatilho.focus();
}

/** Variáveis e classes de tom que o popover herda da mensagem de origem. */
const VARS_MENSAGEM = ["--t20a-chat-cor", "--t20a-chat-cor-marca", "--t20a-chat-sobre-cor",
    "--t20a-chat-texto", "--t20a-chat-texto-suave"];

function abrirPopover(gatilho, lista, titulo) {
    const mesmo = popoverAberto?.gatilho === gatilho;
    fecharPopover();
    if (mesmo) return;

    const msg = gatilho.closest(".t20a-chat-msg");
    const claro = msg?.classList.contains("t20a-chat-player") ?? true;
    const painel = el("div", `t20a-efeitos-popover themed ${claro ? "theme-light t20a-efeitos-popover--claro" : "theme-dark t20a-efeitos-popover--escuro"}`);
    painel.setAttribute("role", "dialog");
    painel.setAttribute("aria-label", titulo);
    if (msg) {
        const estilo = msg.style;
        for (const v of VARS_MENSAGEM) {
            const valor = estilo.getPropertyValue(v);
            if (valor) painel.style.setProperty(v, valor);
        }
    }
    painel.append(el("div", "t20a-efeitos-popover-titulo", titulo), lista.cloneNode(true));
    document.body.append(painel);

    gatilho.setAttribute("aria-expanded", "true");
    popoverAberto = { painel, gatilho, rolagem: areaDeRolagem(gatilho), quadro: 0 };
    posicionarPopover();
    document.addEventListener("pointerdown", aoClicarFora, true);
    document.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
}

/** Ancestral que rola (o log do chat, ou o de um chat destacado/popout). */
function areaDeRolagem(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const { overflowY } = getComputedStyle(p);
        if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
}

/** Rolagem/redimensionamento: acompanha o gatilho no próximo frame. */
function reposicionar(ev) {
    if (!popoverAberto || popoverAberto.painel.contains(ev?.target)) return;
    popoverAberto.quadro ||= requestAnimationFrame(() => {
        if (!popoverAberto) return;
        popoverAberto.quadro = 0;
        posicionarPopover();
    });
}

/**
 * Cola o popover no gatilho: abaixo dele, ou acima se não couber, sempre
 * dentro da janela. Se a mensagem saiu da área visível do chat (ou foi
 * redesenhada), fecha.
 */
function posicionarPopover() {
    const { painel, gatilho, rolagem } = popoverAberto;
    if (!gatilho.isConnected) return fecharPopover();
    const r = gatilho.getBoundingClientRect();
    const area = rolagem?.isConnected ? rolagem.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };
    if (r.bottom < area.top || r.top > area.bottom) return fecharPopover();

    const largura = Math.min(300, window.innerWidth - 16);
    painel.style.width = `${largura}px`;
    painel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))}px`;
    const altura = painel.offsetHeight;
    const cabeEmbaixo = r.bottom + 6 + altura <= window.innerHeight - 8;
    painel.style.top = `${cabeEmbaixo ? r.bottom + 6 : Math.max(8, r.top - 6 - altura)}px`;
}

/** Custo em PM de uma linha ("+2 PM:", "-1 PM (2x):"; o sistema já multiplica). */
function custoDaLinha(li) {
    const m = li.querySelector("b")?.textContent.match(/([+-]?\d+)\s*PM/);
    return m ? Number(m[1]) : 0;
}

/**
 * Nomes dos encantos, melhorias e materiais instalados no próprio item: os
 * efeitos que o t20-hayd-itens cria nele (flag do módulo) e as melhorias do
 * sistema (flags.tormenta20.upgrade). Poderes do ator (Ataque Furtivo,
 * Estilo de Uma Arma…) não entram: continuam listados no cartão.
 */
function nomesDeMelhorias(item) {
    const nomes = new Set();
    for (const ef of item?.effects ?? []) {
        if (!ef.flags?.["t20-hayd-itens"] && !ef.flags?.tormenta20?.upgrade) continue;
        const nome = String(ef.name ?? "").trim();
        if (!nome) continue;
        nomes.add(nome);
        // v13: "Encanto — detalhe"; v14: "Tipo: Encanto (detalhe)"
        nomes.add(nome.split(" — ")[0].trim());
        const v14 = /^[^:]+:\s*(.+?)(?:\s*\(.*\))?$/.exec(nome);
        if (v14) nomes.add(v14[1].trim());
        if (item.name) nomes.add(`${item.name} - ${nome}`);
    }
    nomes.delete("");
    return [...nomes];
}

/** A linha do cartão descreve um desses efeitos? Compara o texto após o custo. */
function ehMelhoria(li, nomes) {
    const custo = li.querySelector(".row > b:first-child")?.textContent ?? "";
    const texto = li.textContent.replace(/\s+/g, " ").trim().slice(custo.replace(/\s+/g, " ").trim().length).trim();
    return nomes.some(n => texto === n || texto.startsWith(`${n}:`) || texto.startsWith(`${n} `) || texto.startsWith(`${n} -`));
}

/**
 * Tira da lista de efeitos de uso os encantos e melhorias do próprio item e
 * os resume em "X PM: **Encantos e melhorias** de Espada Larga"; o negrito
 * abre um popover com eles. O resto (poderes, habilidades) segue listado.
 * As linhas resumidas ficam no cartão, só escondidas.
 */
function resumirEfeitosDeUso(card, message, item, nomeItem) {
    const bloco = card.querySelector(":scope > .card-upgrades");
    const lista = bloco?.querySelector(":scope > ul");
    const nomes = nomesDeMelhorias(item);
    if (!lista || !nomes.length) return;
    const itens = [...lista.children].filter(li => ehMelhoria(li, nomes));
    if (!itens.length) return;

    const total = itens.reduce((soma, li) => soma + custoDaLinha(li), 0);
    const rotulo = game.i18n.localize("T20A.Chat.EncantosMelhorias");
    const listaPopover = el("ul");
    for (const li of itens) listaPopover.append(li.cloneNode(true));

    const linha = el("div", "t20a-efeitos-resumo");
    linha.append(el("span", "t20a-efeitos-custo", `${total} PM:`), " ");
    const gatilho = el("a", "t20a-efeitos-gatilho");
    gatilho.setAttribute("role", "button");
    gatilho.setAttribute("aria-haspopup", "dialog");
    gatilho.setAttribute("aria-expanded", "false");
    gatilho.tabIndex = 0;
    gatilho.append(el("strong", null, rotulo), el("span", "t20a-efeitos-qtd", `(${itens.length})`));
    linha.append(gatilho);
    if (nomeItem) linha.append(" ", game.i18n.format("T20A.Chat.EfeitosDeUsoDe", { item: nomeItem }));

    const titulo = nomeItem ? `${rotulo} — ${nomeItem}` : rotulo;
    const abrir = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        abrirPopover(gatilho, listaPopover, titulo);
    };
    gatilho.addEventListener("click", abrir);
    gatilho.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") abrir(ev); });

    for (const li of itens) li.classList.add("t20a-oculto");
    if (itens.length === lista.children.length) bloco.classList.add("t20a-oculto");
    bloco.before(linha);
}

/* -------------------------------------------------------------------------- */
/*  Magias: Aprimoramentos x Outros bônus                                      */
/* -------------------------------------------------------------------------- */

/** Texto comparável: sem custo na frente ("2 PM:", "Truque:"), minúsculo. */
function normalizarEfeito(texto) {
    return String(texto ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^([+-]?\d+\s*PM(\s*\(\d+x\))?|truque)\s*:\s*/i, "")
        .replace(/[\s.;:]+$/, "")
        .toLowerCase();
}

/** Texto da linha do cartão sem o custo em negrito. */
function textoDaLinha(li) {
    const custo = li.querySelector(".row > b:first-child")?.textContent.replace(/\s+/g, " ").trim() ?? "";
    return li.textContent.replace(/\s+/g, " ").trim().slice(custo.length).trim();
}

function grupoDeEfeitos(classe, rotulo, lista) {
    const grupo = el("div", `t20a-efeitos-grupo ${classe}`);
    grupo.append(el("div", "t20a-efeitos-grupo-titulo", rotulo), lista);
    return grupo;
}

/**
 * Separa os efeitos de uso de uma magia em "Aprimoramentos" (os efeitos que
 * moram no próprio item da magia) e "Outros bônus" (poderes, itens e
 * habilidades do ator), nessa ordem. As linhas continuam sendo os mesmos <li>
 * dentro de .card-upgrades ul — só mudam de lista.
 */
function separarAprimoramentos(card, item) {
    const bloco = card.querySelector(":scope > .card-upgrades");
    const lista = bloco?.querySelector(":scope > ul");
    if (!lista?.children.length || !item?.effects) return;
    const proprios = [...item.effects].map(ef => normalizarEfeito(ef.name)).filter(Boolean);
    const ehDaMagia = (li) => {
        const t = normalizarEfeito(textoDaLinha(li));
        return !!t && proprios.some(n => t === n || t.startsWith(n) || n.startsWith(t));
    };
    const aprimoramentos = [...lista.children].filter(ehDaMagia);
    const outros = [...lista.children].filter(li => !aprimoramentos.includes(li));

    const listaOutros = el("ul");
    listaOutros.append(...outros);
    // A lista original fica com os aprimoramentos (quem procura
    // `.card-upgrades ul li` continua achando todas as linhas).
    // Marcador no lugar da lista: montar o grupo tira a lista do DOM antes.
    const lugar = document.createComment("");
    lista.replaceWith(lugar);
    if (aprimoramentos.length) {
        lugar.replaceWith(grupoDeEfeitos("t20a-efeitos-grupo--aprimoramentos",
            game.i18n.localize("T20A.Chat.Aprimoramentos"), lista));
    } else {
        lugar.remove();
    }
    if (outros.length) {
        bloco.append(grupoDeEfeitos("t20a-efeitos-grupo--outros",
            game.i18n.localize("T20A.Chat.OutrosBonus"), listaOutros));
    }
}

/* -------------------------------------------------------------------------- */
/*  Efeitos sem custo primeiro, sem o "0 PM"                                   */
/* -------------------------------------------------------------------------- */

/** A linha não custa PM ("0 PM:" ou custo vazio)? "Truque:" não conta. */
function semCusto(li) {
    const b = li.querySelector(".row > b:first-child");
    if (!b) return false;
    const t = b.textContent.replace(/\s+/g, " ").trim();
    return t === "" || /^[+-]?0\s*PM\b/i.test(t);
}

/**
 * Em cada lista de efeitos de uso, os que não custam PM sobem para o topo
 * (na ordem em que vieram) e perdem o "0 PM:" na frente. As linhas são os
 * mesmos <li>, só mudam de posição.
 */
function ordenarSemCusto(card) {
    const bloco = card.querySelector(":scope > .card-upgrades");
    if (!bloco) return;
    for (const ul of bloco.querySelectorAll("ul")) {
        const gratis = [...ul.children].filter(li => li.tagName === "LI" && semCusto(li));
        for (const li of gratis) li.classList.add("t20a-sem-custo");
        ul.prepend(...gratis);
    }
}

/* -------------------------------------------------------------------------- */
/*  Listas longas: só os primeiros efeitos à vista                             */
/* -------------------------------------------------------------------------- */

/** Quantos efeitos de uso ficam à vista antes do "Mostrar mais". */
export const LIMITE_EFEITOS = 5;

/** Mensagens cuja lista o usuário expandiu: sobrevive a re-renders. */
const efeitosExpandidos = new Set(); // messageId

/**
 * Deixa à vista só os primeiros LIMITE_EFEITOS efeitos de uso (contados na
 * ordem do cartão, depois do resumo de encantos e da separação das magias) e
 * põe "Mostrar mais N" no fim da lista. As linhas excedentes ficam no DOM,
 * só escondidas; um grupo (Aprimoramentos/Outros bônus) sem nenhuma linha à
 * vista some junto com o título.
 */
function limitarEfeitos(card, message) {
    const bloco = card.querySelector(":scope > .card-upgrades");
    if (!bloco || bloco.classList.contains("t20a-oculto")) return;
    const linhas = [...bloco.querySelectorAll("li")].filter(li => !li.classList.contains("t20a-oculto"));
    const excedentes = linhas.slice(LIMITE_EFEITOS);
    if (!excedentes.length) return;

    const grupos = [...bloco.querySelectorAll(".t20a-efeitos-grupo")];
    const alternar = el("a", "t20a-efeitos-mais");
    alternar.setAttribute("role", "button");
    alternar.tabIndex = 0;
    const aplicar = (aberto) => {
        if (aberto) efeitosExpandidos.add(message.id);
        else efeitosExpandidos.delete(message.id);
        for (const li of excedentes) li.classList.toggle("t20a-excedente", !aberto);
        for (const g of grupos) {
            const algumaVisivel = [...g.querySelectorAll("li")].some(li =>
                !li.classList.contains("t20a-oculto") && !li.classList.contains("t20a-excedente"));
            g.classList.toggle("t20a-excedente", !algumaVisivel);
        }
        alternar.setAttribute("aria-expanded", String(aberto));
        alternar.replaceChildren(
            el("i", aberto ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down"),
            el("span", null, aberto
                ? game.i18n.localize("T20A.Chat.MostrarMenos")
                : game.i18n.format("T20A.Chat.MostrarMais", { n: excedentes.length }))
        );
    };
    const trocar = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        aplicar(!efeitosExpandidos.has(message.id));
    };
    alternar.addEventListener("click", trocar);
    alternar.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") trocar(ev); });
    bloco.append(alternar);
    aplicar(efeitosExpandidos.has(message.id));
}

/**
 * Organiza os efeitos de uso do cartão, nos dois estilos do chat (novo e
 * legado): magias separam Aprimoramentos e Outros bônus; os demais itens
 * resumem os encantos e melhorias numa linha; listas longas mostram só o
 * começo. Idempotente.
 */
export function organizarEfeitosDeUso(message, root, actor) {
    for (const card of root.querySelectorAll(".message-content .chat-card.item-card")) {
        if (card.dataset.t20aEfeitos) continue;
        card.dataset.t20aEfeitos = "1";
        const item = card.dataset.itemId ? actor?.items?.get(card.dataset.itemId) : null;
        if (item?.type === "magia") {
            separarAprimoramentos(card, item);
        } else {
            const nome = card.querySelector(":scope > header .item-name > div") ?? card.querySelector(":scope > header .item-name");
            resumirEfeitosDeUso(card, message, item, nome?.textContent.replace(/\s+/g, " ").trim() ?? "");
        }
        ordenarSemCusto(card);
        limitarEfeitos(card, message);
    }
}

/**
 * Estrutura o cartão de item/ataque/magia da mensagem. Idempotente: um cartão
 * já marcado não é tocado de novo.
 */
export function estruturarCartoes(message, root, actor) {
    for (const card of root.querySelectorAll(".message-content .chat-card.item-card")) {
        if (card.classList.contains("t20a-cartao")) continue;
        const tipo = tipoDoCartao(card, actor);
        card.classList.add("t20a-cartao", `t20a-cartao--${tipo}`);
        card.dataset.t20aTipo = tipo;

        const header = card.querySelector(":scope > header");
        const nome = header?.querySelector(".item-name");
        if (nome) nome.append(montarEtiqueta(card, tipo));
        montarFicha(card);
        agruparRolagens(card);
        controlarDescricao(card, message, header);
    }

    // Testes avulsos (perícia, atributo, iniciativa): marca crítico/falha.
    for (const roll of root.querySelectorAll(".message-content > .dice-roll")) {
        roll.classList.add("t20a-teste-avulso");
    }
}
