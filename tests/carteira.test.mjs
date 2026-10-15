import test from "node:test";
import assert from "node:assert/strict";
import { gastar, receber, totalEmTC } from "../scripts/carteira.mjs";

const c = (tl, to, tp, tc) => ({ tl, to, tp, tc });

test("receber soma cada moeda sem trocar", () => {
    assert.deepEqual(receber(c(0, 3, 9, 9), c(0, 1, 2, 3)), c(0, 4, 11, 12));
});

test("gastar da mesma moeda quando tem", () => {
    assert.deepEqual(gastar(c(0, 10, 5, 0), c(0, 2, 3, 0)), c(0, 8, 2, 0));
});

test("faltando a moeda, quebra a menor maior e devolve troco", () => {
    assert.deepEqual(gastar(c(0, 10, 0, 0), c(0, 0, 5, 0)), c(0, 9, 5, 0));
    assert.deepEqual(gastar(c(0, 10, 0, 0), c(0, 0, 0, 7)), c(0, 9, 9, 3));
    assert.deepEqual(gastar(c(1, 0, 0, 0), c(0, 0, 5, 0)), c(0, 9, 5, 0));
});

test("prefere quebrar ouro a platina", () => {
    assert.deepEqual(gastar(c(1, 1, 0, 0), c(0, 0, 5, 0)), c(1, 0, 5, 0));
});

test("sem moeda maior, junta as menores", () => {
    assert.deepEqual(gastar(c(0, 0, 15, 30), c(0, 1, 0, 0)), c(0, 0, 5, 30));
    assert.deepEqual(gastar(c(0, 0, 5, 60), c(0, 1, 0, 0)), c(0, 0, 0, 10));
});

test("dinheiro insuficiente devolve null", () => {
    assert.equal(gastar(c(0, 1, 0, 0), c(0, 1, 0, 1)), null);
});

test("o valor total sempre fecha", () => {
    const antes = c(2, 3, 4, 5);
    const valor = c(0, 7, 8, 9);
    assert.equal(totalEmTC(gastar(antes, valor)), totalEmTC(antes) - totalEmTC(valor));
});
