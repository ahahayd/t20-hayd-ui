/**
 * t20-hayd-ui | chat-contraste.mjs
 * Garante que o texto das mensagens de chat seja legível sobre o fundo que o
 * tema escolheu para elas (pergaminho claro ou fundo escuro).
 *
 * O HTML de dentro da mensagem vem de todo lado — sistema, outros módulos,
 * macros, tabelas — e cada um supõe um fundo. Duas camadas cobrem isso:
 *
 * 1. `aplicarTomDaMensagem` põe na mensagem as classes de tema do Foundry
 *    (`themed theme-light` / `themed theme-dark`). O core marca a lista
 *    inteira do chat como clara; sem isso, tudo que usa as variáveis de cor
 *    do core (--color-text-primary, links de conteúdo…) saía escuro sobre o
 *    fundo escuro das mensagens de NPC.
 * 2. `agendarCorrecaoContrasteChat` mede, no frame seguinte ao render, cada
 *    trecho de texto contra o fundo efetivo. O que fica abaixo do mínimo
 *    WCAG AA (4.5:1; 3:1 em texto grande) é escurecido ou clareado na
 *    própria matiz só até alcançar o mínimo — o verde continua verde, o
 *    vermelho continua vermelho. O que já é legível não é tocado.
 */

/** Cor média das texturas de fundo das mensagens (assets/fundos), medida nos
 *  pixels e puxada um pouco para o meio para cobrir as manchas da textura. */
export const FUNDO_MENSAGEM = {
    claro: [236, 234, 226],   // background-light.webp: média 243,242,235
    escuro: [52, 47, 43]      // background-dark4.webp: média 43,38,35
};

const CLASSE_CORRIGIDO = "t20a-chat-legivel";
const VAR_COR = "--t20a-chat-cor-legivel";
const PRETO = [0, 0, 0];
const BRANCO = [255, 255, 255];

/** Elementos cujo texto o tema já colore de propósito (botões na cor de
 *  destaque) ou que não são texto. */
const IGNORAR = "script, style, button, input, select, option, textarea, canvas, svg";

/** Frames de espera por uma mensagem renderizada que ainda não entrou no DOM. */
const MAX_ESPERA = 30;

/** Marca a mensagem com o tema claro/escuro do Foundry correspondente ao fundo. */
export function aplicarTomDaMensagem(root, claro) {
    root.classList.add("themed");
    root.classList.toggle("theme-light", claro);
    root.classList.toggle("theme-dark", !claro);
}

/* -------------------------------------------------------------------------- */
/*  Agendamento                                                                */
/* -------------------------------------------------------------------------- */

const pendentes = new Map(); // root → frames esperados
let quadro = 0;

/**
 * Corrige o contraste da mensagem no próximo frame, quando o HTML dela já foi
 * montado por todos os hooks. Mensagens renderizadas no mesmo frame (a carga
 * do log, por exemplo) são processadas juntas: todas as medições antes de
 * qualquer escrita, para o navegador recalcular os estilos uma vez só.
 */
export function agendarCorrecaoContrasteChat(root) {
    pendentes.set(root, 0);
    quadro ||= requestAnimationFrame(processarPendentes);
}

function processarPendentes() {
    quadro = 0;
    const prontas = [];
    for (const [root, espera] of pendentes) {
        if (root.isConnected) {
            prontas.push(root);
            pendentes.delete(root);
        } else if (espera >= MAX_ESPERA) {
            pendentes.delete(root);
        } else {
            pendentes.set(root, espera + 1);
        }
    }
    if (pendentes.size) quadro = requestAnimationFrame(processarPendentes);

    for (const root of prontas) limparCorrecoes(root);
    const correcoes = prontas.flatMap(medirMensagem);
    for (const { el, cor } of correcoes) {
        el.style.setProperty(VAR_COR, `rgb(${cor.join(" ")})`);
        el.classList.add(CLASSE_CORRIGIDO);
    }
}

function limparCorrecoes(root) {
    for (const el of root.querySelectorAll(`.${CLASSE_CORRIGIDO}`)) {
        el.classList.remove(CLASSE_CORRIGIDO);
        el.style.removeProperty(VAR_COR);
    }
}

/* -------------------------------------------------------------------------- */
/*  Medição                                                                    */
/* -------------------------------------------------------------------------- */

