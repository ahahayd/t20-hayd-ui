import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const css = await readFile(new URL("styles/theme-darkmode.css", raiz), "utf8");
const temasDialog = [
    ["darkNeon", "t20a", await readFile(new URL("styles/theme.css", raiz), "utf8")],
    ["darkMode", "t20a-dm", css],
    ["lightMode", "t20a-lm", await readFile(new URL("styles/theme-lightmode.css", raiz), "utf8")]
];
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");

test("navbar sobreposta fica restrita à ficha padrão", () => {
    assert.match(css,
        /\.t20a-dm\.t20a-player-sheet-base \.window-content form\.base > \.sheet-tabs\s*\{[^}]*position:\s*absolute/s);
    assert.doesNotMatch(css,
        /\.t20a-dm\.t20a-player-sheet \.window-content form > \.sheet-tabs/);
    assert.match(main, /const ehFichaBase = ehFichaJogador && formulario\?\.classList\.contains\("base"\)/);
    assert.match(main, /if \(ehFichaBase\) \{\s*medirNavbarDaFicha/s);
});

test("ficha em abas mantém navbar no fluxo e sem margem artificial", () => {
    assert.match(css,
        /form\.tabbed > \.sheet-header\s*\{[^}]*margin-bottom:\s*0/s);
    assert.match(css, /\.sheet-header \+ :not\(\.sheet-tabs\)/);
    assert.doesNotMatch(css, /\.sheet-header\+\*/);
    assert.doesNotMatch(css, /form\.tabbed[^}]*position:\s*absolute/s);
});

test("Diário e Efeitos da ficha padrão começam abaixo da navbar", () => {
    assert.match(css,
        /form\.base > \.sheet-body > \.tab:not\(\.attributes\)\s*\{[^}]*padding-top:\s*calc\(var\(--t20a-navbar-height/s);
});

test("janela de uso recupera a altura automática em todos os temas", () => {
    for (const [tema, classe, folha] of temasDialog) {
        assert.match(folha,
            new RegExp(`\\.dialog\\.ability-use-form\\.${classe}\\s*\\{[^}]*min-width:\\s*min\\(600px[^}]*height:\\s*auto`, "s"),
            `${tema} deve deixar a janela crescer conforme o conteúdo`);
        assert.match(folha,
            new RegExp(`\\.dialog\\.ability-use-form\\.${classe} \\.window-content\\s*\\{[^}]*flex:\\s*0 1 auto`, "s"),
            `${tema} não deve forçar o conteúdo a ocupar uma altura fixa`);
        assert.doesNotMatch(folha,
            new RegExp(`\\.dialog\\.ability-use-form\\.${classe}\\s*\\{[^}]*min-height:`, "s"),
            `${tema} não deve impor altura mínima à janela de uso`);
    }
});

test("logo da ficha em abas fica na faixa das abas, com espaço reservado", () => {
    const logo = main.slice(
        main.indexOf("function injetarLogo"),
        main.indexOf("Header button (Cor da Ficha)")
    );
    assert.match(logo,
        /const ehFichaEmAbas = formulario\?\.classList\.contains\("tabbed"\)/);
    // Posicionar pelo retrato fazia o logo cobrir a arte do personagem
    assert.doesNotMatch(logo, /img\.profile/);
    assert.doesNotMatch(logo, /retratoRect/);
    assert.doesNotMatch(logo, /removeProperty\("padding-left"\)/);
    // Altura própria (constante ajustável) e centralizado na barra de abas
    assert.match(main, /const LOGO_ALTURA_ABAS = \d+;/);
    assert.match(logo, /\? LOGO_ALTURA_ABAS/);
    assert.match(logo, /\(logoHeight - tabsRect\.height\) \/ 2/);
    // top/height precisam vencer o !important do CSS de cada tema
    assert.match(logo, /escrever\("top", novoTop\)/);
    assert.match(logo, /escrever\("height", novaAltura\)/);
    assert.match(logo, /img\.style\.setProperty\(prop, valor, "important"\)/);
    // Espaço reservado na navbar nas duas fichas; folga própria na de abas
    assert.match(logo, /if \(img\.naturalWidth && img\.naturalHeight\) \{/);
    assert.match(main, /const LOGO_FOLGA_ABAS = -?\d+;/);
    assert.match(logo, /const folga\s*= ehFichaEmAbas \? LOGO_FOLGA_ABAS : 6;/);
    assert.match(logo, /logoRight - tabsLeft \+ folga/);
});
