import { round2 } from "./calculations";

// Saldo de conta é dinheiro que efetivamente entrou ou saiu, então quem
// move o saldo é o PAGAMENTO (a baixa), não o lançamento: é na baixa que
// se escolhe de qual conta saiu / para qual conta entrou. Um lançamento
// ainda em aberto não mexe em saldo nenhum, e uma conta paga metade em
// dinheiro e metade no banco debita cada conta pela sua parte.

export type ContaSaldo = { id: string; saldo_inicial: number };

export type LancamentoSaldo = { id: string; tipo: "despesa" | "receita" };

export type PagamentoSaldo = {
  lancamento_id: string;
  valor: number;
  conta_financeira_id: string | null;
  forma_pagamento: string | null;
  data_pagamento: string;
};

/**
 * Saldo atual de cada conta: `saldo_inicial` mais tudo que foi recebido,
 * menos tudo que foi pago naquela conta.
 *
 * @param ate Data limite "YYYY-MM-DD" (inclusiva). Quando informada, é o
 *   extrato da conta como estava naquele dia - pagamentos posteriores ficam
 *   de fora. Sem ela, considera todo o histórico.
 */
export function saldosPorConta(
  contas: ContaSaldo[],
  lancamentos: LancamentoSaldo[],
  pagamentos: PagamentoSaldo[],
  ate?: string
): Record<string, number> {
  const tipoPorLancamento = new Map(lancamentos.map((l) => [l.id, l.tipo]));
  const saldos = new Map(contas.map((c) => [c.id, c.saldo_inicial]));

  for (const p of pagamentos) {
    if (!p.conta_financeira_id) continue;

    const acumulado = saldos.get(p.conta_financeira_id);
    // Conta apagada depois do pagamento (a FK é "on delete set null", mas o
    // dado pode ter vindo de outro caminho): não inventa uma conta nova.
    if (acumulado === undefined) continue;

    // Permuta não é caixa - é mercadoria que entrou no estoque. Só vira
    // saldo quando o item é revendido, e aí a venda gera o próprio pagamento.
    if (p.forma_pagamento === "permuta") continue;

    if (ate && p.data_pagamento > ate) continue;

    const tipo = tipoPorLancamento.get(p.lancamento_id);
    // Pagamento sem lançamento por trás não tem como saber se soma ou
    // subtrai - ignorar é mais seguro que chutar um dos dois.
    if (!tipo) continue;

    saldos.set(p.conta_financeira_id, acumulado + (tipo === "receita" ? p.valor : -p.valor));
  }

  return Object.fromEntries([...saldos].map(([id, valor]) => [id, round2(valor)]));
}

export function saldoConsolidado(
  contas: ContaSaldo[],
  lancamentos: LancamentoSaldo[],
  pagamentos: PagamentoSaldo[],
  ate?: string
): number {
  const saldos = saldosPorConta(contas, lancamentos, pagamentos, ate);
  return round2(Object.values(saldos).reduce((acc, s) => acc + s, 0));
}
