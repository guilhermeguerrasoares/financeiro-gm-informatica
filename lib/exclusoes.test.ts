import { describe, it, expect } from "vitest";
import { entraNosRelatorios } from "./exclusoes";

describe("entraNosRelatorios", () => {
  it("lançamento comum entra", () => {
    expect(entraNosRelatorios({ ajuste_saldo: false, transferencia_id: null })).toBe(true);
  });

  it("ajuste de conciliação fica de fora", () => {
    expect(entraNosRelatorios({ ajuste_saldo: true, transferencia_id: null })).toBe(false);
  });

  it("perna de transferência fica de fora", () => {
    expect(entraNosRelatorios({ ajuste_saldo: false, transferencia_id: "t1" })).toBe(false);
  });

  // As duas pernas carregam o mesmo transferencia_id. Se só uma ficasse de
  // fora, o mês fecharia com uma receita ou uma despesa que nunca existiu.
  it("as duas pernas da mesma transferência ficam de fora", () => {
    const saida = { ajuste_saldo: false, transferencia_id: "t1" };
    const entrada = { ajuste_saldo: false, transferencia_id: "t1" };
    expect([saida, entrada].filter(entraNosRelatorios)).toEqual([]);
  });
});
