import { describe, it, expect } from "vitest";
import { entraNosRelatorios } from "./exclusoes";

describe("entraNosRelatorios", () => {
  it("lançamento comum entra", () => {
    expect(
      entraNosRelatorios({ ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "compra" })
    ).toBe(true);
  });

  it("ajuste de conciliação fica de fora", () => {
    expect(
      entraNosRelatorios({ ajuste_saldo: true, transferencia_id: null, movimento_fornecedor: "compra" })
    ).toBe(false);
  });

  // Reconhecer que se deve R$ 6.500 não é gastar R$ 6.500: não houve entrada
  // nem saída. Como o ajuste também não tem vencimento, deixá-lo entrar faria
  // o card "Atrasado" do dashboard subir 6.500 sem nada ter vencido.
  it("ajuste de dívida de fornecedor fica de fora", () => {
    expect(
      entraNosRelatorios({ ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "ajuste" })
    ).toBe(false);
  });

  // A quitação entra: o dinheiro saiu de verdade, e a compra que gerou aquela
  // dívida nunca foi lançada, então ela nunca bateu no DRE.
  it("quitação de dívida de fornecedor entra", () => {
    expect(
      entraNosRelatorios({ ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "quitacao" })
    ).toBe(true);
  });

  it("perna de transferência fica de fora", () => {
    expect(entraNosRelatorios({ ajuste_saldo: false, transferencia_id: "t1", movimento_fornecedor: "compra" as const })).toBe(false);
  });

  // As duas pernas carregam o mesmo transferencia_id. Se só uma ficasse de
  // fora, o mês fecharia com uma receita ou uma despesa que nunca existiu.
  it("as duas pernas da mesma transferência ficam de fora", () => {
    const saida = { ajuste_saldo: false, transferencia_id: "t1", movimento_fornecedor: "compra" as const };
    const entrada = { ajuste_saldo: false, transferencia_id: "t1", movimento_fornecedor: "compra" as const };
    expect([saida, entrada].filter(entraNosRelatorios)).toEqual([]);
  });
});
