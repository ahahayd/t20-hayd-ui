import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const chat = main.slice(
    main.indexOf("function aplicarTemaChatMsg"),
    main.indexOf("/**\n * Força tamanho mínimo")
);

test("speakerActor resolve também o ator sintético do token", () => {
    assert.match(chat, /const actor = message\.speakerActor/);
    assert.doesNotMatch(chat, /game\.actors\?\.get\(speakerId\)/);
});

test("mensagem enviada por jogador sempre usa o fundo claro", () => {
    assert.match(chat, /\(!!autor && !autor\.isGM\) \|\| donosJogadores\.length > 0/);
    assert.match(chat,
        /classList\.toggle\("t20a-chat-player", fundoClaro\)/);
    assert.match(chat, /: ehMensagemDeJogador;/);
});

test("ator pertencente a jogador usa fundo claro mesmo quando o Mestre rola", () => {
    assert.match(chat, /const donosJogadores = actor \? listarDonosJogadores\(actor\) : \[\]/);
    assert.match(chat, /\|\| donosJogadores\.length > 0/);
    assert.match(chat,
        /classList\.toggle\("t20a-chat-npc", !fundoClaro\)/);
});

test("opção de fundo pode forçar todas as mensagens claras ou escuras", () => {
    assert.match(main, /register\(MODULE_ID, "chatFundo"/);
    assert.match(chat, /game\.settings\.get\(MODULE_ID, "chatFundo"\)/);
    assert.match(chat, /fundo === "claro" \? true/);
    assert.match(chat, /fundo === "escuro" \? false/);
});

test("moedas da Loja ganham contraste no fundo claro", async () => {
    const css = await readFile(new URL("styles/theme.css", raiz), "utf8");
    for (const moeda of ["tl", "to", "tp", "tc"])
        assert.match(css, new RegExp(`\\.t20a-chat-player \\.t20l-coin\\.t20l-${moeda} \\{`));
});

test("a lista de donos é calculada uma vez e reaproveitada para a cor", () => {
    assert.equal((chat.match(/listarDonosJogadores\(actor\)/g) ?? []).length, 1);
    assert.match(chat, /for \(const dono of donosJogadores\)/);
});

test("chat usa só o hook atual do v13, sem os campos depreciados", () => {
    assert.doesNotMatch(main, /Hooks\.on\("renderChatMessage",/);
    assert.match(main, /Hooks\.on\("renderChatMessageHTML"[\s\S]{0,300}aplicarTemaChatMsg\(message, root\)/);
    assert.doesNotMatch(main, /message\.user\b/);
    assert.doesNotMatch(main, /instanceof jQuery/);
});

test("mudança de cor/dono do ator atualiza as fichas de item abertas dele", () => {
    const hook = main.slice(main.indexOf('Hooks.on("updateActor"'), main.indexOf("function reRenderTormentaSheets"));
    assert.doesNotMatch(hook, /actor\.sheet/);
    assert.match(hook, /doc\.parent === actor/);
});
