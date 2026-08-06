export type Lancamento = {
  id: string;
  tipo: "despesa" | "receita";
  valor: number;
  custo: number | null;
  vencimento: string | null; // ISO date, YYYY-MM-DD
};

export type Pagamento = {
  id: string;
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  valor_liquido: number;
  data_pagamento: string;
};

export type StatusLancamento = "atrasado" | "aberto" | "parcial" | "quitado";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalPago(pagamentos: Pagamento[], lancamentoId: string): number {
  return round2(
    pagamentos
      .filter((p) => p.lancamento_id === lancamentoId)
      .reduce((acc, p) => acc + p.valor, 0)
  );
}

export function saldo(lancamento: Lancamento, pagamentos: Pagamento[]): number {
  return round2(lancamento.valor - totalPago(pagamentos, lancamento.id));
}

export function status(
  lancamento: Lancamento,
  pagamentos: Pagamento[],
  hoje: string
): StatusLancamento {
  const pago = totalPago(pagamentos, lancamento.id);
  const restante = saldo(lancamento, pagamentos);
  // valor === 0 means "not yet defined" (see reference UX), not "already settled",
  // so it deliberately falls through to atrasado/parcial/aberto instead of quitado.
  if (lancamento.valor > 0 && restante <= 0.004) return "quitado";
  if (lancamento.vencimento && lancamento.vencimento < hoje) return "atrasado";
  if (pago > 0) return "parcial";
  return "aberto";
}

export function valorLiquido(valor: number, taxa: number | null): number {
  return round2(valor - (taxa ?? 0));
}

export function margem(lancamento: Lancamento): number | null {
  if (lancamento.custo == null) return null;
  return round2(lancamento.valor - lancamento.custo);
}

// Ganho na revenda de um item de permuta: preço de venda menos o que ele
// valia quando entrou (valor_estimado) - mesma lógica de margem() acima,
// mas para itens de permuta em vez de lançamentos.
export function lucroPermuta(item: { valor_venda: number | null; valor_estimado: number | null }): number {
  return round2((item.valor_venda ?? 0) - (item.valor_estimado ?? 0));
}
