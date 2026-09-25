import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const arquivos = ["theme.css", "theme-darkmode.css", "theme-lightmode.css"];

test("menu de contexto aberto de janela com tema recebe a marca do módulo", () => {
    assert.match(main, /menu\.classList\.toggle\("t20a-context-menu", !!janelaTema\)/);
});

test("regras no body só alcançam menus marcados, nunca os do core ou de outros módulos", async () => {
    for (const nome of arquivos) {
        const css = (await readFile(new URL(`styles/${nome}`, raiz), "utf8"))
            .replace(/\/\*[\s\S]*?\*\//g, "");
        const vazando = css.match(/body\.t20a-[\w-]+ #context-menu(?!\.t20a-context-menu)/g);
        assert.equal(vazando, null, `${nome}: ${vazando}`);
    }
});
