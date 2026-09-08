/**
 * Tormenta20 – Arcano
 * Tema dark moderno para as fichas do sistema Tormenta20.
 * A cor de destaque é herdada automaticamente do dono da ficha,
 * com opção do jogador escolher dono específico ou cor personalizada.
 */

const MODULE_ID = "t20-hayd-ui";
const SYSTEM_ID = "tormenta20";
const FLAG_COR = "configCor";
const LOGO_PATH = `modules/${MODULE_ID}/assets/logo-tormenta20.webp`;
const COR_PADRAO = "#960505"; // vermelho-sangue arcano (default)

/** Classe de janela por tema visual e cor clara de fallback usada no sweep de contraste. */
const TEMAS = {
    darkNeon: { classe: "t20a", corTexto: "#eceaf2" },
    darkMode: { classe: "t20a-dm", corTexto: "#efe6d8" }
};
const TEMA_PADRAO = "darkMode";

/* -------------------------------------------------------------------------- */
/*  Init / Settings                                                            */
/* -------------------------------------------------------------------------- */

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "enabled", {
        name: "T20A.Settings.EnabledName",
        hint: "T20A.Settings.EnabledHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => location.reload()
    });

    game.settings.register(MODULE_ID, "estiloInterface", {
        name: "T20A.Settings.EstiloInterfaceName",
        hint: "T20A.Settings.EstiloInterfaceHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => location.reload()
    });

    game.settings.register(MODULE_ID, "tema", {
        name: "T20A.Settings.TemaName",
        hint: "T20A.Settings.TemaHint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            darkMode: "T20A.Settings.TemaDarkMode",
            darkNeon: "T20A.Settings.TemaDarkNeon"
        },
        default: TEMA_PADRAO,
        onChange: () => location.reload()
    });

    game.settings.register(MODULE_ID, "corPadrao", {
        name: "T20A.Settings.CorPadraoName",
        hint: "T20A.Settings.CorPadraoHint",
        scope: "world",
        config: true,
        type: String,
        default: COR_PADRAO,
        onChange: () => reRenderTormentaSheets()
    });

    game.settings.register(MODULE_ID, "mostrarLogo", {
        name: "T20A.Settings.MostrarLogoName",
        hint: "T20A.Settings.MostrarLogoHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => reRenderTormentaSheets()
    });

    game.settings.register(MODULE_ID, "poderesPorNivel", {
        name: "T20A.Settings.PoderesPorNivelName",
        hint: "T20A.Settings.PoderesPorNivelHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: () => reRenderTormentaSheets()
    });

    game.settings.register(MODULE_ID, "chatRetrato", {
        name: "T20A.Settings.ChatRetratoName",
        hint: "T20A.Settings.ChatRetratoHint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            personagem: "T20A.Settings.ChatRetratoPersonagem",
            token: "T20A.Settings.ChatRetratoToken"
        },
        default: "personagem",
        onChange: () => ui.chat?.render(true)
    });

    game.settings.register(MODULE_ID, "chatRetratoSemAtor", {
        name: "T20A.Settings.ChatRetratoSemAtorName",
        hint: "T20A.Settings.ChatRetratoSemAtorHint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            nada: "T20A.Settings.ChatRetratoSemAtorNada",
            avatar: "T20A.Settings.ChatRetratoSemAtorAvatar"
        },
        default: "nada",
        onChange: () => ui.chat?.render(true)
    });
});

/* -------------------------------------------------------------------------- */
/*  Context menu: posição fixa (popover) nas fichas com tema                   */
/*  O core injeta o #context-menu dentro da linha do item, e o overflow da    */
/*  ficha corta o menu quando ele desce além do limite da janela. O modo      */
/*  "fixed" do core (popover no document.body) nunca é cortado e já decide    */
/*  sozinho se abre para cima ou para baixo conforme o espaço na tela.        */
/* -------------------------------------------------------------------------- */

/**
 * Estilização da interface (fichas + janelas de uso) ativa?
 * Independente do chat: o tema do chat só depende de "enabled".
 */
function estiloInterfaceAtivo() {
    if (game.system.id !== SYSTEM_ID) return false;
    if (!game.settings.get(MODULE_ID, "enabled")) return false;
    try { return game.settings.get(MODULE_ID, "estiloInterface"); }
    catch (_) { return true; }
}

