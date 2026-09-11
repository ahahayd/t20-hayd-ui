import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const neon = await readFile(new URL("styles/theme.css", raiz), "utf8");
const darkMode = await readFile(new URL("styles/theme-darkmode.css", raiz), "utf8");
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const ptBR = JSON.parse(await readFile(new URL("lang/pt-BR.json", raiz), "utf8"));

test("Dark Neon exibe a arte do cabeçalho recolorida pela cor de destaque", () => {
    assert.match(neon,
        /\.t20a\.t20a-player-sheet \.sheet-header::before\s*\{[^}]*header-tormenta\.webp[^}]*background-blend-mode:\s*color/s);
});

test("Dark Neon sobrepõe a navbar à arte só na ficha padrão", () => {
    assert.match(neon,
        /\.t20a\.t20a-player-sheet-base \.window-content form\.base > \.sheet-tabs\s*\{[^}]*position:\s*absolute/s);
    assert.match(neon,
        /\.t20a\.t20a-player-sheet-base form\.base > \.sheet-body > \.tab\.attributes \.sheet-header\s*\{[^}]*--t20a-navbar-height/s);
    assert.match(neon,
        /form\.base > \.sheet-body > \.tab:not\(\.attributes\)\s*\{[^}]*padding-top:\s*calc\(var\(--t20a-navbar-height/s);
    assert.doesNotMatch(neon, /form\.tabbed[^}]*position:\s*absolute/s);
});

test("Dark Neon não separa header e navbar na ficha em abas", () => {
    assert.match(neon, /\.t20a \.sheet-header \+ :not\(\.sheet-tabs\)/);
    assert.doesNotMatch(neon, /\.t20a \.sheet-header \+ \*/);
    assert.match(neon,
        /\.t20a\.t20a-player-sheet \.window-content form\.tabbed > \.sheet-header\s*\{[^}]*margin-bottom:\s*0/s);
});

test("opção de arte original remove a recoloração nos dois temas", () => {
    for (const [css, prefixo] of [[neon, "\\.t20a"], [darkMode, "\\.t20a-dm"]]) {
        const regra = new RegExp(
            `${prefixo}\\.t20a-player-sheet\\.t20a-arte-original \\.sheet-header::before\\s*\\{[^}]*` +
            `background-image:\\s*url\\("\\.\\./assets/header-tormenta\\.webp"\\);[^}]*background-blend-mode:\\s*normal`, "s");
        assert.match(css, regra);
    }
});

test("ficha marca a classe da arte original a partir da flag do ator", () => {
    assert.match(main, /const FLAG_ARTE_ORIGINAL = "arteOriginal"/);
    assert.match(main,
        /classList\.toggle\("t20a-arte-original",\s*ehFichaJogador && doc\.getFlag\(MODULE_ID, FLAG_ARTE_ORIGINAL\) === true\)/);
});

test("diálogo Cor da Ficha oferece a checkbox e salva tudo num só update", () => {
    assert.match(main, /<input type="checkbox" name="arteOriginal"/);
    assert.match(main, /arteOriginal: form\?\.elements\?\.arteOriginal\?\.checked \?\? null/);
    assert.match(main, /update\[`flags\.\$\{MODULE_ID\}\.\$\{FLAG_ARTE_ORIGINAL\}`\] = arteOriginal/);
    assert.match(main, /await doc\.update\(update\)/);
    assert.ok(ptBR.T20A.Dialog.ArteOriginal);
    assert.ok(ptBR.T20A.Dialog.ArteOriginalHint);
});

test("opção de ocultar a arte remove o pseudo-elemento nos três temas", async () => {
    const light = await readFile(new URL("styles/theme-lightmode.css", raiz), "utf8");
    for (const [css, prefixo] of [[neon, "\\.t20a"], [darkMode, "\\.t20a-dm"], [light, "\\.t20a-lm"]]) {
        assert.match(css, new RegExp(
            `${prefixo}\\.t20a-player-sheet\\.t20a-sem-arte \\.sheet-header::before\\s*\\{[^}]*content:\\s*none`, "s"));
    }
});

test("diálogo oferece ocultar a arte e salva a flag no mesmo update", () => {
    assert.match(main, /const FLAG_SEM_ARTE = "semArte"/);
    assert.match(main,
        /classList\.toggle\("t20a-sem-arte",\s*ehFichaJogador && doc\.getFlag\(MODULE_ID, FLAG_SEM_ARTE\) === true\)/);
    assert.match(main, /<input type="checkbox" name="semArte"/);
    assert.match(main, /semArte: form\?\.elements\?\.semArte\?\.checked \?\? null/);
    assert.match(main, /update\[`flags\.\$\{MODULE_ID\}\.\$\{FLAG_SEM_ARTE\}`\] = semArte/);
    // Sem arte, a opção de cores originais fica desabilitada no diálogo
    assert.match(main, /inputArteOriginal\.disabled = inputSemArte\.checked/);
    assert.ok(ptBR.T20A.Dialog.SemArte);
    assert.ok(ptBR.T20A.Dialog.SemArteHint);
});
