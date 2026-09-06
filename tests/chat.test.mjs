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
        /classList\.toggle\("t20a-chat-player", ehMensagemDeJogador\)/);
});

test("ator pertencente a jogador usa fundo claro mesmo quando o Mestre rola", () => {
    assert.match(chat, /const donosJogadores = actor \? listarDonosJogadores\(actor\) : \[\]/);
    assert.match(chat, /\|\| donosJogadores\.length > 0/);
    assert.match(chat,
        /classList\.toggle\("t20a-chat-npc", !ehMensagemDeJogador\)/);
});

test("a lista de donos é calculada uma vez e reaproveitada para a cor", () => {
    assert.equal((chat.match(/listarDonosJogadores\(actor\)/g) ?? []).length, 1);
    assert.match(chat, /for \(const dono of donosJogadores\)/);
});
