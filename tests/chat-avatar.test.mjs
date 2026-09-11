import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const css = await readFile(new URL("styles/theme.css", raiz), "utf8");
const regra = css.match(/\.t20a-chat-avatar\s*\{([^}]*)\}/)?.[1] ?? "";

test("avatar do chat não tem contorno", () => {
    assert.ok(regra, "regra .t20a-chat-avatar não encontrada");
    assert.match(regra, /border:\s*none/);
    assert.match(regra, /outline:\s*none/);
    assert.doesNotMatch(regra, /border:\s*\d/);
});

test("arte do avatar cabe inteira no quadrado, sem cortar retratos verticais", () => {
    assert.match(regra, /object-fit:\s*contain/);
    assert.doesNotMatch(regra, /object-fit:\s*cover/);
});

test("sombra do avatar acompanha o recorte da imagem (drop-shadow)", () => {
    assert.match(regra, /filter:\s*drop-shadow\(/);
    assert.match(regra, /box-shadow:\s*none/);
});
