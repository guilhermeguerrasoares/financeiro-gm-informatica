import { describe, it, expect } from "vitest";
import { agruparPorFrenteNegocio, agruparPorCategoria } from "./relatorios-calc";
import type { LancamentoRow, PagamentoRow, Categoria } from "./types";

const categorias: Categoria[] = [
  { id: "cat-pecas", nome: "Venda de Peças", grupo_dre: "Receita Bruta", frente_negocio: "pecas_acessorios" },
  { id: "cat-pc", nome: "Venda de Computadores", grupo_dre: "Receita Bruta", frente_negocio: "computadores" },
  { id: "cat-fornecedores", nome: "Fornecedores", grupo_dre: "Custo de Produtos e Serviços", frente_negocio: null },
];

const lancamentos: LancamentoRow[] = [
  { id: "l1", descricao: "Venda 1", tipo: "receita", categoria_id: "cat-pecas", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 100, custo: 40, vencimento: null, competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
  { id: "l2", descricao: "Venda 2", tipo: "receita", categoria_id: "cat-pc", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 500, custo: 300, vencimento: null, competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
  { id: "l3", descricao: "Compra de peças", tipo: "despesa", categoria_id: "cat-fornecedores", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 200, custo: null, vencimento: "2020-01-01", competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
];

const pagamentos: PagamentoRow[] = [];

describe("agruparPorFrenteNegocio", () => {
  it("sums valor and custo per frente de negocio and computes margem", () => {
    const resultado = agruparPorFrenteNegocio(lancamentos, categorias);
    expect(resultado.find((r) => r.frente === "pecas_acessorios")).toEqual({
      frente: "pecas_acessorios",
      receita: 100,
      custo: 40,
      margem: 60,
    });
    expect(resultado.find((r) => r.frente === "computadores")).toEqual({
      frente: "computadores",
      receita: 500,
      custo: 300,
      margem: 200,
    });
  });
});

describe("agruparPorCategoria", () => {
  it("only includes despesa lancamentos, ignoring receita ones", () => {
    const resultado = agruparPorCategoria(lancamentos, categorias, pagamentos, "2026-08-05");
    expect(resultado).toEqual([{ categoria: "Fornecedores", total: 200, pago: 0, vencido: 200 }]);
  });
});

// O ajuste de conciliação corrige o saldo da conta; ele não é uma despesa
// operacional nem uma venda, então não pode aparecer no DRE.
describe("ajuste de saldo", () => {
  const comAjuste: LancamentoRow[] = [
    ...lancamentos,
    { id: "aj-desp", descricao: "Ajuste de saldo", tipo: "despesa", categoria_id: null, cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 900, custo: null, vencimento: "2026-08-01", competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: true, transferencia_id: null, movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
    { id: "aj-rec", descricao: "Ajuste de saldo", tipo: "receita", categoria_id: "cat-pecas", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 700, custo: null, vencimento: "2026-08-01", competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: true, transferencia_id: null, movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
  ];

  it("não cria linha de despesa para ajuste de saldo", () => {
    const linhas = agruparPorCategoria(comAjuste, categorias, pagamentos, "2026-08-20");
    expect(linhas.find((l) => l.categoria === "Outros")).toBeUndefined();
    expect(linhas.reduce((acc, l) => acc + l.total, 0)).toBe(200);
  });

  it("não soma ajuste de saldo na receita por frente de negócio", () => {
    const linhas = agruparPorFrenteNegocio(comAjuste, categorias);
    expect(linhas.find((l) => l.frente === "pecas_acessorios")?.receita).toBe(100);
  });
});

// Transferência move dinheiro entre contas da própria loja: as duas pernas
// mexem em saldo, mas nenhuma delas é venda ou despesa. No DRE seriam um
// faturamento e um custo que nunca existiram.
describe("transferência entre contas", () => {
  const comTransferencia: LancamentoRow[] = [
    ...lancamentos,
    { id: "tr-saida", descricao: "Transferência", tipo: "despesa", categoria_id: "cat-fornecedores", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 1000, custo: null, vencimento: "2026-08-01", competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, transferencia_id: "t1", movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
    { id: "tr-entrada", descricao: "Transferência", tipo: "receita", categoria_id: "cat-pecas", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 1000, custo: null, vencimento: "2026-08-01", competencia: null, recorrencia: null, serie_id: null, parcela_numero: null, observacao: null, ajuste_saldo: false, transferencia_id: "t1", movimento_fornecedor: "compra" as const, created_at: "2026-01-01T00:00:00Z", idempotency_key: null },
  ];

  it("não soma a perna de saída nas despesas por categoria", () => {
    const linhas = agruparPorCategoria(comTransferencia, categorias, pagamentos, "2026-08-20");
    expect(linhas.reduce((acc, l) => acc + l.total, 0)).toBe(200);
  });

  it("não soma a perna de entrada na receita por frente de negócio", () => {
    const linhas = agruparPorFrenteNegocio(comTransferencia, categorias);
    expect(linhas.find((l) => l.frente === "pecas_acessorios")?.receita).toBe(100);
  });
});
