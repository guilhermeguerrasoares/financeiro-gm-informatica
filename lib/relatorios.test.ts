import { describe, it, expect } from "vitest";
import { agruparPorFrenteNegocio, agruparPorCategoria } from "./relatorios-calc";
import type { LancamentoRow, PagamentoRow, Categoria } from "./types";

const categorias: Categoria[] = [
  { id: "cat-pecas", nome: "Venda de Peças", grupo_dre: "Receita Bruta", frente_negocio: "pecas_acessorios" },
  { id: "cat-pc", nome: "Venda de Computadores", grupo_dre: "Receita Bruta", frente_negocio: "computadores" },
  { id: "cat-fornecedores", nome: "Fornecedores", grupo_dre: "Custo de Produtos e Serviços", frente_negocio: null },
];

const lancamentos: LancamentoRow[] = [
  { id: "l1", descricao: "Venda 1", tipo: "receita", categoria_id: "cat-pecas", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 100, custo: 40, vencimento: null, competencia: null, recorrencia: null, observacao: null },
  { id: "l2", descricao: "Venda 2", tipo: "receita", categoria_id: "cat-pc", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 500, custo: 300, vencimento: null, competencia: null, recorrencia: null, observacao: null },
  { id: "l3", descricao: "Compra de peças", tipo: "despesa", categoria_id: "cat-fornecedores", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 200, custo: null, vencimento: "2020-01-01", competencia: null, recorrencia: null, observacao: null },
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