/** Chave do tema visual escolhido pelo usuário ("darkNeon" | "darkMode"). */
function temaAtual() {
    try {
        const t = game.settings.get(MODULE_ID, "tema");
        return TEMAS[t] ? t : TEMA_PADRAO;
    } catch (_) { return TEMA_PADRAO; }
}

/** Todas as classes de tema conhecidas — usado para limpar antes de reaplicar. */
const TODAS_CLASSES_TEMA = Object.values(TEMAS).map(t => t.classe);

/**
 * Aplica a classe do tema atualmente selecionado num elemento de janela
 * (ficha ou diálogo), removendo qualquer classe de OUTRO tema.
 *
 * Nunca remove a classe do tema atual: quase todo o CSS do tema é descendente
 * dela, então tirar e recolocar invalidaria o estilo computado da subárvore
 * inteira da ficha — e a ficha (AppV1) re-renderiza a cada update do ator.
 * `remove` de classe ausente e `add` de classe presente são no-ops, então no
 * caminho normal (tema já aplicado) esta função não suja estilo nenhum.
 */
function aplicarClasseTema(el) {
    if (!el) return;
    const alvo = TEMAS[temaAtual()].classe;
    for (const classe of TODAS_CLASSES_TEMA) {
        if (classe !== alvo) el.classList.remove(classe);
    }
    el.classList.add("t20a-any", alvo);
}

/** Liga/desliga o gate CSS do tema de interface (bloco de diálogos do sistema). */
function aplicarClasseCorpo() {
    const ativo = estiloInterfaceAtivo();
    const tema = temaAtual();
    document.body?.classList.toggle("t20a-ui", ativo);
    document.body?.classList.toggle("t20a-theme-darkneon", ativo && tema === "darkNeon");
    document.body?.classList.toggle("t20a-theme-darkmode", ativo && tema === "darkMode");
}

Hooks.once("setup", () => {
    aplicarClasseCorpo();

    const CM = foundry.applications?.ux?.ContextMenu?.implementation
        ?? foundry.applications?.ux?.ContextMenu
        ?? globalThis.ContextMenu;
    if (!CM?.prototype?._setPosition || !CM.prototype._setFixedPosition) return;

    const original = CM.prototype._setPosition;
    CM.prototype._setPosition = function(menu, target, options = {}) {
        try {
            const janelaTema = target?.closest?.(".t20a-any");
            if (estiloInterfaceAtivo() && janelaTema) {
                // O popover será movido para o body e deixará de herdar as
                // variáveis da ficha. Copia o acento da janela que o abriu.
                const corDestaque = getComputedStyle(janelaTema)
                    .getPropertyValue("--t20a-cor-destaque")
                    .trim();
                if (corDestaque) menu.style.setProperty("--t20a-context-accent", corDestaque);
                else menu.style.removeProperty("--t20a-context-accent");
                return this._setFixedPosition(menu, target, options);
            }
        } catch (err) {
            console.warn(`${MODULE_ID} | context menu fixo falhou, usando posição padrão:`, err);
        }
        return original.call(this, menu, target, options);
    };
});

/* -------------------------------------------------------------------------- */
/*  Render hooks                                                               */
/* -------------------------------------------------------------------------- */

Hooks.on("renderActorSheet",  (app, html) => aplicarTema(app, html));
Hooks.on("renderItemSheet",   (app, html) => aplicarTema(app, html));
Hooks.on("renderChatMessage", (message, html) => aplicarTemaChatMsg(message, html));
Hooks.on("renderApplication", (app, html) => aplicarTemaDialog(app, html));

function aplicarTemaDialog(_app, html) {
    if (!estiloInterfaceAtivo()) return;

    const root = html instanceof jQuery ? html[0] : html;
    if (!root) return;

    const windowEl = root.closest?.(".window-app") ?? root;
    if (!windowEl.classList?.contains("tormenta20")) return;
    if (!windowEl.classList?.contains("dialog")) return;

    // Classe do tema selecionado — as regras de CSS do bloco de diálogos
    // exigem essa classe diretamente na janela (dá acesso às variáveis do
    // tema e serve de gate: sem ela, o CSS do módulo não toca a janela).
    aplicarClasseTema(windowEl);

    // Cor do usuário atual (sem depender de um ator específico)
    const cor = corCSSDoUsuario(game.user) ?? corPadraoConfigurada();
    if (windowEl.style.getPropertyValue("--t20a-cor-destaque") !== cor) {
        windowEl.style.setProperty("--t20a-cor-destaque", cor);
    }

    // Força texto claro via inline style — sobrepõe o theme-light que o Foundry
    // aplica em janelas AppV1, sem depender da cascata de CSS do sistema.
    // Varre todo o conteúdo e clareia qualquer elemento de texto (menos ícones).
    const COR = TEMAS[temaAtual()].corTexto;
    const conteudo = windowEl.querySelector(".window-content") ?? windowEl;
    const IGNORAR = new Set(["I", "SVG", "PATH", "IMG", "HR", "BUTTON"]);
    conteudo.querySelectorAll("*").forEach(el => {
        if (IGNORAR.has(el.tagName)) return;
        if (el.classList.contains("fa") || /\bfa-/.test(el.className)) return;
        if (el.style.color) return; // já clareado num render anterior
        el.style.setProperty("color", COR, "important");
    });
}

