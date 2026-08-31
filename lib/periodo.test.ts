import { describe, it, expect } from "vitest";
import { dentroDoPeriodo } from "./calculations";
import { formatDataBR } from "./format";

describe("dentroDoPeriodo", () => {
  it("sem limites, não filtra nada", () => {
    expect(dentroDoPeriodo("2026-08-31", "", "")).toBe(true);
    expect(dentroDoPeriodo(null, "", "")).toBe(true);
  });

  it("inclui os dois extremos do intervalo", () => {
    expect(dentroDoPeriodo("2026-08-28", "2026-08-28", "2026-08-31")).toBe(true);
    expect(dentroDoPeriodo("2026-08-31", "2026-08-28", "2026-08-31")).toBe(true);
  });

  it("exclui o que está fora do intervalo", () => {
    expect(dentroDoPeriodo("2026-08-27", "2026-08-28", "2026-08-31")).toBe(false);
    expect(dentroDoPeriodo("2026-09-01", "2026-08-28", "2026-08-31")).toBe(false);
  });

  it("aceita só o limite inicial ou só o final", () => {
    expect(dentroDoPeriodo("2026-09-13", "2026-08-28", "")).toBe(true);
    expect(dentroDoPeriodo("2026-07-31", "2026-08-28", "")).toBe(false);
    expect(dentroDoPeriodo("2026-07-31", "", "2026-08-28")).toBe(true);
    expect(dentroDoPeriodo("2026-09-13", "", "2026-08-28")).toBe(false);
  });

  it("descarta lançamento sem data quando há algum limite", () => {
    expect(dentroDoPeriodo(null, "2026-08-01", "")).toBe(false);
    expect(dentroDoPeriodo(null, "", "2026-08-31")).toBe(false);
  });

  it("compara por dia de calendário, sem escorregar na virada do mês ou do ano", () => {
    // Comparação lexicográfica em "YYYY-MM-DD": 2026-09-01 > 2026-08-31,
    // apesar de "09" < "31" como número de dia.
    expect(dentroDoPeriodo("2026-09-01", "", "2026-08-31")).toBe(false);
    expect(dentroDoPeriodo("2025-12-31", "2026-01-01", "")).toBe(false);
    expect(dentroDoPeriodo("2026-01-01", "2026-01-01", "2026-01-01")).toBe(true);
  });

  // Um filtro "sexta-feira 28" tem de trazer o lançamento do dia 28 e deixar
  // de fora o do dia 31, independentemente de quando cada um foi digitado.
  it("separa 28 de 31 como o operador espera", () => {
    const dia28 = "2026-08-28";
    const dia31 = "2026-08-31";
    expect(dentroDoPeriodo(dia28, "2026-08-28", "2026-08-28")).toBe(true);
    expect(dentroDoPeriodo(dia31, "2026-08-28", "2026-08-28")).toBe(false);
  });
});

describe("formatDataBR", () => {
  // Exibe a data exatamente como está gravada: sem passar por Date, não há
  // conversão de fuso que possa mostrar o dia anterior.
  it("mostra o mesmo dia que está no banco", () => {
    expect(formatDataBR("2026-08-28")).toBe("28/08");
    expect(formatDataBR("2026-08-31")).toBe("31/08");
    expect(formatDataBR("2026-01-01")).toBe("01/01");
  });

  it("mostra travessão quando não há data", () => {
    expect(formatDataBR(null)).toBe("—");
  });
});
