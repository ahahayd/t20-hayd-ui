import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const css = await readFile(new URL("styles/journal-layout.css", raiz), "utf8");
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const manifesto = JSON.parse(await readFile(new URL("module.json", raiz), "utf8"));

test("layout do Diário é uma camada compartilhada carregada depois dos temas", () => {
    assert.equal(manifesto.styles.at(-1), "styles/journal-layout.css");
    assert.match(css, /\.t20a-any\.t20a-player-sheet \.tab\.journal\.active/);
    assert.doesNotMatch(css, /system\.detalhes|setFlag|update\s*\(/);
});

test("grade do Diário responde à largura da própria ficha", () => {
    assert.match(css,
        /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(css,
        /\.tab\.journal\.active\.t20a-journal-compact\s*\{[^}]*display:\s*flex\s*!important[^}]*flex-direction:\s*column\s*!important/s);
    assert.match(css,
        /\.t20a-journal-compact\s*> \.note-entries\s*\{[^}]*position:\s*static\s*!important[^}]*flex:\s*0 0 auto\s*!important[^}]*width:\s*100%\s*!important/s);
    assert.match(css,
        /> \.note-entries\s*\{[^}]*display:\s*grid\s*!important[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
    assert.doesNotMatch(css, /@container|container-type:/);
});

test("breakpoint do Diário acompanha redimensionamento sem polling", () => {
    assert.match(main, /const JOURNAL_COMPACT_BREAKPOINT = 768/);
    assert.match(main,
        /function prepararDiarioResponsivo\([\s\S]*?new ResizeObserver\([\s\S]*?observador\.observe\(areaUtil\)/);
    assert.match(main,
        /diario\.classList\.toggle\("t20a-journal-compact", compacta\)/);
    assert.match(main,
        /function encerrarDiarioResponsivo\([\s\S]*?observador\.disconnect\(\)/);
});

test("modo focado mostra somente o grupo e o artigo que estão em edição", () => {
    assert.match(css,
        /\.tab\.journal\.active:has\(> \.note-entries prose-mirror\[open\]\)\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)[^}]*overflow:\s*hidden\s*!important/s);
    assert.match(css,
        /> \.note-entries:not\(:has\(prose-mirror\[open\]\)\)\s*\{[^}]*display:\s*none\s*!important/s);
    assert.match(css,
        /> article:not\(:has\(> prose-mirror\[open\]\)\)\s*\{[^}]*display:\s*none\s*!important/s);
});

test("ProseMirror aberto usa todo o espaço restante da aba", () => {
    assert.match(css,
        /article > prose-mirror\[open\]\s*\{[^}]*flex:\s*1 1 0\s*!important[^}]*height:\s*auto\s*!important[^}]*min-height:\s*0\s*!important/s);
    assert.match(css,
        /prose-mirror\[open\] \.editor-container\s*\{[^}]*flex:\s*1 1 0\s*!important[^}]*min-height:\s*0\s*!important/s);
    assert.match(css,
        /prose-mirror\[open\] \.editor-content\s*\{[^}]*inset:\s*0\s*!important[^}]*overflow:\s*hidden auto\s*!important/s);
});

test("camada de layout evita efeitos gráficos e processamento contínuo", () => {
    assert.doesNotMatch(css, /backdrop-filter|filter:|animation:|transition:/);
});
