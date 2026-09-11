import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const logo = main.slice(main.indexOf("function injetarLogo"));
const temas = [
    ["Dark Neon", "\\.t20a", await readFile(new URL("styles/theme.css", raiz), "utf8")],
    ["Dark Mode", "\\.t20a-dm", await readFile(new URL("styles/theme-darkmode.css", raiz), "utf8")],
    ["Light Mode", "\\.t20a-lm", await readFile(new URL("styles/theme-lightmode.css", raiz), "utf8")]
];

test("logo sai pela borda esquerda da janela nas duas fichas", () => {
    assert.match(main, /const LOGO_LEFT = -15;/);
    assert.match(logo, /const left = LOGO_LEFT;/);
    // Regressão: medir a partir do retrato jogava o logo para dentro da ficha
    assert.doesNotMatch(logo, /retratoRect\.left/);
});

test("janela deixa o logo passar da borda em todos os temas", () => {
    for (const [nome, prefixo, css] of temas) {
        assert.match(css, new RegExp(`${prefixo}\\.window-app\\s*\\{[^}]*overflow:\\s*visible`, "s"),
            `${nome} não pode cortar o que passa da janela`);
        assert.match(css, new RegExp(`${prefixo}\\.window-app\\s*>\\s*\\.t20a-brand-logo\\s*\\{[^}]*left:\\s*-15px`, "s"),
            `${nome} deve manter o logo 15px para fora`);
    }
});
