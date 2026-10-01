import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), "utf8");

const manifesto = JSON.parse(await ler("module.json"));
const main = await ler("scripts/main.mjs");
const ficha = await ler("scripts/ficha-hayd.mjs");
const css = await ler("styles/ficha-hayd.css");
const pastaTemplates = new URL("templates/ficha/", raiz);
const templates = Object.fromEntries(await Promise.all(
    (await readdir(pastaTemplates)).filter((nome) => nome.endsWith(".hbs")).map(async (nome) => [nome, await readFile(new URL(nome, pastaTemplates), "utf8")])
));
const idiomas = {
    "pt-BR": JSON.parse(await ler("lang/pt-BR.json")),
    en: JSON.parse(await ler("lang/en.json"))
};

test("manifesto carrega o CSS da ficha antes do layout do Diário", () => {
    const i = manifesto.styles.indexOf("styles/ficha-hayd.css");
    assert.ok(i >= 0, "ficha-hayd.css precisa estar no manifesto");
    assert.equal(manifesto.styles.at(-1), "styles/journal-layout.css");
});

test("todos os templates carregados existem", () => {
    const carregados = [...ficha.matchAll(/`\$\{TEMPLATES\}\/([\w-]+\.hbs)`/g)].map((m) => m[1]);
    assert.ok(carregados.length >= 10);
    for (const nome of carregados) assert.ok(templates[nome], `falta templates/ficha/${nome}`);
    for (const [nome, conteudo] of Object.entries(templates)) {
        for (const m of conteudo.matchAll(/\{\{>\s*"modules\/t20-hayd-ui\/templates\/ficha\/([\w-]+\.hbs)"/g)) {
            assert.ok(templates[m[1]], `${nome} inclui ${m[1]}, que não existe`);
            assert.ok(carregados.includes(m[1]), `${m[1]} é parcial e precisa ser pré-carregado`);
        }
    }
});

test("toda chave T20A.Ficha usada existe nos dois idiomas", () => {
    const fontes = [ficha, ...Object.values(templates)].join("\n");
    const chaves = new Set([...fontes.matchAll(/T20A\.Ficha\.[\w.]+/g)].map((m) => m[0].replace(/\.$/, "")));
    // Chaves montadas dinamicamente (T20A.Ficha.Novo.<tipo>) entram pelo objeto
    for (const tipo of ["arma", "equipamento", "consumivel", "tesouro", "poder", "magia", "item"]) {
        chaves.add(`T20A.Ficha.Novo.${tipo}`);
    }
    for (const [idioma, json] of Object.entries(idiomas)) {
        for (const chave of chaves) {
            const valor = chave.split(".").reduce((o, k) => o?.[k], json);
            if (chave === "T20A.Ficha.Novo" || chave === "T20A.Ficha.Abas") continue;
            assert.equal(typeof valor, "string", `${idioma}: falta ${chave}`);
        }
    }
});

test("CSS da ficha não vaza para outras janelas", () => {
    const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const semKeyframes = semComentarios
        .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, "")
        // @property só registra o tipo de uma variável: não é seletor
        .replace(/@property[^{]+\{[^}]*\}/g, "")
        // @media/@container só agrupam: o que importa são os seletores de dentro
        .replace(/@(media|container)[^{]+\{/g, "}");
    const seletores = [...semKeyframes.matchAll(/(^|\})\s*([^@{}][^{}]*?)\s*\{/g)].map((m) => m[2].trim());
    assert.ok(seletores.length > 50);
    for (const grupo of seletores) {
        for (const sel of grupo.split(",")) {
            assert.match(sel.trim(), /^\.hayd-ficha\b/, `seletor sem escopo: ${sel.trim()}`);
        }
    }
});

test("o tema antigo só pinta a cor de destaque na Ficha Hayd", () => {
    const aplicarTema = main.slice(main.indexOf("function aplicarTema"), main.indexOf("function aplicarCorDeDestaque"));
    const desvio = aplicarTema.indexOf("ehFichaHayd(app)");
    assert.ok(desvio > 0, "aplicarTema precisa reconhecer a Ficha Hayd");
    assert.ok(desvio < aplicarTema.indexOf("aplicarClasseTema(windowApp"),
        "a Ficha Hayd deve sair antes de receber a classe do tema");
});

test("a ficha estende a do sistema e mantém as classes que os listeners dele usam", () => {
    assert.match(ficha, /game\.tormenta20\?\.applications\?\.ActorSheetT20Character/);
    // Linhas de item precisam ser li.item dentro de .item-list (arrastar, menu de contexto, rolagem)
    assert.match(templates["linha-item.hbs"], /<li class="item hf-item/);
    assert.match(templates["linha-item.hbs"], /class="item-image hf-item-img"/);
    assert.match(templates["secao-itens.hbs"], /<ol class="item-list hf-lista">/);
    // Rolagem de atributo e perícia pelo sistema
    assert.match(templates["cabecalho.hbs"], /rollable atributo-rollable/);
    assert.match(templates["lateral.hbs"], /rollable pericia-rollable/);
});
