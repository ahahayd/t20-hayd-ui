import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = (await readFile(new URL("scripts/main.mjs", raiz), "utf8")).replace(/\r\n/g, "\n");
const chat = main.slice(main.indexOf("function aplicarTemaChatMsg"), main.indexOf("/**\n * Força tamanho mínimo"));

test("cor única do chat: opção do usuário com uma cor para jogadores e outra para o Mestre", () => {
    for (const chave of ["chatCorUnica", "chatCorJogadores", "chatCorMestre"]) {
        const registro = main.slice(main.indexOf(`register(MODULE_ID, "${chave}"`));
        assert.ok(registro.length > 0);
        assert.match(registro.slice(0, registro.indexOf("});")), /scope: "client"/);
    }
    assert.match(main, /chaves: \[[^\]]*"chatCorUnica", "chatCorJogadores", "chatCorMestre"/);
});

test("a cor única vence a do personagem, que vence a da ficha", () => {
    const unica = chat.indexOf('game.settings.get(MODULE_ID, "chatCorUnica")');
    const doChat = chat.indexOf("lerCorDoChat(actor)");
    const daFicha = chat.indexOf("lerModoCor(actor)");
    assert.ok(unica > 0 && unica < doChat && doChat < daFicha);
    // ColorField devolve um Color, não a string
    assert.match(chat, /normalizarHex\(valor\?\.css \?\? String\(valor \?\? ""\)\)/);
});

test("o diálogo da ficha grava a cor do chat separada da cor da ficha", () => {
    assert.match(main, /const FLAG_COR_CHAT = "corChat";/);
    assert.match(main, /name="modoChat" value="custom"/);
    assert.match(main, /hex \? \{ cor: hex \} : "ficha"/);
});

test("o botão Cor da Ficha usa o hook que dispara nas fichas AppV1 do v13", () => {
    assert.match(main, /Hooks\.on\("getActorSheetHeaderButtons"/);
    assert.doesNotMatch(main, /Hooks\.on\("getApplicationHeaderButtons"/);
});

test("mudar opção do chat redesenha as mensagens já exibidas", () => {
    assert.doesNotMatch(main, /onChange: \(\) => ui\.chat\?\.render\(true\)/);
    assert.match(main, /function redesenharChat\(\)[\s\S]{0,300}ui\.chat\?\.updateMessage\?\.\(message\)/);
});
