import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const temas = [
    ["Dark Neon", "\\.t20a", await readFile(new URL("styles/theme.css", raiz), "utf8")],
    ["Dark Mode", "\\.t20a-dm", await readFile(new URL("styles/theme-darkmode.css", raiz), "utf8")],
    ["Light Mode", "\\.t20a-lm", await readFile(new URL("styles/theme-lightmode.css", raiz), "utf8")]
];

test("Outras Características e Proficiências não encostam na borda da ficha padrão", () => {
    for (const [nome, prefixo, css] of temas) {
        const regra = new RegExp(
            `${prefixo}\\.t20a-player-sheet-base form\\.base\\s*>\\s*\\.sheet-body \\.traits\\s*\\{[^}]*padding-left:\\s*14px`, "s");
        assert.match(css, regra, `${nome} deve recuar o bloco de características`);
    }
});
