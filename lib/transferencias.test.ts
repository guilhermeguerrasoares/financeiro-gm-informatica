import { describe, it, expect } from "vitest";
import { validarTransferencia } from "./transferencias";

describe("validarTransferencia", () => {
  it("recusa origem igual ao destino", () => {
    expect(validarTransferencia({ origemId: "c1", destinoId: "c1", valor: 100 })).toMatch(/mesma conta/i);
  });

  it("recusa valor zero ou negativo", () => {
    expect(validarTransferencia({ origemId: "c1", destinoId: "c2", valor: 0 })).not.toBeNull();
    expect(validarTransferencia({ origemId: "c1", destinoId: "c2", valor: -50 })).not.toBeNull();
  });

  it("recusa conta não escolhida", () => {
    expect(validarTransferencia({ origemId: "", destinoId: "c2", valor: 100 })).not.toBeNull();
    expect(validarTransferencia({ origemId: "c1", destinoId: "", valor: 100 })).not.toBeNull();
  });

  it("aceita transferência válida", () => {
    expect(validarTransferencia({ origemId: "c1", destinoId: "c2", valor: 1000 })).toBeNull();
  });
});
