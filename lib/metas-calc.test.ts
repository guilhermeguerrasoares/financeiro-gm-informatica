import { describe, it, expect } from "vitest";
import { calcularProgressoMetas } from "./metas-calc";
import type { LancamentoRow, Meta, PagamentoRow } from "./types";

function lancamento(overrides: Partial<LancamentoRow>): LancamentoRow {
  return {
    id: "l1",
    descricao: "teste",
    tipo: "receita",
    categoria_id: null,
    cliente_id: null,
    fornecedor_id: null,
    conta_financeira_id: null,
    equipamento_id: null,
    valor: 100,
    custo: null,
    vencimento: "2026-08-10",
    competencia: null,
    recorrencia: null,
    observacao: null,
    ...overrides,
  };
}

function pagamento(overrides: Partial<PagamentoRow>): PagamentoRow {
  return {
    id: "p1",
    lancamento_id: "l1",
    valor: 100,
    taxa: null,
    valor_liquido: 100,
    forma_pagamento: null,
    data_pagamento: "2026-08-10",
    comprovante_url: null,
    observacao: null,
    ...overrides,
  };
}

function meta(overrides: Partial<Meta>): Meta {
  return {
    id: "m1",
    nome: "teste",
    tipo: "meta",
    metrica: "faturamento",
    categoria_id: null,
    unidade: "valor",
    valor_alvo: 1000,
    ativo: true,
    ...overrides,
  };
}

const periodo = { inicio: "2026-08-01", fim: "2026-08-31" };

describe("calcularProgressoMetas", () => {
  it("ignores metas inativas", () => {
    const r = calcularProgressoMetas([meta({ ativo: false })], [], [], periodo);
    expect(r).toHaveLength(0);
  });

  it("meta de faturamento em valor: progresso proporcional ao alvo", () => {
    const l = lancamento({ id: "l1", tipo: "receita" });
    const p = pagamento({ id: "p1", lancamento_id: "l1", valor: 500 });
    const r = calcularProgressoMetas([meta({ metrica: "faturamento", unidade: "valor", valor_alvo: 1000 })], [l], [p], periodo);
    expect(r[0].atualValor).toBe(500);
    expect(r[0].progresso).toBe(50);
    expect(r[0].status).toBe("ok");
  });

  it("meta de faturamento atingida quando progresso >= 100", () => {
    const l = lancamento({ id: "l1", tipo: "receita" });
    const p = pagamento({ id: "p1", lancamento_id: "l1", valor: 1200 });
    const r = calcularProgressoMetas([meta({ metrica: "faturamento", unidade: "valor", valor_alvo: 1000 })], [l], [p], periodo);
    expect(r[0].status).toBe("atingida");
  });

  it("limite de permutas em percentual do faturamento: dentro do limite", () => {
    const receita = lancamento({ id: "l1", tipo: "receita" });
    const pagReceita = pagamento({ id: "p1", lancamento_id: "l1", valor: 1000, forma_pagamento: "pix" });
    const pagPermuta = pagamento({ id: "p2", lancamento_id: "l1", valor: 50, forma_pagamento: "permuta" });
    const r = calcularProgressoMetas(
      [meta({ tipo: "limite", metrica: "permutas", unidade: "percentual", valor_alvo: 10 })],
      [receita],
      [pagReceita, pagPermuta],
      periodo
    );
    // faturamento = 1000 + 50 = 1050 (todo pagamento de um lançamento de receita conta);
    // permutas = 50 -> 50/1050 ≈ 4.76% do faturamento, dentro do limite de 10%
    expect(r[0].atualPercentual).toBeCloseTo(4.76, 1);
    expect(r[0].status).toBe("ok");
  });

  it("limite de permutas estourado quando passa do percentual alvo", () => {
    const receita = lancamento({ id: "l1", tipo: "receita" });
    const pagReceita = pagamento({ id: "p1", lancamento_id: "l1", valor: 500, forma_pagamento: "pix" });
    const pagPermuta = pagamento({ id: "p2", lancamento_id: "l1", valor: 500, forma_pagamento: "permuta" });
    const r = calcularProgressoMetas(
      [meta({ tipo: "limite", metrica: "permutas", unidade: "percentual", valor_alvo: 10 })],
      [receita],
      [pagReceita, pagPermuta],
      periodo
    );
    // permutas = 500, faturamento = 1000 -> 50%, muito acima do limite de 10%
    expect(r[0].atualPercentual).toBe(50);
    expect(r[0].status).toBe("estourado");
  });

  it("limite de categoria em atenção entre 80% e 100% do alvo", () => {
    const despesa = lancamento({ id: "l1", tipo: "despesa", categoria_id: "cat-aluguel" });
    const pag = pagamento({ id: "p1", lancamento_id: "l1", valor: 850 });
    const r = calcularProgressoMetas(
      [meta({ tipo: "limite", metrica: "categoria", categoria_id: "cat-aluguel", unidade: "valor", valor_alvo: 1000 })],
      [despesa],
      [pag],
      periodo
    );
    expect(r[0].progresso).toBe(85);
    expect(r[0].status).toBe("atencao");
  });

  it("ignora pagamentos fora do período", () => {
    const l = lancamento({ id: "l1", tipo: "receita" });
    const p = pagamento({ id: "p1", lancamento_id: "l1", valor: 999, data_pagamento: "2026-07-15" });
    const r = calcularProgressoMetas([meta({ metrica: "faturamento", unidade: "valor", valor_alvo: 1000 })], [l], [p], periodo);
    expect(r[0].atualValor).toBe(0);
  });
});
