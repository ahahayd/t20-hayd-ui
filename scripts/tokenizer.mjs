/**
 * Integração com o Tokenizer (vtta-tokenizer).
 *
 * O Tokenizer liga o clique no retrato só nas fichas que existem quando ele
 * inicia; as fichas Hayd são registradas depois, então ligamos aqui, com as
 * mesmas regras dele (configuração de clique no avatar e Shift invertendo).
 */
const TOKENIZER = "vtta-tokenizer";
const FICHAS = ["FichaHaydPersonagem", "FichaHaydAmeaca", "FichaHaydMestre"];
const ALVO = "[data-hf-acao='imagem'], [data-edit='img']";

function cliqueDesligado() {
    try {
        const global = game.settings.get(TOKENIZER, "disable-avatar-click");
        const usuario = game.settings.get(TOKENIZER, "disable-avatar-click-user");
        return usuario === "global" ? global : usuario === "default";
    } catch {
        return false;
    }
}

function ligar(app, html) {
    const api = game.modules.get(TOKENIZER);
    if (!api?.active || !game.user.can("FILES_UPLOAD")) return;
    if (app.isEditable === false) return;
    const raiz = html instanceof HTMLElement ? html : html?.[0];
    for (const el of raiz?.querySelectorAll(ALVO) ?? []) {
        if (el.dataset.hfTokenizer) continue;
        el.dataset.hfTokenizer = "1";
        el.addEventListener("click", (ev) => {
            // Os botões do retrato (ver arte, alternar) seguem com a função deles
            if (ev.target.closest("button")) return;
            const abrir = cliqueDesligado() ? ev.shiftKey : !ev.shiftKey;
            if (!abrir) return;
            const tokenizer = api.api ?? globalThis.Tokenizer;
            if (!tokenizer) return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            const actor = app.actor ?? app.document;
            if (app.token && tokenizer.tokenizeSceneToken) tokenizer.tokenizeSceneToken(app);
            else tokenizer.tokenizeActor(actor);
        }, true);
    }
}

export function registrarTokenizer() {
    for (const nome of FICHAS) Hooks.on(`render${nome}`, ligar);
}
