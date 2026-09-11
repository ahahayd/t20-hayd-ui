import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), "utf8");
const dark = await ler("styles/theme-darkmode.css");
const light = await ler("styles/theme-lightmode.css");
const compartilhado = await ler("styles/theme.css");
const variaveis = await ler("styles/variables.css");
const main = await ler("scripts/main.mjs");
const modulo = JSON.parse(await ler("module.json"));
const ptBR = JSON.parse(await ler("lang/pt-BR.json"));

/**
 * Seletores de cada regra, sem comentários e com espaços normalizados —
 * inclusive em volta de combinadores e vírgulas, para que só a formatação
 * (ex.: o formatador do editor trocando "a > b" por "a>b") não conte como
 * diferença entre os temas.
 */
function seletores(css) {
    const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
    return [...semComentarios.matchAll(/([^{}]+)\{/g)]
        .map(m => m[1]
            .replace(/\s+/g, " ")
            .replace(/\s*([>+~,])\s*/g, "$1")
            .trim())
        .filter(Boolean);
}

test("Light Mode cobre exatamente os mesmos seletores do Dark Mode", () => {
    const esperados = seletores(dark).map(s => s
        .replace(/\.t20a-dm/g, ".t20a-lm")
        .replace(/body\.t20a-theme-darkmode/g, "body.t20a-theme-lightmode"));
    assert.deepEqual(seletores(light), esperados);
});

test("Light Mode não herda nada do escopo do Dark Mode", () => {
    assert.doesNotMatch(light, /t20a-dm|--t20dm-|t20a-theme-darkmode/);
});

test("toda variável do Light Mode está definida na paleta clara", () => {
    const bloco = variaveis.slice(variaveis.indexOf(".t20a-lm,"));
    const usadas = new Set([...light.matchAll(/var\((--t20lm-[\w-]+)/g)].map(m => m[1]));
    assert.ok(usadas.size > 0);
    for (const nome of usadas) {
        assert.match(bloco, new RegExp(`${nome}:`), `${nome} não definida`);
    }
});

test("arte do cabeçalho usa multiply no fundo claro", () => {
    assert.match(light,
        /\.t20a-lm\.t20a-player-sheet \.sheet-header::before\s*\{[^}]*mix-blend-mode:\s*multiply/s);
    assert.doesNotMatch(light, /mix-blend-mode:\s*screen/);
});

test("barra de título do Light Mode é quase opaca e com botões escuros", () => {
    assert.match(light,
        /\.t20a-lm \.window-header\s*\{[^}]*background:\s*var\(--t20lm-bg-surface\)/s);
    assert.match(light,
        /\.t20a-lm \.window-header a\.header-control\s*\{[^}]*color:\s*var\(--t20lm-text-primary\)/s);
});

test("navbar sobre a arte no Light Mode é vidro transparente, como no Dark Mode", () => {
    const regra = light.match(/form\.base\s*>\s*\.sheet-tabs\s*\{([^}]*)\}/)?.[1] ?? "";
    assert.match(regra, /background:\s*color-mix\(in srgb, var\(--t20lm-bg-deep\) 42%, transparent\)/);
    assert.match(regra, /backdrop-filter:\s*blur\(14px\)/);
    assert.match(regra, /text-shadow:/);
});

test("caixa de treinamento das perícias é um quadrado nos dois temas modernos", () => {
    for (const [css, prefixo] of [[dark, "\\.t20a-dm"], [light, "\\.t20a-lm"]]) {
        const regra = css.match(new RegExp(`${prefixo} \\.skills-list \\.skill \\.item-image\\s*\\{([^}]*)\\}`))?.[1] ?? "";
        assert.match(regra, /width:\s*14px/);
        assert.match(regra, /height:\s*14px/);
        assert.match(regra, /flex:\s*0 0 14px/);
    }
});

test("ícones de vestimentas mantêm proporção compacta no Light Mode", () => {
    const regra = compartilhado.match(
        /body\.t20a-theme-lightmode #context-menu \.context-item img\s*\{([^}]*)\}/
    )?.[1] ?? "";
    assert.match(regra, /flex:\s*0 0 auto\s*!important/);
    assert.match(regra, /width:\s*20px\s*!important/);
    assert.match(regra, /height:\s*20px\s*!important/);
    assert.match(regra, /object-fit:\s*contain/);
});

test("tema claro registrado no JS, na tradução e no manifesto", () => {
    assert.match(main, /lightMode:\s*\{ classe: "t20a-lm", corTexto: "#2b2620" \}/);
    assert.match(main, /lightMode: "T20A\.Settings\.TemaLightMode"/);
    assert.match(main, /toggle\("t20a-theme-lightmode", ativo && tema === "lightMode"\)/);
    assert.ok(modulo.styles.includes("styles/theme-lightmode.css"));
    assert.equal(ptBR.T20A.Settings.TemaLightMode, "Light Mode");
});
