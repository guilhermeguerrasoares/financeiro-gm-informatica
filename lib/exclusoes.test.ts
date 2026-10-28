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
});
