import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const origem = await readFile(new URL("scripts/origem-poderes.mjs", raiz), "utf8");

/** Carrega o módulo real com um `game` falso. */
async function carregar({ mundo = true, modo = "organizador", legadoLigado = false, escolheu = true } = {}) {
    const valores = { origemPoderesMundo: mundo, origemPoderes: modo, poderesPorNivel: legadoLigado };
    globalThis.game = {
        settings: {
            get: (_m, k) => valores[k],
            storage: { get: () => ({ getItem: () => (escolheu ? modo : null) }) }
        },
        i18n: {
            localize: k => ({ "T20A.OrigemPoderes.Categorias.origem": "Origem",
                              "T20A.OrigemPoderes.Categorias.nivel": "Nível" })[k] ?? k,
            format: (k, d) => `${k}:${JSON.stringify(d)}`
        }
    };
    const url = new URL("scripts/origem-poderes.mjs", raiz);
    return import(`${url.href}?t=${Math.random()}`);
}

function itemFalso(flags = {}) {
    return {
        uuid: "Item.x",
        parent: { system: { attributes: { nivel: { value: 5 } } } },
        getFlag: (_s, k) => flags[k],
        async update(dados) {
            await new Promise(r => setTimeout(r, 5));
            for (const [k, v] of Object.entries(dados)) flags[k.split(".").at(-1)] = v;
            this.gravados.push(flags.origemPoder?.nivel ?? "bonus");
        },
        gravados: []
    };
}

test("anotação lê o formato do selo antigo", async () => {
    const { origemDoItem } = await carregar();
    assert.deepEqual(origemDoItem(itemFalso({ nivelObtido: 4 })), { categoria: "nivel", nivel: 4 });
    assert.deepEqual(origemDoItem(itemFalso({ nivelObtido: "bonus" })), { categoria: "bonus", nivel: null });
    assert.equal(origemDoItem(itemFalso({})), null);
    assert.deepEqual(origemDoItem(itemFalso({ origemPoder: { categoria: "Regra da mesa", nivel: 2 }, nivelObtido: 9 })),
        { categoria: "Regra da mesa", nivel: 2 });
    // Anotação apagada (null) não ressuscita o formato antigo.
    assert.equal(origemDoItem(itemFalso({ origemPoder: null, nivelObtido: null })), null);
});

test("Mestre desliga para o mundo; quem tinha o selo antigo ligado continua nele", async () => {
    assert.equal((await carregar({ mundo: false })).modoOrigemPoderes(), "desligado");
    assert.equal((await carregar({ escolheu: false, legadoLigado: true })).modoOrigemPoderes(), "legado");
    assert.equal((await carregar({ escolheu: false })).modoOrigemPoderes(), "organizador");
    assert.equal((await carregar({ modo: "desligado", legadoLigado: true })).modoOrigemPoderes(), "desligado");
});

test("cliques rápidos no selo legado contam um a um", async () => {
    await carregar();
    const trecho = origem.slice(origem.indexOf("function nivelDoSelo"), origem.indexOf("function marcarSelosLegados"));
    const { origemDoItem } = await carregar();
    const { ajustar, pendentes } = new Function("MODULE_ID", "origemDoItem", "FLAG_ORIGEM", "FLAG_NIVEL_LEGADO",
        `${trecho}; return { ajustar: ajustarNivelDoSelo, pendentes: _ajustesDeNivel };`)("t20-hayd-ui", origemDoItem, "origemPoder", "nivelObtido");
    const item = itemFalso();
    for (const d of [+1, +1, +1, -1]) ajustar(item, d);
    await new Promise(r => setTimeout(r, 100));
    assert.deepEqual(item.gravados, [1, 2, 3, 2]);
    assert.equal(pendentes.size, 0);
});

test("selo legado é operável pelo teclado e tem texto traduzível", async () => {
    const pt = JSON.parse(await readFile(new URL("lang/pt-BR.json", raiz), "utf8"));
    assert.ok(pt.T20A.PoderNivel.Nivel.includes("{nivel}"));
    assert.match(origem, /badge\.setAttribute\("role", "button"\)/);
    assert.match(origem, /badge\.tabIndex = 0/);
    assert.doesNotMatch(origem, /Obtido no nível \$\{/);
});

test("organizador: todas as chaves de tradução usadas existem", async () => {
    const pt = JSON.parse(await readFile(new URL("lang/pt-BR.json", raiz), "utf8"));
    const en = JSON.parse(await readFile(new URL("lang/en.json", raiz), "utf8"));
    const usadas = [...origem.matchAll(/"T20A\.(OrigemPoderes|Settings)\.([A-Za-z]+)"/g)];
    usadas.push(...[...origem.matchAll(/i18n\("([A-Za-z]+)"\)/g)].map(m => [0, "OrigemPoderes", m[1]]));
    for (const [, grupo, chave] of usadas) {
        assert.ok(pt.T20A[grupo][chave], `pt-BR: ${grupo}.${chave}`);
        assert.ok(en.T20A[grupo][chave], `en: ${grupo}.${chave}`);
    }
    for (const c of ["nivel", "origem", "devocao", "complicacao", "bonus"]) {
        assert.ok(pt.T20A.OrigemPoderes.Categorias[c]);
    }
});

test("main só delega ao arquivo da origem dos poderes", () => {
    assert.match(main, /from "\.\/origem-poderes\.mjs"/);
    assert.match(main, /registrarConfiguracoesPoderes\(reRenderTormentaSheets\)/);
    assert.doesNotMatch(main, /nivelObtido|marcarPoderesComNivel/);
});