/** Lista os trechos de texto ilegíveis da mensagem e a cor que os corrige. */
function medirMensagem(root) {
    const conteudo = root.querySelector(".message-content");
    if (!conteudo) return [];
    const base = root.classList.contains("t20a-chat-player")
        ? FUNDO_MENSAGEM.claro
        : FUNDO_MENSAGEM.escuro;

    // Fundo e opacidade acumulados de cada elemento, a partir do conteúdo
    // (transparente sobre a textura). Memorizado: irmãos dividem os ancestrais.
    const camadas = new Map();
    const camadaDe = (el) => {
        let camada = camadas.get(el);
        if (camada) return camada;
        const pai = el === conteudo ? { fundo: base, opacidade: 1 } : camadaDe(el.parentElement);
        const estilo = getComputedStyle(el);
        const bg = corCSSParaRGBA(estilo.backgroundColor);
        camada = {
            estilo,
            fundo: bg && bg[3] > 0 ? comporRGBA(bg, pai.fundo) : pai.fundo,
            opacidade: pai.opacidade * Number(estilo.opacity)
        };
        camadas.set(el, camada);
        return camada;
    };

    const correcoes = [];
    for (const el of [conteudo, ...conteudo.querySelectorAll("*")]) {
        if (!possuiTextoDireto(el) || el.closest(IGNORAR)) continue;
        // Elementos recolhidos (display: none) também são medidos: o estilo
        // computado existe e eles podem ser expandidos depois.
        const { estilo, fundo, opacidade } = camadaDe(el);
        if (!(opacidade > 0) || estilo.visibility === "hidden") continue;
        const cor = corCSSParaRGBA(estilo.color);
        if (!cor) continue;

        const minimo = contrasteMinimo(estilo);
        const visivel = comporRGBA([cor[0], cor[1], cor[2], cor[3] * opacidade], fundo);
        if (razaoContrasteRGB(visivel, fundo) >= minimo) continue;
        correcoes.push({ el, cor: corLegivel(cor, opacidade, fundo, minimo) });
    }
    return correcoes;
}

function possuiTextoDireto(el) {
    for (const no of el.childNodes) {
        if (no.nodeType === Node.TEXT_NODE && no.textContent.trim()) return true;
    }
    return false;
}

/** WCAG: texto grande (24px, ou 18.66px em negrito) precisa de 3:1; o resto, 4.5:1. */
export function contrasteMinimo({ fontSize, fontWeight }) {
    const px = parseFloat(fontSize) || 0;
    const negrito = (parseInt(fontWeight, 10) || 400) >= 700;
    return px >= 24 || (negrito && px >= 18.66) ? 3 : 4.5;
}

/* -------------------------------------------------------------------------- */
/*  Cor                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Cor sólida na matiz de `cor`, misturada com preto ou branco (o que contrasta
 * mais com o fundo) só o necessário para alcançar `minimo` depois de aplicada
 * a `opacidade` herdada. Se nem o extremo alcança, devolve o extremo.
 */
export function corLegivel(cor, opacidade, fundo, minimo) {
    const alvo = razaoContrasteRGB(PRETO, fundo) >= razaoContrasteRGB(BRANCO, fundo) ? PRETO : BRANCO;
    const arredondar = alvo === PRETO ? Math.floor : Math.ceil; // sempre na direção do alvo
    const misturar = (t) => [0, 1, 2].map(i => arredondar(cor[i] + (alvo[i] - cor[i]) * t));
    const alcanca = (t) => razaoContrasteRGB(comporRGBA([...misturar(t), opacidade], fundo), fundo) >= minimo;

    if (!alcanca(1)) return [...alvo];
    let fraco = 0;
    let forte = 1;
    for (let i = 0; i < 12; i++) {
        const meio = (fraco + forte) / 2;
        if (alcanca(meio)) forte = meio;
        else fraco = meio;
    }
    return misturar(forte);
}

let contextoCor = null;

/**
 * Converte a cor computada em [r, g, b, a]. `rgb()` e `color(srgb …)` (o que
 * `color-mix` devolve) são lidos direto; outras notações (oklab, lab…) passam
 * por um canvas de 1px.
 */
export function corCSSParaRGBA(cor) {
    if (typeof cor !== "string") return null;
    const rgb = cor.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/i);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alfa(rgb[4], rgb[5])];

    const srgb = cor.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+)(%)?)?\s*\)$/i);
    if (srgb) return [srgb[1], srgb[2], srgb[3]].map(c => limitar(Number(c) * 255, 0, 255))
        .concat(alfa(srgb[4], srgb[5]));

    if (typeof document === "undefined") return null;
    contextoCor ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!contextoCor) return null;
    contextoCor.clearRect(0, 0, 1, 1);
    contextoCor.fillStyle = "rgba(0, 0, 0, 0)";
    contextoCor.fillStyle = cor;
    contextoCor.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = contextoCor.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
}

function alfa(valor, porcento) {
    return valor === undefined ? 1 : limitar(Number(valor) / (porcento ? 100 : 1), 0, 1);
}

function limitar(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/** Cor com alfa `frente[3]` pintada sobre o `fundo` opaco. */
export function comporRGBA(frente, fundo) {
    const a = frente[3] ?? 1;
    return [0, 1, 2].map(i => frente[i] * a + fundo[i] * (1 - a));
}

/** Razão de contraste WCAG 2 entre duas cores opacas. */
export function razaoContrasteRGB(a, b) {
    const l1 = luminancia(a);
    const l2 = luminancia(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function luminancia(rgb) {
    const [r, g, b] = rgb.map(c => {
        const canal = c / 255;
        return canal <= 0.04045 ? canal / 12.92 : Math.pow((canal + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
