import { describe, it, expect } from "vitest";
import { saldoDevedor, movimentosDoFornecedor, temCompraEmAberto } from "./fornecedores";
import type { LancamentoRow, PagamentoRow } from "./types";

function lanc(overrides: Partial<LancamentoRow>): LancamentoRow {
  return {
    id: "l1",
    descricao: "Compra de peças",
    tipo: "despesa",
    categoria_id: null,
    cliente_id: null,
    fornecedor_id: "f1",
    conta_financeira_id: null,
    equipamento_id: null,
    valor: 1000,
    custo: null,
    vencimento: "2026-10-30",
    competencia: null,
    recorrencia: null,
    serie_id: null,
    parcela_numero: null,
    observacao: null,
    ajuste_saldo: false,
    transferencia_id: null,
    movimento_fornecedor: "compra",
    created_at: "2026-10-01T15:00:00Z",
    idempotency_key: null,
    ...overrides,
  };
}

function pag(overrides: Partial<PagamentoRow>): PagamentoRow {
  return {
    id: "p1",
    lancamento_id: "l1",
    valor: 400,
    taxa: null,
    valor_liquido: 400,
    forma_pagamento: null,
    conta_financeira_id: "conta-1",
    data_pagamento: "2026-10-05",
    comprovante_url: null,
    observacao: null,
    ...overrides,
  };
}

describe("saldoDevedor", () => {
  it("soma o que falta das compras", () => {
    expect(saldoDevedor("f1", [lanc({})], [pag({ valor: 400 })])).toBe(600);
  });

  it("soma ajuste de despesa e subtrai ajuste de receita", () => {
    const lancamentos = [
      lanc({ id: "aj-mais", movimento_fornecedor: "ajuste", tipo: "despesa", valor: 6500, vencimento: null }),
      lanc({ id: "aj-menos", movimento_fornecedor: "ajuste", tipo: "receita", valor: 500, vencimento: null }),
    ];
    expect(saldoDevedor("f1", lancamentos, [])).toBe(6000);
  });

  it("quitação abate sem somar", () => {
    const lancamentos = [
      lanc({ id: "aj", movimento_fornecedor: "ajuste", valor: 6500, vencimento: null }),
      lanc({ id: "quit", movimento_fornecedor: "quitacao", valor: 2000 }),
    ];
    const pagamentos = [pag({ id: "p-quit", lancamento_id: "quit", valor: 2000 })];
    expect(saldoDevedor("f1", lancamentos, pagamentos)).toBe(4500);
  });

  it("quitação abate só o que foi pago de verdade", () => {
    const lancamentos = [
      lanc({ id: "aj", movimento_fornecedor: "ajuste", valor: 6500, vencimento: null }),
      lanc({ id: "quit", movimento_fornecedor: "quitacao", valor: 2000 }),
    ];
    const pagamentos = [pag({ id: "p-quit", lancamento_id: "quit", valor: 500 })];
    expect(saldoDevedor("f1", lancamentos, pagamentos)).toBe(6000);
  });

  it("ignora lançamentos de outro fornecedor", () => {
    expect(saldoDevedor("f1", [lanc({ fornecedor_id: "f2" })], [])).toBe(0);
  });

  it("fornecedor sem movimento nenhum deve zero", () => {
    expect(saldoDevedor("f1", [], [])).toBe(0);
  });

  it("compra quitada não deixa saldo", () => {
    expect(saldoDevedor("f1", [lanc({})], [pag({ valor: 1000 })])).toBe(0);
  });
});

