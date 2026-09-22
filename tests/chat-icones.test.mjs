import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const trecho = main.slice(
    main.indexOf("function arteDoEfeito"),
    main.indexOf("function aplicarTemaDialog")
);

test("a correção roda no hook de chat atual do v13, não só no legado", () => {
    assert.match(main, /Hooks\.on\("renderChatMessageHTML", \(message, html\)/);
    assert.match(main, /corrigirIconesDeEfeito\(message, root\)/);
});

test("aceita os dois nomes de campo: img (v13) e icon (legado)", () => {
    assert.match(trecho, /alvo\?\.img \|\| alvo\?\.icon/);
    // O efeito pode vir como lista (o template do sistema também trata os dois)
    assert.match(trecho, /Array\.isArray\(dados\) \? dados\[0\] : dados/);
});

test("a arte sai dos dados guardados na própria mensagem, pelo índice do botão", () => {
    assert.match(trecho, /message\.flags\?\.tormenta20\?\.effects/);
    assert.match(trecho, /efeitos\[Number\(botao\.dataset\.effectIndex\)\]/);
});

test("imagem que já tem src não é tocada", () => {
    assert.match(trecho, /if \(!img \|\| img\.getAttribute\("src"\)\) continue;/);
});

test("sem arte conhecida, o quadrado quebrado é removido em vez de mantido", () => {
    assert.match(trecho, /else img\.remove\(\);/);
});

test("o nome da condição serve de último recurso", () => {
    assert.match(trecho, /arteDaCondicao\(botao\.textContent\)/);
    assert.match(trecho, /game\.tormenta20\?\.conditions/);
});