function aplicarTema(app, html) {
    if (game.system.id !== SYSTEM_ID) return;
    if (!game.settings.get(MODULE_ID, "enabled")) return;

    const root = (html instanceof jQuery ? html[0] : html);
    if (!root) return;

    const doc = documentoDoApp(app);

    // Tema visual das fichas: só quando a estilização de interface está ativa.
    if (estiloInterfaceAtivo()) {
        const windowApp = root.closest?.(".window-app") ?? root;
        aplicarClasseTema(windowApp);
        const ehFichaJogador = doc?.documentName === "Actor" && doc.type === "character";
        windowApp.classList.toggle("t20a-player-sheet", ehFichaJogador);

        let cor;
        try {
            cor = resolverCorDeDestaque(app);
        } catch (err) {
            console.warn(`${MODULE_ID} | falha ao resolver cor:`, err);
            cor = corPadraoConfigurada();
        }
        /* Só escreve se mudou: --t20a-cor-destaque é herdada e alimenta as
         * variações derivadas (color-mix) usadas em toda a ficha, então
         * reescrevê-la invalida o estilo computado da subárvore inteira —
         * caro num render que acontece a cada update do ator. */
        if (windowApp.style.getPropertyValue("--t20a-cor-destaque") !== cor) {
            windowApp.style.setProperty("--t20a-cor-destaque", cor);
        }

        // Mede somente o espaço ocupado pela navbar sobreposta ao header.
        if (ehFichaJogador) {
            medirNavbarDaFicha(windowApp, root);
        }

        // Forçar tamanho mínimo apenas no primeiro render de fichas de personagem jogador
        if (ehFichaJogador) {
            forcarTamanhoMinimo(app);
        }

        // Logo: apenas para fichas de personagem jogador, se habilitado
        if (ehFichaJogador && game.settings.get(MODULE_ID, "mostrarLogo")) {
            injetarLogo(windowApp, root);
        }
    }

    // Selo de nível obtido nos poderes: opção independente, funciona mesmo sem o tema.
    if (doc?.documentName === "Actor" && doc.type === "character"
        && game.settings.get(MODULE_ID, "poderesPorNivel")) {
        try { marcarPoderesComNivel(doc, root); }
        catch (err) { console.warn(`${MODULE_ID} | falha ao marcar nível dos poderes:`, err); }
    }
}

/* -------------------------------------------------------------------------- */
/*  Nível obtido dos poderes                                                   */
/*  Um selo compacto ANTES do ícone de cada poder mostra em que nível ele foi  */
/*  obtido ("1".."20" ou "B" de Bônus). A ordenação da lista continua livre —  */
/*  o jogador organiza como quiser e ainda rastreia quando pegou cada poder.   */
/*  Clique no selo: +1 nível · clique direito: −1 · passa por Bônus no ciclo.  */
/*  A classificação fica em flags.t20-hayd-ui.nivelObtido no próprio poder.    */
/* -------------------------------------------------------------------------- */

const FLAG_NIVEL_PODER = "nivelObtido";

function nivelDoPoder(item) {
    const n = Number(item.getFlag(MODULE_ID, FLAG_NIVEL_PODER));
    return (Number.isInteger(n) && n >= 1) ? n : "bonus";
}

async function ajustarNivelDoPoder(item, delta) {
    const max = Number(item.parent?.system?.attributes?.nivel?.value) || 20;
    const atual = nivelDoPoder(item);
    let novo;
    if (delta > 0) novo = (atual === "bonus") ? 1 : (atual >= max ? "bonus" : atual + 1);
    else novo = (atual === "bonus") ? max : (atual <= 1 ? "bonus" : atual - 1);
    await item.setFlag(MODULE_ID, FLAG_NIVEL_PODER, novo);
}

