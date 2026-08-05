import { describe, it, expect } from "vitest";
import { agruparPorFrenteNegocio } from "./relatorios-calc";
import type { LancamentoRow, PagamentoRow, Categoria } from "./types";

const categorias: Categoria[] = [
  { id: "cat-pecas", nome: "Venda de Peças", grupo_dre: "Receita Bruta", frente_negocio: "pecas_acessorios" },
  { id: "cat-pc", nome: "Venda de Computadores", grupo_dre: "Receita Bruta", frente_negocio: "computadores" },
];

const lancamentos: LancamentoRow[] = [
  { id: "l1", descricao: "Venda 1", tipo: "receita", categoria_id: "cat-pecas", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 100, custo: 40, vencimento: null, competencia: null, recorrencia: null, observacao: null },
  { id: "l2", descricao: "Venda 2", tipo: "receita", categoria_id: "cat-pc", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 500, custo: 300, vencimento: null, competencia: null, recorrencia: null, observacao: null },
];

const pagamentos: PagamentoRow[] = [];

describe("agruparPorFrenteNegocio", () => {
  it("sums valor and custo per frente de negocio and computes margem", () => {
    const resultado = agruparPorFrenteNegocio(lancamentos, categorias, pagamentos);
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
