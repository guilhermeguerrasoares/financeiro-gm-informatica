import { describe, it, expect } from "vitest";
import { saldosPorConta, saldoConsolidado, type ContaSaldo, type PagamentoSaldo, type LancamentoSaldo } from "./saldos";

const contas: ContaSaldo[] = [
  { id: "c6", saldo_inicial: 1000 },
  { id: "caixa", saldo_inicial: 200 },
];

const lancamentos: LancamentoSaldo[] = [
  { id: "receita1", tipo: "receita" },
  { id: "receita2", tipo: "receita" },
  { id: "despesa1", tipo: "despesa" },
];

function pag(over: Partial<PagamentoSaldo> & { lancamento_id: string; valor: number }): PagamentoSaldo {
  return {
    conta_financeira_id: "c6",
    forma_pagamento: "dinheiro",
    data_pagamento: "2026-08-10",
    ...over,
  };
}

describe("saldosPorConta", () => {
  it("soma recebimentos e subtrai pagamentos na conta em que caíram", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 500 }),
      pag({ lancamento_id: "despesa1", valor: 120 }),
    ];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 1380, caixa: 200 });
  });

  it("credita cada pagamento na sua própria conta, não em todas", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 500, conta_financeira_id: "c6" }),
      pag({ lancamento_id: "receita2", valor: 300, conta_financeira_id: "caixa" }),
    ];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 1500, caixa: 500 });
  });

  it("ignora pagamento sem conta informada, em vez de somar na conta errada", () => {
    const pagamentos = [pag({ lancamento_id: "receita1", valor: 500, conta_financeira_id: null })];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 1000, caixa: 200 });
  });

  it("ignora pagamento em permuta: é item de estoque, não dinheiro em conta", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 500, forma_pagamento: "permuta" }),
      pag({ lancamento_id: "receita1", valor: 100 }),
    ];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 1100, caixa: 200 });
  });

  it("ignora pagamento de lançamento que não existe mais", () => {
    const pagamentos = [pag({ lancamento_id: "fantasma", valor: 500 })];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 1000, caixa: 200 });
  });

  it("com `ate`, considera só o que entrou até aquela data (extrato do dia)", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 500, data_pagamento: "2026-08-10" }),
      pag({ lancamento_id: "receita2", valor: 700, data_pagamento: "2026-08-20" }),
    ];
    expect(saldosPorConta(contas, lancamentos, pagamentos, "2026-08-15")).toEqual({ c6: 1500, caixa: 200 });
  });

  it("sem `ate`, considera todos os pagamentos", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 500, data_pagamento: "2026-08-10" }),
      pag({ lancamento_id: "receita2", valor: 700, data_pagamento: "2026-08-20" }),
    ];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 2200, caixa: 200 });
  });

  it("ignora pagamento apontando para conta inexistente", () => {
    const pagamentos = [pag({ lancamento_id: "receita1", valor: 500, conta_financeira_id: "conta-apagada" })];
    expect(saldosPorConta(contas, lancamentos, pagamentos)).toEqual({ c6: 1000, caixa: 200 });
  });

  it("arredonda para centavos em vez de acumular erro de ponto flutuante", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 0.1 }),
      pag({ lancamento_id: "receita2", valor: 0.2 }),
    ];
    expect(saldosPorConta([{ id: "c6", saldo_inicial: 0 }], lancamentos, pagamentos)).toEqual({ c6: 0.3 });
  });
});

describe("saldoConsolidado", () => {
  it("soma o saldo de todas as contas", () => {
    const pagamentos = [
      pag({ lancamento_id: "receita1", valor: 500, conta_financeira_id: "c6" }),
      pag({ lancamento_id: "despesa1", valor: 50, conta_financeira_id: "caixa" }),
    ];
    expect(saldoConsolidado(contas, lancamentos, pagamentos)).toBe(1650);
  });

  it("é 0 quando não há conta cadastrada", () => {
    expect(saldoConsolidado([], lancamentos, [])).toBe(0);
  });
});
