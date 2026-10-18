import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    FUNDO_MENSAGEM,
    contrasteMinimo,
    corLegivel,
    corCSSParaRGBA,
    comporRGBA,
    razaoContrasteRGB
} from "../scripts/chat-contraste.mjs";

const raiz = new URL("../", import.meta.url);
const { claro, escuro } = FUNDO_MENSAGEM;

/** Contraste visível de uma cor sólida com opacidade sobre um fundo. */
const contraste = (cor, opacidade, fundo) => razaoContrasteRGB(comporRGBA([...cor, opacidade], fundo), fundo);

test("razão de contraste WCAG: preto/branco é 21:1 e cor igual é 1:1", () => {
    assert.equal(razaoContrasteRGB([0, 0, 0], [255, 255, 255]), 21);
    assert.equal(razaoContrasteRGB([120, 80, 40], [120, 80, 40]), 1);
});

test("texto claro do tema escuro sobre o pergaminho é escurecido até 4.5:1", () => {
    const original = [232, 228, 220]; // #e8e4dc, o texto do cartão de Domínios
    const cor = corLegivel(original, 1, claro, 4.5);
    assert.ok(contraste(cor, 1, claro) >= 4.5);
    assert.ok(cor.every((c, i) => c < original[i]));
});

test("texto escuro sobre o fundo escuro é clareado até 4.5:1", () => {
    const original = [34, 34, 34];
    const cor = corLegivel(original, 1, escuro, 4.5);
    assert.ok(contraste(cor, 1, escuro) >= 4.5);
    assert.ok(cor.every((c, i) => c > original[i]));
});

test("a correção preserva a matiz: verde continua verde, vermelho continua vermelho", () => {
    const verde = corLegivel([111, 191, 115], 1, claro, 4.5);   // #6fbf73
    assert.ok(verde[1] > verde[0] && verde[1] > verde[2]);
    const vermelho = corLegivel([180, 40, 30], 1, escuro, 4.5);
    assert.ok(vermelho[0] > vermelho[1] && vermelho[0] > vermelho[2]);
});

test("a correção é mínima: para logo acima do alvo, sem virar preto/branco", () => {
    const cor = corLegivel([111, 191, 115], 1, claro, 4.5);
    assert.ok(contraste(cor, 1, claro) < 5);
    assert.notDeepEqual(cor, [0, 0, 0]);
});

test("a opacidade herdada entra na conta da correção", () => {
    const cor = corLegivel([122, 86, 0], 0.8, claro, 4.5);
    assert.ok(contraste(cor, 0.8, claro) >= 4.5);
});

test("sem como alcançar o mínimo (opacidade baixa), usa o extremo", () => {
    assert.deepEqual(corLegivel([122, 86, 0], 0.3, claro, 4.5), [0, 0, 0]);
    assert.deepEqual(corLegivel([60, 60, 60], 0.3, escuro, 4.5), [255, 255, 255]);
});

test("texto grande (24px, ou 18.66px em negrito) pede 3:1; o resto, 4.5:1", () => {
    assert.equal(contrasteMinimo({ fontSize: "24px", fontWeight: "400" }), 3);
    assert.equal(contrasteMinimo({ fontSize: "19px", fontWeight: "700" }), 3);
    assert.equal(contrasteMinimo({ fontSize: "19px", fontWeight: "400" }), 4.5);
    assert.equal(contrasteMinimo({ fontSize: "16px", fontWeight: "700" }), 4.5);
});

test("lê rgb(), rgba() e color(srgb …) do estilo computado", () => {
    assert.deepEqual(corCSSParaRGBA("rgb(24, 25, 43)"), [24, 25, 43, 1]);
    assert.deepEqual(corCSSParaRGBA("rgba(0, 0, 0, 0.5)"), [0, 0, 0, 0.5]);
    assert.deepEqual(corCSSParaRGBA("color(srgb 1 0 0.5 / 0.25)"), [255, 0, 127.5, 0.25]);
    assert.deepEqual(corCSSParaRGBA("color(srgb 0.2 0.4 0.6)").slice(3), [1]);
});

test("toda mensagem tematizada recebe o tom do Foundry e passa pelo corretor", async () => {
    const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
    const chat = main.slice(main.indexOf("function aplicarTemaChatMsg"), main.indexOf("/**\n * Força tamanho mínimo"));
    assert.match(chat, /aplicarTomDaMensagem\(root, fundoClaro\)/);
    // Os dois tons: o corretor antigo só rodava nas mensagens escuras.
    assert.match(chat, /\n {4}agendarCorrecaoContrasteChat\(root\);/);
    assert.doesNotMatch(chat, /if \(!fundoClaro\) agendarCorrecaoContrasteChat/);
});

test("a classe do corretor aplica a cor calculada por cima das cores inline", async () => {
    const css = await readFile(new URL("styles/theme.css", raiz), "utf8");
    assert.match(css, /\.t20a-chat-msg \.t20a-chat-legivel \{\s*color: var\(--t20a-chat-cor-legivel\) !important;/);
});
