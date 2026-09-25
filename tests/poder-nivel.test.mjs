import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const trecho = main.slice(main.indexOf("const FLAG_NIVEL_PODER"), main.indexOf("function marcarPoderesComNivel"));

test("cliques rápidos no selo contam um a um", async () => {
    const { ajustarNivelDoPoder, _ajustesDeNivel } = new Function("MODULE_ID",
        `${trecho}; return { ajustarNivelDoPoder, _ajustesDeNivel };`)("t20-hayd-ui");
    const flags = {};
    const gravados = [];
    const item = {
        uuid: "Item.x",
        parent: { system: { attributes: { nivel: { value: 5 } } } },
        getFlag: (_s, k) => flags[k],
        setFlag: async (_s, k, v) => { await new Promise(r => setTimeout(r, 5)); flags[k] = v; gravados.push(v); }
    };
    for (const d of [+1, +1, +1, -1]) ajustarNivelDoPoder(item, d);
    await new Promise(r => setTimeout(r, 100));
    assert.deepEqual(gravados, [1, 2, 3, 2]);
    assert.equal(_ajustesDeNivel.size, 0);
});

test("selo é operável pelo teclado e tem texto traduzível", async () => {
    const pt = JSON.parse(await readFile(new URL("lang/pt-BR.json", raiz), "utf8"));
    assert.ok(pt.T20A.PoderNivel.Nivel.includes("{nivel}"));
    assert.match(main, /badge\.setAttribute\("role", "button"\)/);
    assert.match(main, /badge\.tabIndex = 0/);
    assert.match(main, /addEventListener\("keydown"/);
    assert.doesNotMatch(main, /Obtido no nível \$\{/);
});
