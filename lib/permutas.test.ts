import { describe, it, expect } from "vitest";
import { validarDesmembramento, validarPermutaAvulsa } from "./permutas";

describe("validarDesmembramento", () => {
  const base = {
    valorEstimadoOriginal: 1000,
    descricaoOriginal: "Notebook Dell",
    novaDescricao: "Monitor LG",
    novoValor: 300,
  };

  it("aceita um desmembramento com descrições e valor dentro do original", () => {
    expect(validarDesmembramento(base)).toBeNull();
  });

  it("recusa valor igual ao do original, que zeraria o item que fica", () => {
    expect(validarDesmembramento({ ...base, novoValor: 1000 })).toMatch(/menor/i);
  });

  it("recusa valor maior que o do original", () => {
    expect(validarDesmembramento({ ...base, novoValor: 1200 })).toMatch(/menor/i);
  });

  it("recusa valor zero ou negativo", () => {
    expect(validarDesmembramento({ ...base, novoValor: 0 })).toMatch(/maior que zero/i);
    expect(validarDesmembramento({ ...base, novoValor: -50 })).toMatch(/maior que zero/i);
  });

  it("recusa descrições vazias ou só com espaços", () => {
    expect(validarDesmembramento({ ...base, novaDescricao: "  " })).toMatch(/descrição/i);
    expect(validarDesmembramento({ ...base, descricaoOriginal: "" })).toMatch(/descrição/i);
  });

  it("recusa item sem valor estimado, que não tem o que dividir", () => {
    expect(validarDesmembramento({ ...base, valorEstimadoOriginal: null })).toMatch(/valor estimado/i);
    expect(validarDesmembramento({ ...base, valorEstimadoOriginal: 0 })).toMatch(/valor estimado/i);
  });

  it("compara com tolerância de centavo, não com igualdade exata de float", () => {
    expect(validarDesmembramento({ valorEstimadoOriginal: 0.3, novoValor: 0.1 + 0.2, descricaoOriginal: "a", novaDescricao: "b" })).toMatch(/menor/i);
  });
});

describe("validarPermutaAvulsa", () => {
  const base = {
    descricao: "Impressora usada",
    valorEstimado: 400,
    dataEntrada: "2026-09-04",
    valorPago: 0,
    contaFinanceiraId: null as string | null,
  };

  it("aceita um item que entrou sem custo nenhum", () => {
    expect(validarPermutaAvulsa({ ...base, valorEstimado: 0 })).toBeNull();
  });

  it("aceita um item com valor estimado e sem saída de caixa", () => {
    expect(validarPermutaAvulsa(base)).toBeNull();
  });

  it("recusa descrição vazia", () => {
    expect(validarPermutaAvulsa({ ...base, descricao: "   " })).toMatch(/descrição/i);
  });

  it("recusa valor estimado negativo", () => {
    expect(validarPermutaAvulsa({ ...base, valorEstimado: -1 })).toMatch(/valor estimado/i);
  });

  it("recusa data de entrada vazia", () => {
    expect(validarPermutaAvulsa({ ...base, dataEntrada: "" })).toMatch(/data/i);
  });

  it("exige conta quando houve saída de caixa, senão o saldo não sai de lugar nenhum", () => {
    expect(validarPermutaAvulsa({ ...base, valorPago: 200 })).toMatch(/conta/i);
    expect(validarPermutaAvulsa({ ...base, valorPago: 200, contaFinanceiraId: "c6" })).toBeNull();
  });

  it("recusa valor pago negativo", () => {
    expect(validarPermutaAvulsa({ ...base, valorPago: -10 })).toMatch(/valor pago/i);
  });

  it("ignora conta quando não houve pagamento", () => {
    expect(validarPermutaAvulsa({ ...base, valorPago: 0, contaFinanceiraId: null })).toBeNull();
  });
});
