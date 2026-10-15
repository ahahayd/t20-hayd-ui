/**
 * Carteira de Tormenta 20: contas de gastar e receber moedas, sem nada de
 * Foundry (para poder testar no Node).
 *
 * 1 TL = 10 TO = 100 TP = 1000 TC.
 */

/** Da maior para a menor. */
export const MOEDAS = ["tl", "to", "tp", "tc"];
export const VALOR_TC = { tl: 1000, to: 100, tp: 10, tc: 1 };

const ler = (obj, m) => Math.max(0, Math.floor(Number(obj?.[m]) || 0));

export function totalEmTC(moedas) {
    return MOEDAS.reduce((soma, m) => soma + ler(moedas, m) * VALOR_TC[m], 0);
}

/**
 * Recebe: soma cada moeda como veio, sem trocar nada.
 * Retorna a carteira nova.
 */
export function receber(carteira, valor) {
    return Object.fromEntries(MOEDAS.map((m) => [m, ler(carteira, m) + ler(valor, m)]));
}

/**
 * Gasta `valor` da carteira como alguém faria na mão: cada moeda pedida sai
 * primeiro do mesmo tipo; o que faltar quebra a menor moeda maior que houver
 * (o troco volta nas moedas abaixo dela, o mínimo de moedas) e, se nem assim
 * der, junta moedas menores.
 * Ex.: 10 TO, gastar 5 TP → 9 TO e 5 TP.
 *
 * Retorna a carteira nova, ou null se o dinheiro não dá.
 */
export function gastar(carteira, valor) {
    const tem = Object.fromEntries(MOEDAS.map((m) => [m, ler(carteira, m)]));
    if (totalEmTC(tem) < totalEmTC(valor)) return null;

    // Troco de uma moeda quebrada, nas moedas abaixo dela (maiores primeiro)
    const devolver = (tc, abaixoDe) => {
        for (const m of MOEDAS.slice(MOEDAS.indexOf(abaixoDe) + 1)) {
            const n = Math.floor(tc / VALOR_TC[m]);
            tem[m] += n;
            tc -= n * VALOR_TC[m];
        }
    };

    for (const pedida of MOEDAS) {
        const quer = ler(valor, pedida);
        const daMesma = Math.min(tem[pedida], quer);
        tem[pedida] -= daMesma;
        let falta = (quer - daMesma) * VALOR_TC[pedida];
        if (!falta) continue;

        const i = MOEDAS.indexOf(pedida);
        const maiores = MOEDAS.slice(0, i).reverse(); // menor das maiores primeiro
        const menores = MOEDAS.slice(i + 1);          // maior das menores primeiro
        for (const m of [...maiores, ...menores]) {
            if (falta <= 0) break;
            const n = Math.min(tem[m], Math.ceil(falta / VALOR_TC[m]));
            tem[m] -= n;
            falta -= n * VALOR_TC[m];
            if (falta < 0) {
                devolver(-falta, m);
                falta = 0;
            }
        }
    }
    return tem;
}