function marcarPoderesComNivel(actor, root) {
    for (const li of root.querySelectorAll("li.item[data-item-id]")) {
        if (li.classList.contains("item-header")) continue;
        if (li.closest(".list-favorites, .favorites")) continue;
        if (li.querySelector(".t20a-pn-badge")) continue;
        const item = actor.items.get(li.dataset.itemId);
        if (item?.type !== "poder") continue;

        const nivel = nivelDoPoder(item);
        const bonus = nivel === "bonus";
        const badge = document.createElement("a");
        badge.className = `t20a-pn-badge${bonus ? " t20a-pn-bonus" : ""}`;
        badge.textContent = bonus ? "B" : String(nivel);
        badge.dataset.tooltip = `${bonus ? "Obtido como Bônus (fora de nível)" : `Obtido no nível ${nivel}`} — clique: +1 · clique direito: −1`;

        badge.addEventListener("click", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            ajustarNivelDoPoder(item, +1);
        });
        badge.addEventListener("contextmenu", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            ajustarNivelDoPoder(item, -1);
        });

        // Antes do ícone do poder; sem ícone, no início da linha
        const nome = li.querySelector(".item-name") ?? li;
        const img = nome.querySelector(".item-image");
        if (img) img.before(badge);
        else nome.prepend(badge);
    }
}

/**
 * Resolve a imagem do retrato de uma mensagem de chat conforme as opções do
 * usuário: arte do personagem (ficha) ou do token falante; sem ator, o avatar
 * do jogador remetente ou nada.
 */
function resolverRetratoChat(message, actor, autor) {
    if (actor) {
        let src = actor.img;
        if (game.settings.get(MODULE_ID, "chatRetrato") === "token") {
            const { scene: cenaId, token: tokenId } = message.speaker ?? {};
            const token = (cenaId && tokenId)
                ? game.scenes?.get(cenaId)?.tokens?.get(tokenId)
                : null;
            const arteToken = token?.texture?.src ?? actor.prototypeToken?.texture?.src;
            // Texturas curinga (caminhos com *) não são resolvíveis aqui
            if (arteToken && !arteToken.includes("*")) src = arteToken;
        }
        return src ? { src, alt: actor.name ?? "" } : null;
    }
    if (game.settings.get(MODULE_ID, "chatRetratoSemAtor") === "avatar" && autor?.avatar) {
        return { src: autor.avatar, alt: autor.name ?? "" };
    }
    return null;
}

function aplicarTemaChatMsg(message, html) {
    if (game.system.id !== SYSTEM_ID) return;
    if (!game.settings.get(MODULE_ID, "enabled")) return;

    const root = html instanceof jQuery ? html[0] : html;
    if (!root) return;

    // `speakerActor` resolve também atores sintéticos de tokens. Consultar só
    // `game.actors.get(speaker.actor)` perde mensagens cujo speaker veio pela
    // cena/token e fazia um jogador cair no visual escuro por falta de ator.
    const actor = message.speakerActor
        ?? ChatMessage.getSpeakerActor?.(message.speaker ?? {})
        ?? null;

    // Usuário que enviou (v13: message.author; v12: message.user)
    const autorId = message.author?.id ?? message.user?.id;
    const autor   = autorId ? (game.users?.get(autorId) ?? null) : null;

    // A lista já era necessária para resolver a cor. Guardá-la evita repetir
    // testUserPermission para decidir o fundo da mensagem.
    const donosJogadores = actor ? listarDonosJogadores(actor) : [];

    // Resolve cor de destaque do header
    let cor = null;
    if (actor) {
        const modo = lerModoCor(actor);
        if (modo === "padrao") {
            cor = corPadraoConfigurada();
        } else if (modo === "custom") {
            cor = lerCorPersonalizada(actor);
        } else {
            for (const dono of donosJogadores) {
                const c = corCSSDoUsuario(dono);
                if (c) { cor = c; break; }
            }
        }
    }
    // Sem dono jogador → usa cor do remetente
    if (!cor && autor) cor = corCSSDoUsuario(autor);
    if (!cor) cor = corPadraoConfigurada();

    // Claro quando quem enviou é jogador OU quando o ator pertence a algum
    // jogador (inclusive se o Mestre rolou por ele). Todo o restante — NPCs do
    // Mestre, mensagens do Mestre sem ator e mensagens de sistema — é escuro.
    // Assim uma mensagem de jogador sem speaker nunca mais é confundida com
    // uma mensagem de NPC só porque não havia ator para resolver.
    const ehMensagemDeJogador = (!!autor && !autor.isGM) || donosJogadores.length > 0;

    root.classList.add("t20a-chat-msg");
    root.classList.toggle("t20a-chat-player", ehMensagemDeJogador);
    root.classList.toggle("t20a-chat-npc", !ehMensagemDeJogador);
    root.style.setProperty("--t20a-chat-cor", cor);

    /* Texto do header sempre legível: preto ou branco conforme a
     * luminância da cor de fundo (whispers com cores claras ficavam
     * ilegíveis com o branco fixo). */
    const contraste = textoContrastante(cor);
    root.style.setProperty("--t20a-chat-texto", contraste.texto);
    root.style.setProperty("--t20a-chat-texto-suave", contraste.suave);
    root.style.setProperty("--t20a-chat-sombra", contraste.sombra);

    // Retrato no cabeçalho: arte do personagem ou do token (opção por usuário);
    // sem ator, opcionalmente o avatar do jogador que enviou
    const retrato = resolverRetratoChat(message, actor, autor);
    const header = root.querySelector(".message-header");
    if (header && !header.querySelector(".t20a-chat-avatar") && retrato?.src) {
        const avatarEl = document.createElement("img");
        avatarEl.className = "t20a-chat-avatar";
        avatarEl.alt = retrato.alt;
        avatarEl.src = retrato.src;
        header.insertBefore(avatarEl, header.firstChild);
    }

    // Injeta nome do jogador abaixo do nome do personagem no .message-sender
    const sender = root.querySelector(".message-sender");
    if (sender && !sender.querySelector(".t20a-chat-jogador") && autor?.name) {
        const span = document.createElement("span");
        span.className = "t20a-chat-jogador";
        span.textContent = autor.name;
        sender.appendChild(span);
    }
}

