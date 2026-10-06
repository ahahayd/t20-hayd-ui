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

const integracao = await ler("scripts/integracao-gmtools.mjs");

test("os acessos do GMTools entram na ficha com o visual dela", () => {
    // Engenhocas na barra da aba Magias; automações numa barra própria em Efeitos
    assert.match(templates["aba-magias.hbs"], /engenhocas=true/);
    assert.match(templates["ferramentas.hbs"], /data-hf-acao="engenhocas"/);
    assert.match(templates["ferramentas.hbs"], /data-hf-acao="engenhocas-resetar"/);
    assert.match(templates["aba-efeitos.hbs"], /data-hf-acao="automacoes"/);
    // Os três botões precisam de listener, senão só decoram
    for (const acao of ["engenhocas", "engenhocas-resetar", "automacoes"]) {
        assert.ok(ficha.includes(`data-hf-acao='${acao}'`), `falta listener de ${acao}`);
    }
    assert.match(ficha, /hf\.gm = ferramentasGMTools\(actor\)/);
    // O painel que o GMTools injetaria sozinho fica escondido: um acesso só
    assert.match(css, /\.t20g-eng-painel,\s*\n\.hayd-ficha \.t20g-contadores-ficha \{\s*\n\s*display: none;/);
});

test("a aba Inventário mantém a estrutura de moedas que a Loja e o Enviar dinheiro procuram", () => {
    // t20-hayd-loja usa `.inventory-currency ul.currency`; o gmtools, `ul.currency`
    assert.match(templates["aba-inventario.hbs"], /class="hf-moedas inventory-currency"/);
    assert.match(templates["aba-inventario.hbs"], /<ul class="currency">/);
});

test("a ponte com o GMTools não assume que o módulo está ativo", () => {
    assert.match(integracao, /game\.modules\.get\(GMTOOLS_ID\)\?\.active/);
    assert.match(integracao, /temConteudo\?\./);
    assert.match(integracao, /temEngenhoqueiro\?\./);
});

test("os botões da barra de ferramentas não encolhem", () => {
    // A aba Magias tem sete controles na barra; se os de 30px puderem encolher,
    // a caixa aperta e o ícone sai do centro (foi o que aconteceu com o
    // "Resetar engenhocas"). Quem cede espaço é a busca.
    const regra = css.slice(css.indexOf(".hayd-ficha .hf-barra-ferramentas > .hf-botao-icone,"));
    assert.ok(regra.startsWith(".hayd-ficha .hf-barra-ferramentas > .hf-botao-icone,"),
        "falta a regra que impede os botões da barra de encolher");
    assert.match(regra.slice(0, regra.indexOf("}")), /flex: 0 0 auto;/);
    const busca = css.slice(css.indexOf(".hayd-ficha .hf-busca {"));
    assert.match(busca.slice(0, busca.indexOf("}")), /min-width: 0;/);
});

test("en.json repete o texto em português, como o resto do módulo", () => {
    // Este módulo é de mesa em português: lang/en.json existe só para o cliente
    // em inglês não cair em chaves cruas, e por isso traz o MESMO texto do
    // pt-BR. Traduzir uma chave só a faz aparecer em inglês no meio da ficha.
    const achatar = (obj, prefixo = "") => Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === "object" ? achatar(v, `${prefixo}${k}.`) : [[`${prefixo}${k}`, v]]);
    const en = Object.fromEntries(achatar(idiomas.en));
    for (const [chave, valor] of achatar(idiomas["pt-BR"])) {
        assert.equal(en[chave], valor, `${chave} divergiu entre pt-BR e en`);
    }
});

test("os rótulos dos acessos do GMTools existem nos dois idiomas", () => {
    for (const [id, dados] of Object.entries(idiomas)) {
        const ficha2 = dados.T20A.Ficha;
        for (const chave of ["Engenhocas", "EngenhocasDica", "EngenhocasResetar",
            "Automacoes", "AutomacoesDica", "AutomacoesErro"]) {
            assert.ok(ficha2[chave], `falta T20A.Ficha.${chave} em ${id}`);
        }
    }
});

test("o ícone dos botões só-de-ícone fica centrado apesar da margem do core", () => {
    // foundry2.css tem `body.game .app button > i { margin-right: 3px }` para
    // botões com ícone e rótulo; em botão só-de-ícone ela desloca o glifo 3px
    // para a esquerda. O seletor precisa passar de (0,2,3) — três classes —,
    // senão a regra do core ganha e a correção não faz nada.
    const i = css.indexOf(".hayd-ficha .hf-ficha .hf-botao-icone > i,");
    assert.ok(i > 0, "falta o reset da margem do ícone");
    const regra = css.slice(i, css.indexOf("}", i));
    assert.match(regra, /\.hayd-ficha \.hf-ficha \.hf-cadeado > i/);
    assert.match(regra, /\.hayd-ficha \.hf-ficha \.hf-botao > i/);
    assert.match(regra, /margin: 0;/);
    // Três classes em cada seletor: menos que isso perde para o core
    for (const sel of regra.split(",").slice(0, 3)) {
        assert.equal((sel.match(/\./g) ?? []).length, 3, `${sel.trim()} precisa de 3 classes`);
    }
});
