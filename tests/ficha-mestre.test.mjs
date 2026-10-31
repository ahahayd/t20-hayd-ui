import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const raiz = new URL("../", import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), "utf8");

const manifesto = JSON.parse(await ler("module.json"));
const main = await ler("scripts/main.mjs");
const ficha = await ler("scripts/ficha-mestre.mjs");
const hayd = await ler("scripts/ficha-hayd.mjs");
const css = await ler("styles/ficha-mestre.css");
const hbs = await ler("templates/mestre/ficha.hbs");
const idiomas = {
    "pt-BR": JSON.parse(await ler("lang/pt-BR.json")),
    en: JSON.parse(await ler("lang/en.json"))
};

test("manifesto carrega o CSS da ficha do mestre", () => {
    assert.ok(manifesto.styles.includes("styles/ficha-mestre.css"));
});

test("ficha do mestre é registrada para atores simple e recebe só a cor de destaque do tema", () => {
    assert.match(ficha, /types:\s*\["simple"\]/);
    assert.match(main, /registrarFichaMestre\(\)/);
    assert.match(main, /ehFichaMestre\(app\)/);
    assert.match(main, /\$\{CLASSE_MESTRE\}/);
});

test("a ficha usa o template próprio, mas mantém as partes e as classes do sistema: nada some", () => {
    assert.match(ficha, /templates\/mestre\/ficha\.hbs/);
    assert.match(ficha, /opcoes\.classes = \[\.\.\.new Set\(\[\.\.\.opcoes\.classes, CLASSE_MESTRE\]\)\]/);
    for (const parte of ["abilities", "traits", "list-powers", "list-spells", "list-general", "currency", "encumbrance", "active-effects"]) {
        assert.ok(hbs.includes(`"tormenta20.${parte}"`), `falta a parte ${parte}`);
    }
    assert.match(hbs, /system\.detalhes\.biography\.value/);
    // O sistema só troca as abas se o nav tiver o grupo
    assert.match(hbs, /<nav class="sheet-tabs[^>]*data-group="primary"/);
});

test("a arte do mestre é Deuses: Positivo por padrão e escolhível em Configurar ficha", () => {
    assert.match(hayd, /export function lerArteMestre/);
    assert.match(hayd, /\["character", "simple", "npc"\]\.includes\(doc\.type\)/);
    // A Ficha de Ameaça usa a mesma escolha, com Deuses: Negativo como padrão
    const ameaca = readFileSync(new URL("scripts/ficha-ameaca.mjs", raiz), "utf8");
    assert.match(ameaca, /lerArteMestre\(actor, "deuses-negativo"\)/);
    assert.match(ficha, /header-deuses-positivo\.webp/);
    assert.match(hbs, /--hm-arte: url/);
});

test("o CSS fica preso à janela da ficha do mestre", () => {
    const seletores = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^{}@]+(?=\{)/gm) ?? [];
    for (const s of seletores.flatMap((x) => x.split(","))) {
        assert.match(s.trim(), /^\.hayd-mestre\.sheet/, `seletor solto: ${s.trim()}`);
    }
});

test("o nome da ficha e a aba existem nos dois idiomas", () => {
    for (const lang of Object.values(idiomas)) {
        assert.ok(lang.T20A.Mestre.Nome);
        assert.ok(lang.T20A.Mestre.AbaFicha);
    }
});