/**
 * Força tamanho mínimo da ficha apenas no primeiro render de cada instância,
 * para o usuário poder redimensionar depois sem ser sobrescrito.
 */
const _fichasDimensionadas = new WeakSet();
const MIN_LARGURA = 920;
const MIN_ALTURA  = 780;

function forcarTamanhoMinimo(app) {
    if (_fichasDimensionadas.has(app)) return;
    _fichasDimensionadas.add(app);

    try {
        const pos = app.position ?? {};
        const novo = {};
        if (!pos.width  || pos.width  < MIN_LARGURA) novo.width  = MIN_LARGURA;
        if (!pos.height || pos.height < MIN_ALTURA)  novo.height = MIN_ALTURA;
        if (Object.keys(novo).length) app.setPosition(novo);
    } catch (err) {
        console.warn(`${MODULE_ID} | falha ao forçar tamanho:`, err);
    }
}

/** Mede a navbar; a arte continua sendo controlada exclusivamente pelo CSS do header. */
function medirNavbarDaFicha(windowApp, root) {
    if (!windowApp || !root) return;

    const tabs = root.querySelector?.(".sheet-tabs");
    if (!tabs) return;

    requestAnimationFrame(() => {
        if (!tabs.isConnected) return;
        const altura = Math.round(tabs.getBoundingClientRect().height);
        if (altura > 0) {
            windowApp.style.setProperty("--t20a-navbar-height", `${altura}px`);
        }
    });
}

/**
 * Injeta o logo como filho direto do .window-app (fora do fluxo flex),
 * posicionado absolutamente para se alinhar com o .sheet-tabs.
 * O logo fica LIFT px acima da barra de abas (efeito 3D).
 * O padding-left do nav é ajustado para reservar o espaço visual do logo.
 */
const LOGO_LIFT = 5;   // px que o logo sobe acima da barra de abas
const LOGO_LEFT = -15; // deve bater com "left" no CSS (.t20a-brand-logo / .t20a-dm .t20a-brand-logo)

