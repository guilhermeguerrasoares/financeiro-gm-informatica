import { describe, it, expect } from "vitest";
import { metricasCliente } from "./ltv";
import type { LancamentoRow, PagamentoRow } from "./types";

const lancamentos: LancamentoRow[] = [
  { id: "l1", descricao: "Conserto 1", tipo: "receita", categoria_id: null, cliente_id: "c1", fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 200, custo: null, vencimento: "2026-06-01", competencia: "2026-06", recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, created_at: "2026-01-01T00:00:00Z" },
  { id: "l2", descricao: "Conserto 2", tipo: "receita", categoria_id: null, cliente_id: "c1", fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 300, custo: null, vencimento: "2026-07-01", competencia: "2026-07", recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, created_at: "2026-01-01T00:00:00Z" },
  { id: "l3", descricao: "Peça avulsa", tipo: "despesa", categoria_id: null, cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 50, custo: null, vencimento: null, competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, created_at: "2026-01-01T00:00:00Z" },
];

const pagamentos: PagamentoRow[] = [
  { id: "p1", lancamento_id: "l1", valor: 200, taxa: null, valor_liquido: 200, forma_pagamento: "pix", conta_financeira_id: null, data_pagamento: "2026-06-01", comprovante_url: null, observacao: null },
  { id: "p2", lancamento_id: "l2", valor: 300, taxa: null, valor_liquido: 300, forma_pagamento: "pix", conta_financeira_id: null, data_pagamento: "2026-07-01", comprovante_url: null, observacao: null },
];

describe("metricasCliente", () => {
  it("computes LTV as the sum of paid revenue lancamentos for that client", () => {
    const m = metricasCliente("c1", lancamentos, pagamentos);
    expect(m.ltv).toBe(500);
  });

  it("computes ticket medio as LTV divided by number of paid lancamentos", () => {
    const m = metricasCliente("c1", lancamentos, pagamentos);
    expect(m.ticketMedio).toBe(250);
  });

  it("counts frequencia as the number of distinct paid lancamentos", () => {
    const m = metricasCliente("c1", lancamentos, pagamentos);
    expect(m.frequencia).toBe(2);
  });

  it("returns zeroes for a client with no lancamentos", () => {
    const m = metricasCliente("desconhecido", lancamentos, pagamentos);
    expect(m).toEqual({ ltv: 0, ticketMedio: 0, frequencia: 0 });
  });
});
