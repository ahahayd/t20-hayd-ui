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

test("editor ativo do Diário ganha área de digitação ampla em todos os temas", () => {
    for (const [tema, classe, folha] of temasDialog) {
        assert.match(folha,
            new RegExp(`\\.${classe}\\.t20a-player-sheet \\.tab\\.journal article:has\\(> prose-mirror\\.active\\)\\s*\\{[^}]*flex:\\s*0 0 25rem[^}]*min-height:\\s*25rem`, "s"),
            `${tema} deve expandir o article do campo ativo`);
        assert.match(folha,
            new RegExp(`\\.${classe}\\.t20a-player-sheet \\.tab\\.journal prose-mirror\\.active\\s*\\{[^}]*height:\\s*22rem[^}]*min-height:\\s*22rem`, "s"),
            `${tema} deve reservar altura para o editor aberto`);
        assert.match(folha,
            new RegExp(`\\.${classe}\\.t20a-player-sheet \\.tab\\.journal prose-mirror\\.active \\.editor-container\\s*\\{[^}]*min-height:\\s*14rem`, "s"),
            `${tema} deve manter ampla a área abaixo da barra de ferramentas`);
    }
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

test("logo da ficha em abas flutua sobre o retrato sem empurrar Detalhes", () => {
    assert.match(main,
        /const ehFichaEmAbas = formulario\?\.classList\.contains\("tabbed"\)/);
    assert.match(main,
        /if \(ehFichaEmAbas\) tabs\.style\.removeProperty\("padding-left"\)/);
    assert.match(main,
        /const retrato = ehFichaEmAbas \? formulario\.querySelector\("\.sheet-header img\.profile"\) : null/);
    assert.match(main,
        /if \(!ehFichaEmAbas && img\.naturalWidth && img\.naturalHeight\)/);
});