function injetarLogo(windowApp, root) {
    if (!windowApp || !root) return;

    const tabs = root.querySelector?.(".sheet-tabs");
    if (!tabs) return;

    /* Reusa o <img> existente: a ficha (AppV1) re-renderiza a CADA update
     * do ator; recriar o elemento custava DOM churn + decode + reflow
     * duplo por render. O nav é recriado, então só reposicionamos. */
    let img = windowApp.querySelector(":scope > .t20a-brand-logo");
    if (!img) {
        img = document.createElement("img");
        img.classList.add("t20a-brand-logo");
        img.src = LOGO_PATH;
        img.alt = "Tormenta 20";
        img.setAttribute("draggable", "false");
        windowApp.appendChild(img);
    }

    const posicionar = () => {
        const appRect  = windowApp.getBoundingClientRect();
        const tabsRect = tabs.getBoundingClientRect();
        if (!tabsRect.height) return; // ainda não renderizado

        const logoHeight = Math.round((tabsRect.height + LOGO_LIFT) * 1.2);
        const top        = tabsRect.top - appRect.top - (logoHeight - tabsRect.height);

        /* Só escreve quando o valor mudou de fato: a ficha re-renderiza a cada
         * update do ator e, na maioria das vezes, a geometria é idêntica —
         * reescrever sujaria o layout de graça em todo render. */
        const novoTop    = `${top}px`;
        const novaAltura = `${logoHeight}px`;
        if (img.style.top    !== novoTop)    img.style.top    = novoTop;
        if (img.style.height !== novaAltura) img.style.height = novaAltura;

        // Reserva no nav exatamente até onde a borda direita do logo cai,
        // medindo as posições reais (não um deslocamento fixo): o nav não
        // começa sempre no mesmo x relativo à janela — na ficha normal o
        // nav é o primeiro filho do form, na de abas vem depois do header,
        // e um valor fixo deixava um vão vazio antes da 1ª aba num dos dois.
        if (img.naturalWidth && img.naturalHeight) {
            const logoWidth = Math.round(img.naturalWidth / img.naturalHeight * logoHeight);
            const logoRight = LOGO_LEFT + logoWidth;          // relativo à borda de windowApp
            const tabsLeft  = tabsRect.left - appRect.left;   // relativo à borda de windowApp
            const novoPad   = `${Math.max(0, logoRight - tabsLeft + 6)}px`;
            if (tabs.style.paddingLeft !== novoPad) tabs.style.paddingLeft = novoPad;
        }
    };

    /* Exatamente UMA execução por render: imagem em cache posiciona no
     * próximo frame; sem cache, espera o load (antes os dois caminhos
     * corriam juntos = dois reflows forçados). */
    if (img.complete) requestAnimationFrame(posicionar);
    else img.addEventListener("load", posicionar, { once: true });
}

/* -------------------------------------------------------------------------- */
/*  Header button (Cor da Ficha)                                               */
/* -------------------------------------------------------------------------- */

Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
    if (game.system.id !== SYSTEM_ID) return;
    if (!game.settings.get(MODULE_ID, "enabled")) return;

    const doc = documentoDoApp(app);
    if (!doc || doc.documentName !== "Actor") return;

    // Só donos e GM podem alterar
    if (!doc.isOwner && !game.user.isGM) return;

    buttons.unshift({
        label: game.i18n.localize("T20A.HeaderButton"),
        class: "t20a-config",
        icon: "fa-solid fa-palette",
        onclick: (ev) => {
            ev?.preventDefault?.();
            abrirDialogoCor(doc);
        }
    });
});

/* -------------------------------------------------------------------------- */
/*  Dialog de configuração de cor (2 modos: auto / padrão)                     */
/* -------------------------------------------------------------------------- */

