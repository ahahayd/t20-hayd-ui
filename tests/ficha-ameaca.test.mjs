import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), "utf8");

const manifesto = JSON.parse(await ler("module.json"));
const main = await ler("scripts/main.mjs");
const ficha = await ler("scripts/ficha-ameaca.mjs");
const css = await ler("styles/ficha-ameaca.css");
const pastaTemplates = new URL("templates/ameaca/", raiz);
const templates = Object.fromEntries(await Promise.all(
    (await readdir(pastaTemplates)).filter((nome) => nome.endsWith(".hbs")).map(async (nome) => [nome, await readFile(new URL(nome, pastaTemplates), "utf8")])
));
const idiomas = {
    "pt-BR": JSON.parse(await ler("lang/pt-BR.json")),
    en: JSON.parse(await ler("lang/en.json"))
};

test("manifesto carrega o CSS da ficha de ameaça", () => {
    assert.ok(manifesto.styles.includes("styles/ficha-ameaca.css"));
});

test("ficha de ameaça é registrada para NPCs e recebe só a cor de destaque do tema", () => {
    assert.match(ficha, /types:\s*\["npc"\]/);
    assert.match(main, /registrarFichaAmeaca\(\)/);
    assert.match(main, /ehFichaHayd\(app\) \|\| ehFichaAmeaca\(app\)/);
    // Menus de contexto abertos na ficha seguem o visual dela
    assert.match(main, /\$\{CLASSE_AMEACA\}/);
});

test("todos os templates da ficha de ameaça existem e são pré-carregados", () => {
    const carregados = [...ficha.matchAll(/`\$\{TEMPLATES\}\/([\w-]+\.hbs)`/g)].map((m) => m[1]);
    assert.ok(carregados.length >= 4);
    for (const nome of carregados) assert.ok(templates[nome], `falta templates/ameaca/${nome}`);
    for (const [nome, conteudo] of Object.entries(templates)) {
        for (const m of conteudo.matchAll(/\{\{>\s*"modules\/t20-hayd-ui\/templates\/ameaca\/([\w-]+\.hbs)"/g)) {
            assert.ok(templates[m[1]], `${nome} inclui ${m[1]}, que não existe`);
            assert.ok(carregados.includes(m[1]), `${m[1]} é parcial e precisa ser pré-carregado`);
        }
    }
});

test("toda chave T20A.Ameaca e T20A.Ficha usada existe nos dois idiomas", () => {
    const fontes = [ficha, ...Object.values(templates)].join("\n");
    // Chaves montadas no código (`Patamar.${chave}`) terminam em ponto: conferidas no teste dos brasões
    const chaves = new Set([...fontes.matchAll(/T20A\.(?:Ameaca|Ficha)\.[\w.]+/g)].map((m) => m[0]).filter((c) => !c.endsWith(".")));
    assert.ok(chaves.size > 10);
    for (const [lang, json] of Object.entries(idiomas)) {
        for (const chave of chaves) {
            const valor = chave.split(".").reduce((o, k) => o?.[k], json);
            assert.equal(typeof valor, "string", `${lang}: falta ${chave}`);
        }
    }
});

test("as rolagens usam as classes que a ficha do sistema liga", () => {
    const html = Object.values(templates).join("\n");
    for (const classe of ["pericia-rollable", "atributo-rollable", "arma-rollable", "magia-rollable"]) {
        assert.ok(html.includes(classe), `nenhum elemento com .${classe}`);
    }
    // Ações e habilidades rolam pelo ícone (o sistema liga ".item .item-image"); o nome abre a regra
    assert.match(templates["linha-item.hbs"], /class="item-image ha-item-img"/);
    // O sistema acha o item pela linha .item mais próxima
    assert.match(templates["linha-item.hbs"], /class="item ha-item[^"]*" data-item-id=/);
});

test("cada patamar do ND tem brasão e nome nos dois idiomas", async () => {
    const patamares = [...ficha.matchAll(/\{ chave: "([\w-]+)", ate:/g)].map((m) => m[1]);
    assert.deepEqual(patamares, ["iniciante", "veterano", "campeao", "lenda", "lenda-plus"]);
    for (const p of patamares) {
        await access(new URL(`assets/brasoes/nd-${p}.webp`, raiz));
        for (const [lang, json] of Object.entries(idiomas)) {
            assert.equal(typeof json.T20A.Ameaca.Patamar?.[p], "string", `${lang}: falta T20A.Ameaca.Patamar.${p}`);
        }
    }
});

test("ND vira o patamar dos personagens; acima de 20 (e S, S+) é Lenda+", () => {
    const corpo = ficha.slice(ficha.indexOf("const PATAMARES"), ficha.indexOf("/** A ficha é uma Ficha de Ameaça"));
    const patamarDoND = new Function(`${corpo.replace("export function", "function")}; return patamarDoND;`)();
    const esperado = {
        "1/4": "iniciante", "1/2": "iniciante", 1: "iniciante", 4: "iniciante",
        5: "veterano", 10: "veterano", 11: "campeao", 16: "campeao",
        17: "lenda", 20: "lenda", 21: "lenda-plus", S: "lenda-plus", "S+": "lenda-plus", "": "iniciante"
    };
    for (const [nd, patamar] of Object.entries(esperado)) assert.equal(patamarDoND(nd), patamar, `ND ${nd}`);
});

test("arte do fundo e escudo referenciados existem", async () => {
    for (const m of ficha.matchAll(/`modules\/\$\{MODULE_ID\}\/(assets\/[\w/.-]+)`/g)) {
        await access(new URL(m[1], raiz));
    }
    assert.match(ficha, /header-deuses-negativo\.webp/);
});

test("CSS da ficha de ameaça fica preso à janela dela", () => {
    const seletores = css.replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "")
        .match(/(^|\})\s*[^{}@]+\{/g)
        .map((s) => s.replace(/^\}?\s*/, "").replace(/\{$/, "").trim())
        .filter((s) => s && !/^(from|to|\d+%)$/.test(s));
    for (const grupo of seletores) {
        // Vírgula dentro de :is(...) não separa seletores
        for (const s of grupo.split(/,(?![^()]*\))/)) assert.match(s.trim(), /^\.hayd-ameaca\b/, `seletor solto: ${s.trim()}`);
    }
});