describe("movimentosDoFornecedor", () => {
  // 2026-10-27T23:30:00-03:00 é 2026-10-28T02:30:00Z. Lido como UTC cru, o
  // dia seria 28 e a antiguidade daria zero; em São Paulo a compra entrou no
  // dia 27, então faz um dia.
  it("conta a antiguidade pelo dia local de created_at, não pelo UTC cru", () => {
    const compra = lanc({ created_at: "2026-10-28T02:30:00Z" });
    const [linha] = movimentosDoFornecedor("f1", [compra], [], "2026-10-28");
    expect(linha.diasEmAberto).toBe(1);
  });

  it("ordena os em aberto do mais antigo para o mais novo, quitados por último", () => {
    const lancamentos = [
      lanc({ id: "quitadaAntiga", created_at: "2026-09-01T15:00:00Z" }),
      lanc({ id: "abertaNova", created_at: "2026-10-20T15:00:00Z" }),
      lanc({ id: "abertaAntiga", created_at: "2026-10-02T15:00:00Z" }),
    ];
    const pagamentos = [pag({ id: "p-quit", lancamento_id: "quitadaAntiga", valor: 1000 })];
    const ordem = movimentosDoFornecedor("f1", lancamentos, pagamentos, "2026-10-28").map((l) => l.lancamento.id);
    expect(ordem).toEqual(["abertaAntiga", "abertaNova", "quitadaAntiga"]);
  });

  it("filtra por período usando a data de criação", () => {
    const lancamentos = [
      lanc({ id: "setembro", created_at: "2026-09-20T15:00:00Z" }),
      lanc({ id: "outubro-1", created_at: "2026-10-02T15:00:00Z" }),
      lanc({ id: "outubro-2", created_at: "2026-10-20T15:00:00Z" }),
    ];
    const linhas = movimentosDoFornecedor("f1", lancamentos, [], "2026-10-28", {
      de: "2026-10-01",
      ate: "2026-10-31",
    });
    expect(linhas.map((l) => l.lancamento.id)).toEqual(["outubro-1", "outubro-2"]);
  });

  it("traz falta e situação de cada linha", () => {
    const [linha] = movimentosDoFornecedor("f1", [lanc({})], [pag({ valor: 400 })], "2026-10-28");
    expect(linha.falta).toBe(600);
    expect(linha.status).toBe("parcial");
  });

  // Um ajuste que diminui a dívida é gravado como receita. Se a linha
  // mostrasse "falta 500", pareceria algo a receber do fornecedor - e é o
  // contrário: é abatimento da dívida. Na tela ele aparece negativo.
  it("ajuste que diminui a dívida aparece como abatimento, não como valor a receber", () => {
    const ajuste = lanc({
      id: "aj-menos",
      movimento_fornecedor: "ajuste",
      tipo: "receita",
      valor: 500,
      vencimento: null,
    });
    const [linha] = movimentosDoFornecedor("f1", [ajuste], [], "2026-10-28");
    expect(linha.falta).toBe(-500);
  });

  it("ajuste que aumenta a dívida aparece pelo valor cheio", () => {
    const ajuste = lanc({
      id: "aj-mais",
      movimento_fornecedor: "ajuste",
      tipo: "despesa",
      valor: 6500,
      vencimento: null,
    });
    const [linha] = movimentosDoFornecedor("f1", [ajuste], [], "2026-10-28");
    expect(linha.falta).toBe(6500);
  });

  it("não traz lançamento de outro fornecedor", () => {
    expect(movimentosDoFornecedor("f1", [lanc({ fornecedor_id: "f2" })], [], "2026-10-28")).toEqual([]);
  });
});

// É a pergunta que decide se "paguei R$ 2.000 pro Carlos" pode entrar como
// quitação solta: se há compra lançada em aberto, o certo é dar baixa nela,
// senão a mesma despesa conta duas vezes no DRE e a lista fica discordando
// do topo da tela.
describe("temCompraEmAberto", () => {
  it("é verdadeiro quando há compra com saldo", () => {
    expect(temCompraEmAberto("f1", [lanc({})], [pag({ valor: 400 })])).toBe(true);
  });

  it("é falso quando todas as compras estão quitadas", () => {
    expect(temCompraEmAberto("f1", [lanc({})], [pag({ valor: 1000 })])).toBe(false);
  });

  it("ajuste em aberto não conta como compra em aberto", () => {
    const ajuste = lanc({ id: "aj", movimento_fornecedor: "ajuste", valor: 6500, vencimento: null });
    expect(temCompraEmAberto("f1", [ajuste], [])).toBe(false);
  });

  it("compra em aberto de outro fornecedor não conta", () => {
    expect(temCompraEmAberto("f1", [lanc({ fornecedor_id: "f2" })], [])).toBe(false);
  });
});