async function abrirDialogoCor(doc) {
    const modo = lerModoCor(doc);
    const corPadraoAtual = corPadraoConfigurada();
    const corCustomAtual = lerCorPersonalizada(doc) ?? corPadraoAtual;
    const checked = (m) => modo === m ? "checked" : "";
    const ativa = (m) => modo === m ? "is-active" : "";

    const content = `
        <div class="t20a-color-dialog">
            <p class="t20a-dialog-intro">${game.i18n.localize("T20A.Dialog.Intro")}</p>

            <div class="t20a-dialog-mode ${ativa("auto")}">
                <label class="t20a-radio-row">
                    <input type="radio" name="mode" value="auto" ${checked("auto")} />
                    <span class="t20a-radio-label">
                        <strong>${game.i18n.localize("T20A.Dialog.ModeAuto")}</strong>
                        <em>${game.i18n.localize("T20A.Dialog.ModeAutoHint")}</em>
                    </span>
                </label>
            </div>

            <div class="t20a-dialog-mode ${ativa("custom")}">
                <label class="t20a-radio-row">
                    <input type="radio" name="mode" value="custom" ${checked("custom")} />
                    <span class="t20a-radio-label">
                        <strong>${game.i18n.localize("T20A.Dialog.ModeCustom")}</strong>
                        <em>${game.i18n.localize("T20A.Dialog.ModeCustomHint")}</em>
                        <span class="t20a-custom-picker">
                            <input type="color" name="corCustom" value="${corCustomAtual}" />
                            <input type="text" name="corCustomHex" value="${corCustomAtual}"
                                   maxlength="7" pattern="#?[0-9a-fA-F]{6}" spellcheck="false" />
                        </span>
                    </span>
                </label>
            </div>

            <div class="t20a-dialog-mode ${ativa("padrao")}">
                <label class="t20a-radio-row">
                    <input type="radio" name="mode" value="padrao" ${checked("padrao")} />
                    <span class="t20a-radio-label">
                        <strong>${game.i18n.localize("T20A.Dialog.ModePadrao")}</strong>
                        <em>${game.i18n.localize("T20A.Dialog.ModePadraoHint")}
                            <span class="t20a-padrao-chip" style="background:${corPadraoAtual}"></span>
                            <code>${corPadraoAtual}</code>
                        </em>
                    </span>
                </label>
            </div>
        </div>
    `;

    try {
        const result = await foundry.applications.api.DialogV2.prompt({
            window: {
                title: game.i18n.localize("T20A.Dialog.Title"),
                icon: "fa-solid fa-palette"
            },
            position: { width: 460 },
            classes: ["t20a-color-config-dialog"],
            content,
            render: (_event, dialog) => {
                const el = dialog.element;
                const picker = el.querySelector('[name="corCustom"]');
                const hexInput = el.querySelector('[name="corCustomHex"]');
                const radioCustom = el.querySelector('input[name="mode"][value="custom"]');
                // Picker e campo hex andam juntos; mexer neles seleciona o modo
                picker?.addEventListener("input", () => {
                    hexInput.value = picker.value;
                    if (radioCustom) radioCustom.checked = true;
                });
                hexInput?.addEventListener("change", () => {
                    const bruto = hexInput.value.trim();
                    const hex = normalizarHex(bruto.startsWith("#") ? bruto : `#${bruto}`);
                    if (hex) { picker.value = hex; hexInput.value = hex; }
                    else hexInput.value = picker.value;
                    if (radioCustom) radioCustom.checked = true;
                });
            },
            ok: {
                label: game.i18n.localize("T20A.Confirm"),
                icon: "fa-solid fa-check",
                callback: (_event, button) => {
                    const form = button.form;
                    const mode = form?.elements?.mode?.value;
                    if (mode === "custom") {
                        return { mode: "custom", cor: form?.elements?.corCustom?.value };
                    }
                    return { mode: mode === "padrao" ? "padrao" : "auto" };
                }
            },
            rejectClose: false,
            modal: true
        });

        if (result?.mode) {
            await salvarModoCor(doc, result.mode, result.cor ?? null);
        }
    } catch (err) {
        console.warn(`${MODULE_ID} | dialog erro:`, err);
    }
}

/* -------------------------------------------------------------------------- */
/*  Reatividade                                                                */
/* -------------------------------------------------------------------------- */

Hooks.on("updateUser", (_user, changes) => {
    if (!("color" in changes)) return;
    reRenderTormentaSheets();
});

Hooks.on("updateActor", (actor, changes) => {
    if (changes.ownership || changes.permission || changes.flags?.[MODULE_ID]) {
        actor.sheet?.render(false);
    }
});

function reRenderTormentaSheets() {
    if (game.system.id !== SYSTEM_ID) return;

    const v1 = Object.values(ui.windows ?? {});
    for (const app of v1) {
        if (ehFichaTormenta(app)) app.render?.(false);
    }

    const v2 = foundry.applications?.instances;
    if (v2?.forEach) {
        v2.forEach(app => { if (ehFichaTormenta(app)) app.render?.(false); });
    }
}

function ehFichaTormenta(app) {
    if (!app) return false;
    const doc = documentoDoApp(app);
    if (!doc) return false;
    return ["Actor", "Item"].includes(doc.documentName);
}

/* -------------------------------------------------------------------------- */
/*  Resolução da cor de destaque                                               */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a cor de destaque da ficha:
 * - Modo "padrao" → sempre cor padrão configurada no setting world.
 * - Modo "auto"   → Player Color do primeiro dono jogador (não-GM) em ordem
 *                   alfabética que tenha cor definida; senão, cor padrão.
 * - Itens dentro de um ator herdam a cor do ator pai.
 */
