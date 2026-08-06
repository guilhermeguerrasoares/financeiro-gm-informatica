import { describe, it, expect } from "vitest";
import {
  totalPago,
  saldo,
  status,
  valorLiquido,
  margem,
  round2,
  type Lancamento,
  type Pagamento,
} from "./calculations";

const lancamento: Lancamento = {
  id: "l1",
  tipo: "despesa",
  valor: 100,
  custo: null,
  vencimento: "2026-08-10",
};

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.001)).toBe(10);
  });
});

describe("totalPago", () => {
  it("sums only payments for the given lancamento", () => {
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 40, taxa: null, valor_liquido: 40, data_pagamento: "2026-08-01" },
      { id: "p2", lancamento_id: "l1", valor: 20, taxa: null, valor_liquido: 20, data_pagamento: "2026-08-02" },
      { id: "p3", lancamento_id: "outro", valor: 999, taxa: null, valor_liquido: 999, data_pagamento: "2026-08-02" },
    ];
    expect(totalPago(pagamentos, "l1")).toBe(60);
  });

  it("returns 0 when there are no payments", () => {
    expect(totalPago([], "l1")).toBe(0);
  });
});

describe("saldo", () => {
  it("subtracts total paid from the lancamento value", () => {
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 40, taxa: null, valor_liquido: 40, data_pagamento: "2026-08-01" },
    ];
    expect(saldo(lancamento, pagamentos)).toBe(60);
  });
});

describe("status", () => {
  it("is quitado when fully paid", () => {
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 100, taxa: null, valor_liquido: 100, data_pagamento: "2026-08-01" },
    ];
    expect(status(lancamento, pagamentos, "2026-08-04")).toBe("quitado");
  });

  it("is atrasado when overdue and unpaid", () => {
    expect(status(lancamento, [], "2026-08-11")).toBe("atrasado");
  });

  it("is parcial when partially paid and not yet due", () => {
    const futureLancamento: Lancamento = { ...lancamento, vencimento: "2026-09-01" };
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 40, taxa: null, valor_liquido: 40, data_pagamento: "2026-08-01" },
    ];
    expect(status(futureLancamento, pagamentos, "2026-08-04")).toBe("parcial");
  });

  it("is aberto when unpaid and not yet due", () => {
    const futureLancamento: Lancamento = { ...lancamento, vencimento: "2026-09-01" };
    expect(status(futureLancamento, [], "2026-08-04")).toBe("aberto");
  });
});

describe("valorLiquido", () => {
  it("subtracts the fee when informed", () => {
    expect(valorLiquido(100, 3.5)).toBe(96.5);
  });

  it("equals the paid value when no fee is informed", () => {
    expect(valorLiquido(100, null)).toBe(100);
  });
});

describe("margem", () => {
  it("is null when cost is not informed", () => {
    expect(margem(lancamento)).toBeNull();
  });

  it("is valor minus custo when informed", () => {
    expect(margem({ ...lancamento, custo: 30 })).toBe(70);
  });
});
