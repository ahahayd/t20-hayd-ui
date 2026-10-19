import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const neon = await readFile(new URL("styles/theme.css", raiz), "utf8");
const darkMode = await readFile(new URL("styles/theme-darkmode.css", raiz), "utf8");
const main = await readFile(new URL("scripts/main.mjs", raiz), "utf8");
const ptBR = JSON.parse(await readFile(new URL("lang/pt-BR.json", raiz), "utf8"));

test("Dark Neon exibe a arte do cabeçalho recolorida pela cor de destaque", () => {
    assert.match(neon,
        /\.t20a\.t20a-player-sheet \.sheet-header::before\s*\{[^}]*header-tormenta\.webp[^}]*background-blend-mode:\s*color/s);
});

test("Dark Neon sobrepõe a navbar à arte só na ficha padrão", () => {
    assert.match(neon,
        /\.t20a\.t20a-player-sheet-base \.window-content form\.base > \.sheet-tabs\s*\{[^}]*position:\s*absolute/s);
    assert.match(neon,
        /\.t20a\.t20a-player-sheet-base form\.base > \.sheet-body > \.tab\.attributes \.sheet-header\s*\{[^}]*--t20a-navbar-height/s);
    assert.match(neon,
        /form\.base > \.sheet-body > \.tab:not\(\.attributes\)\s*\{[^}]*padding-top:\s*calc\(var\(--t20a-navbar-height/s);
    assert.doesNotMatch(neon, /form\.tabbed[^}]*position:\s*absolute/s);
});

test("Dark Neon não separa header e navbar na ficha em abas", () => {
    assert.match(neon, /\.t20a \.sheet-header \+ :not\(\.sheet-tabs\)/);
    assert.doesNotMatch(neon, /\.t20a \.sheet-header \+ \*/);
    assert.match(neon,
        /\.t20a\.t20a-player-sheet \.window-content form\.tabbed > \.sheet-header\s*\{[^}]*margin-bottom:\s*0/s);
});

test("opção de arte original remove a recoloração nos dois temas", () => {
    for (const [css, prefixo] of [[neon, "\\.t20a"], [darkMode, "\\.t20a-dm"]]) {
        const regra = new RegExp(
            `${prefixo}\\.t20a-player-sheet\\.t20a-arte-original \\.sheet-header::before\\s*\\{[^}]*` +
            `background-image:\\s*url\\("\\.\\./assets/fundos/header-tormenta\\.webp"\\);[^}]*background-blend-mode:\\s*normal`, "s");
        assert.match(css, regra);
    }
});

test("ficha marca a classe da arte original a partir da flag do ator", () => {
    assert.match(main, /const FLAG_ARTE_ORIGINAL = "arteOriginal"/);
    assert.match(main,
        /classList\.toggle\("t20a-arte-original",\s*ehFichaJogador && doc\.getFlag\(MODULE_ID, FLAG_ARTE_ORIGINAL\) === true\)/);
});

const ficha = await readFile(new URL("scripts/ficha-hayd.mjs", raiz), "utf8");
const fichaCss = await readFile(new URL("styles/ficha-hayd.css", raiz), "utf8");
const fichaHbs = await readFile(new URL("templates/ficha/ficha.hbs", raiz), "utf8");

test("opção de ocultar a arte remove o pseudo-elemento nos três temas", async () => {
    const light = await readFile(new URL("styles/theme-lightmode.css", raiz), "utf8");
    for (const [css, prefixo] of [[neon, "\\.t20a"], [darkMode, "\\.t20a-dm"], [light, "\\.t20a-lm"]]) {
        assert.match(css, new RegExp(
            `${prefixo}\\.t20a-player-sheet\\.t20a-sem-arte \\.sheet-header::before\\s*\\{[^}]*content:\\s*none`, "s"));
    }
});

test("tema antigo marca as classes de sem arte e arte original pelas flags do ator", () => {
    assert.match(main, /const FLAG_SEM_ARTE = "semArte"/);
    assert.match(main,
        /classList\.toggle\("t20a-sem-arte",\s*ehFichaJogador && doc\.getFlag\(MODULE_ID, FLAG_SEM_ARTE\) === true\)/);
});

test("diálogo Cor da Ficha não tem mais as opções da arte", () => {
    assert.doesNotMatch(main, /name="semArte"|name="arteOriginal"/);
    assert.equal(ptBR.T20A.Dialog.SemArte, undefined);
    assert.equal(ptBR.T20A.Dialog.ArteOriginal, undefined);
});

test("Configurar ficha oferece as cinco opções de arte numa só lista", () => {
    const chaves = [...ficha.matchAll(/^    "?([\w-]+)"?: \{ rotulo: "T20A\.Ficha\.(\w+)", flags: (\{[^}]*\}) \}/gm)];
    assert.deepEqual(chaves.map((m) => m[1]),
        ["tormenta", "tormenta-original", "deuses-positivo", "deuses-negativo", "sem-arte"]);
    // Gravuras recoloridas (padrão) e originais usam a flag arteOriginal; "Sem arte" é a flag semArte
    assert.match(chaves[0][3], /arteCabecalho: "tormenta", arteOriginal: false, semArte: false/);
    assert.match(chaves[1][3], /arteCabecalho: "tormenta", arteOriginal: true, semArte: false/);
    assert.match(chaves[4][3], /semArte: true/);
    for (const [, , rotulo] of chaves) assert.ok(ptBR.T20A.Ficha[rotulo], rotulo);
    assert.equal(ptBR.T20A.Ficha.ArteTormenta, "Gravuras da Tormenta (Cor da ficha)");
    assert.equal(ptBR.T20A.Ficha.ArteTormentaOriginal, "Gravuras da Tormenta");
    // Grava todas as flags da opção num único update; sem caixas separadas
    assert.match(ficha, /grupoArte\.className = "form-group hf-config-arte"/);
    assert.match(ficha, /doc\.update\(Object\.fromEntries\(Object\.entries\(flags\)\.map/);
    assert.doesNotMatch(ficha, /hf-config-sem-arte|hf-config-arte-original/);
    // Deuses só com a Ficha Hayd
    assert.match(ficha, /if \(opcao\.value\.startsWith\("deuses-"\)\) opcao\.disabled = !fichaHayd/);
});

test("a lista abre na opção que corresponde às flags atuais", () => {
    assert.match(ficha, /if \(actor\.getFlag\(MODULE_ID, "semArte"\) === true\) return "sem-arte"/);
    assert.match(ficha, /actor\.getFlag\(MODULE_ID, "arteOriginal"\) === true \? "tormenta-original" : "tormenta"/);
});

test("valor desconhecido na flag volta às Gravuras da Tormenta", () => {
    assert.match(ficha, /ARTES_CABECALHO\.includes\(arte\) \? arte : "tormenta"/);
    assert.match(ficha, /arte: lerArteCabecalho\(actor\)/);
    assert.match(fichaHbs, /class="hf-topo hf-arte-\{\{hf\.arte\}\}/);
});

test("artes dos Deuses cobrem o cabeçalho, sem espelhos nem recoloração", () => {
    for (const lado of ["positivo", "negativo"]) {
        assert.match(fichaCss, new RegExp(
            `\\.hf-arte-deuses-${lado} \\.hf-banner::before[^{]*\\{[^}]*url\\("\\.\\./assets/fundos/header-deuses-${lado}\\.webp"\\)`, "s"));
    }
    assert.match(fichaCss,
        /\.hf-arte-deuses-positivo \.hf-banner::after,[^{]*\.hf-arte-deuses-negativo \.hf-banner::after \{ display: none; \}/s);
});

test("artes dos Deuses descem um pouco além do cabeçalho, por trás do conteúdo", () => {
    // O prolongamento mora no corpo (o topo fica numa camada acima dele) e some com "Sem arte"
    for (const lado of ["positivo", "negativo"]) {
        assert.ok(fichaCss.includes(`.hf-arte-deuses-${lado}:not(.hf-sem-arte) + .hf-corpo::before`), lado);
    }
    // A última regra com esse seletor é a do prolongamento (a anterior só escolhe a imagem)
    const regra = [...fichaCss.matchAll(/\.hf-arte-deuses-negativo:not\(\.hf-sem-arte\) \+ \.hf-corpo::before \{([^}]*)\}/g)].at(-1)?.[1] ?? "";
    assert.match(regra, /z-index: -1;/);
    assert.match(regra, /pointer-events: none;/);
    assert.match(regra, /mask-image: linear-gradient\(to bottom, #000, transparent\)/);
    // Continua a imagem de onde o cabeçalho parou: mesma escala, deslocada pela altura dele
    assert.match(regra, /background-position: center calc\(-1 \* var\(--hf-topo-h, 265px\)\)/);
    assert.match(ficha, /form\.style\.setProperty\("--hf-topo-h", `\$\{topo\.offsetHeight\}px`\)/);
    assert.match(ficha, /this\._obsTamanho\.observe\(topo\)/);
});

test("Cor da Ficha: barra da janela nas ameaças e nas configurações do personagem, não na ficha dele", () => {
    // Fichas de personagem não levam o botão; as de ameaça (npc) sim
    assert.match(main, /if \(!podeTrocarCor\(doc\) \|\| doc\.type === "character"\) return;/);
    // Configurações de Personagem (AppV1): botão de cabeçalho, como o Fechar
    assert.match(main, /Hooks\.on\("getActorSettingsHeaderButtons", \(app, buttons\) => \{/);
    // Configurar ficha (AppV2): ícone na barra, antes do fechar
    assert.match(main, /botao\.className = "header-control icon fa-solid fa-palette t20a-config"/);
    assert.match(main, /if \(fechar\) fechar\.before\(botao\)/);
    // Nada dentro do conteúdo das janelas
    assert.doesNotMatch(main, /t20a-botao-cor|inserirBotaoCor/);
});
