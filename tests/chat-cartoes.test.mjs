import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { variacoesDaCor } from "../scripts/chat-cartoes.mjs";
import { FUNDO_MENSAGEM, razaoContrasteRGB } from "../scripts/chat-contraste.mjs";

const raiz = new URL("../", import.meta.url);
const css = (await readFile(new URL("styles/theme.css", raiz), "utf8")).replace(/\r\n/g, "\n");
const main = (await readFile(new URL("scripts/main.mjs", raiz), "utf8")).replace(/\r\n/g, "\n");

const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

test("a cor do jogador fica legível sobre os dois fundos, mesmo amarelo ou azul-marinho", () => {
    for (const hex of ["#ffff00", "#f5e663", "#ffffff", "#000000", "#1a1f5c", "#960505", "#33ccff"]) {
        for (const claro of [true, false]) {
            const fundo = claro ? FUNDO_MENSAGEM.claro : FUNDO_MENSAGEM.escuro;
            const v = variacoesDaCor(hex, claro);
            assert.ok(razaoContrasteRGB(rgb(v.texto), fundo) >= 4.5, `${hex} texto ${claro}`);
            assert.ok(razaoContrasteRGB(rgb(v.marca), fundo) >= 3, `${hex} marca ${claro}`);
            const sobre = v.sobre === "#ffffff" ? [255, 255, 255] : [21, 21, 26];
            assert.ok(razaoContrasteRGB(sobre, rgb(v.texto)) >= 4.5, `${hex} sobre ${claro}`);
        }
    }
});

test("cor legível preserva a matiz quando já é legível", () => {
    assert.equal(variacoesDaCor("#960505", true).texto, "rgb(150 5 5)");
    assert.equal(variacoesDaCor("#ffff00", false).texto, "rgb(255 255 0)");
});

test("estilo novo: cabeçalho neutro e faixa lateral; o legado continua com o cabeçalho colorido", () => {
    const novo = css.slice(css.indexOf(".t20a-chat-msg.t20a-chat-novo .message-header {"));
    assert.doesNotMatch(novo.slice(0, novo.indexOf("}")), /background:[^;]*--t20a-chat-cor/);
    assert.match(css, /\.t20a-chat-msg\.t20a-chat-novo \{[^}]*border-left: 4px solid var\(--t20a-chat-cor-marca/);
    const legado = css.slice(css.indexOf(".t20a-chat-msg .message-header {"));
    assert.match(legado.slice(0, legado.indexOf("}")), /background: color-mix\(in srgb, var\(--t20a-chat-cor\) 95%/);
});

test("estilo novo: botões com contorno, preenchidos só no hover com o texto calculado", () => {
    assert.match(css, /\.t20a-chat-novo footer button:hover:not\(:disabled\) \{\s*background: var\(--t20a-chat-cor\) !important;\s*color: var\(--t20a-chat-sobre-cor\)/);
});

test("estilo do chat é opção por usuário (novo/legado) e redesenha o chat", () => {
    const reg = main.slice(main.indexOf('register(MODULE_ID, "chatEstilo"'));
    const bloco = reg.slice(0, reg.indexOf("});"));
    assert.match(bloco, /scope: "client"/);
    assert.match(bloco, /default: "novo"/);
    assert.match(bloco, /legado:/);
    assert.match(bloco, /onChange: redesenharChat/);
    // Só o estilo novo reorganiza os cartões
    assert.match(main, /if \(estiloNovo\) \{[\s\S]*?estruturarCartoes\(message, root, actor\)[\s\S]*?\} else \{/);
});

test("encantos e melhorias do item viram uma linha com popover; poderes seguem listados", async () => {
    const js = await readFile(new URL("scripts/chat-cartoes.mjs", raiz), "utf8");
    assert.match(js, /ef\.flags\?\.\["t20-hayd-itens"\]/); // só o que o hayd-itens instala no item
    assert.match(js, /li\.classList\.add\("t20a-oculto"\)/); // linhas resumidas ficam, só escondidas
    // O popover acompanha a rolagem do chat e fecha quando a mensagem sai de vista
    assert.match(js, /addEventListener\("scroll", reposicionar, true\)/);
    assert.match(js, /aria-haspopup/);
});


test("magias separam Aprimoramentos (efeitos do próprio item) de Outros bônus, nos dois estilos", async () => {
    const js = await readFile(new URL("scripts/chat-cartoes.mjs", raiz), "utf8");
    assert.match(js, /item\?\.type === "magia"[\s\S]{0,80}separarAprimoramentos\(card, item\)/);
    // Aprimoramentos sempre acima: a lista original vira o primeiro grupo; Outros bônus vai ao fim
    assert.match(js, /lugar\.replaceWith\(grupoDeEfeitos\("t20a-efeitos-grupo--aprimoramentos"/);
    assert.match(js, /bloco\.append\(grupoDeEfeitos\("t20a-efeitos-grupo--outros"/);
    // Chamado fora do if/else do estilo
    const fim = main.indexOf("organizarEfeitosDeUso(message, root, actor)");
    assert.ok(fim > main.indexOf('root.style.setProperty("--t20a-chat-sombra", contraste.sombra);'));
});

test("dados do detalhamento ficam visíveis no tooltip escuro", () => {
    // Sem quadrinho claro atrás: número claro com contorno escuro, mesclado ao fundo
    assert.match(css, /\.t20a-chat-npc \.dice-tooltip \.dice-rolls \.roll \{\s*color: #f4f1ea;[^}]*text-shadow:/);
    assert.doesNotMatch(css, /\.dice-rolls \.roll \{\s*background-color: #e9e4d8/);
});

test("efeitos de uso: só os 5 primeiros à vista, o resto atrás de Mostrar mais (nos dois estilos)", async () => {
    const js = await readFile(new URL("scripts/chat-cartoes.mjs", raiz), "utf8");
    assert.match(js, /export const LIMITE_EFEITOS = 5;/);
    assert.match(js, /linhas\.slice\(LIMITE_EFEITOS\)/);
    assert.match(js, /limitarEfeitos\(card, message\);\s*\}\s*\}/); // dentro de organizarEfeitosDeUso, depois do resumo
    assert.match(css, /\.t20a-chat-msg \.card-upgrades \.t20a-excedente \{\s*display: none !important;/);
});

test("efeitos sem custo vão para o topo da lista, sem o 0 PM, antes do limite de 5", async () => {
    const js = await readFile(new URL("scripts/chat-cartoes.mjs", raiz), "utf8");
    assert.match(js, /\/\^\[\+-\]\?0\\s\*PM\\b\/i/);
    assert.match(js, /ul\.prepend\(\.\.\.gratis\)/);
    assert.match(js, /ordenarSemCusto\(card\);\s*limitarEfeitos\(card, message\);/);
    assert.match(css, /\.t20a-sem-custo \.row > b:first-child \{\s*display: none;/);
});