function resolverCorDeDestaque(app) {
    const doc = documentoDoApp(app);
    if (!doc) return corPadraoConfigurada();

    const alvo = (doc.documentName === "Item" && doc.parent) ? doc.parent : doc;
    const modo = lerModoCor(alvo);

    if (modo === "padrao") return corPadraoConfigurada();
    if (modo === "custom") return lerCorPersonalizada(alvo) ?? corPadraoConfigurada();

    // Modo auto: tenta cor do primeiro dono jogador
    const donos = listarDonosJogadores(alvo);
    for (const dono of donos) {
        const c = corCSSDoUsuario(dono);
        if (c) return c;
    }

    return corPadraoConfigurada();
}

/**
 * Lê o modo de cor configurado para a ficha.
 * Retorna sempre "auto" ou "padrao". Tem compatibilidade com o formato antigo
 * (objeto com mode "auto"/"user"/"custom" da v1.x).
 */
function lerModoCor(doc) {
    const raw = doc.getFlag?.(MODULE_ID, FLAG_COR);
    if (raw === "padrao" || raw === "auto") return raw;
    if (raw && typeof raw === "object") {
        // Formato novo: { mode: "custom", cor: "#rrggbb" }
        if (raw.mode === "custom" && normalizarHex(raw.cor)) return "custom";
        return "auto";
    }
    return "auto"; // default
}

/** Cor personalizada salva na ficha (modo "custom"), normalizada. */
function lerCorPersonalizada(doc) {
    const raw = doc.getFlag?.(MODULE_ID, FLAG_COR);
    if (raw && typeof raw === "object") return normalizarHex(raw.cor);
    return null;
}

async function salvarModoCor(doc, modo, cor = null) {
    if (modo === "custom") {
        const hex = normalizarHex(cor) ?? corPadraoConfigurada();
        await doc.setFlag(MODULE_ID, FLAG_COR, { mode: "custom", cor: hex });
        return;
    }
    const valido = (modo === "padrao") ? "padrao" : "auto";
    await doc.setFlag(MODULE_ID, FLAG_COR, valido);
}

/* -------------------------------------------------------------------------- */
/*  Contraste (WCAG): texto claro ou escuro conforme o fundo                    */
/* -------------------------------------------------------------------------- */

/**
 * Escolhe preto ou branco para o texto sobre `hexFundo` pela luminância
 * relativa (WCAG). O ponto de equilíbrio exato entre o contraste do texto
 * branco e o do preto é L ≈ 0.179.
 */
function textoContrastante(hexFundo) {
    const hex = normalizarHex(hexFundo);
    if (!hex) return { texto: "#ffffff", suave: "rgba(255,255,255,0.7)", sombra: "0 1px 3px rgba(0,0,0,0.8)" };
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.179
        ? { texto: "#15151a", suave: "rgba(10,10,14,0.72)", sombra: "none" }
        : { texto: "#ffffff", suave: "rgba(255,255,255,0.7)", sombra: "0 1px 3px rgba(0,0,0,0.8)" };
}

const COLLATOR_PTBR = new Intl.Collator("pt-BR");

function listarDonosJogadores(doc) {
    if (!doc) return [];
    const donos = game.users.filter(u => !u.isGM && doc.testUserPermission(u, "OWNER"));
    // Roda a cada mensagem de chat: só ordena quando há empate a decidir
    if (donos.length > 1) donos.sort((a, b) => COLLATOR_PTBR.compare(a.name ?? "", b.name ?? ""));
    return donos;
}

function corCSSDoUsuario(user) {
    if (!user) return null;
    const c = user.color;
    if (c == null) return null;
    if (typeof c === "string") return normalizarHex(c) || c;
    // Foundry v13: user.color é um foundry.utils.Color (extends Number)
    if (typeof c.css === "string") return c.css;
    if (typeof c.toString === "function") {
        const s = c.toString();
        if (typeof s === "string" && s.startsWith("#")) return s;
    }
    return null;
}

function corPadraoConfigurada() {
    try {
        const v = game.settings.get(MODULE_ID, "corPadrao");
        if (typeof v === "string" && v) return normalizarHex(v) || v;
    } catch (_) { /* setting ainda não registrado */ }
    return COR_PADRAO;
}

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                  */
/* -------------------------------------------------------------------------- */

function documentoDoApp(app) {
    return app?.document ?? app?.object ?? null;
}

function normalizarHex(str) {
    if (typeof str !== "string") return null;
    const s = str.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^#[0-9a-f]{3}$/.test(s)) {
        // expande #rgb → #rrggbb
        return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7); // ignora canal alpha
    return null;
}

