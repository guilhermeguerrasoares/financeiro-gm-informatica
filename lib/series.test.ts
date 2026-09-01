import { describe, expect, it } from "vitest";
import { round2 } from "./calculations";
import {
  proximaData,
  dividirValor,
  valoresDaSerie,
  montarOcorrencias,
  ocorrenciasFaltantes,
} from "./series";

describe("proximaData", () => {
  it("ordinal 0 é a própria data inicial", () => {
    expect(proximaData("2026-09-10", "mensal", 0)).toBe("2026-09-10");
  });

  it("avança 7 dias na semanal", () => {
    expect(proximaData("2026-09-10", "semanal", 1)).toBe("2026-09-17");
    expect(proximaData("2026-09-10", "semanal", 3)).toBe("2026-10-01");
  });

  it("avança 14 dias na quinzenal", () => {
    expect(proximaData("2026-09-10", "quinzenal", 2)).toBe("2026-10-08");
  });

  it("mantém o dia na mensal, atravessando o ano", () => {
    expect(proximaData("2026-09-10", "mensal", 1)).toBe("2026-10-10");
    expect(proximaData("2026-09-10", "mensal", 4)).toBe("2027-01-10");
  });

  it("trava no último dia quando o dia não existe no mês de destino", () => {
    expect(proximaData("2026-01-31", "mensal", 1)).toBe("2026-02-28");
    expect(proximaData("2026-01-31", "mensal", 3)).toBe("2026-04-30");
  });

  it("ancora na data inicial, não na ocorrência anterior", () => {
    // Vindo de 31/jan, fevereiro trava em 28. Março precisa voltar para 31 -
    // se ancorasse na data anterior, a série inteira viraria "dia 28".
    expect(proximaData("2026-01-31", "mensal", 2)).toBe("2026-03-31");
  });

  it("respeita ano bissexto", () => {
    expect(proximaData("2028-01-31", "mensal", 1)).toBe("2028-02-29");
  });
});

describe("dividirValor", () => {
  it("divide exato quando dá", () => {
    expect(dividirValor(1200, 3)).toEqual([400, 400, 400]);
  });

  it("joga os centavos na última parcela", () => {
    expect(dividirValor(1000, 3)).toEqual([333.33, 333.33, 333.34]);
  });

  it("a soma das parcelas sempre bate com o total", () => {
    const parcelas = dividirValor(99.99, 7);
    expect(round2(parcelas.reduce((a, b) => a + b, 0))).toBe(99.99);
  });
});

describe("valoresDaSerie", () => {
  it("modo total divide o valor entre as parcelas", () => {
    expect(valoresDaSerie(1200, 3, "total")).toEqual([400, 400, 400]);
  });

  it("modo parcela repete o valor em cada uma", () => {
    expect(valoresDaSerie(400, 3, "parcela")).toEqual([400, 400, 400]);
  });
});

describe("montarOcorrencias", () => {
  it("numera de 1 a N e casa data com valor", () => {
    const ocorrencias = montarOcorrencias({
      dataInicio: "2026-09-10",
      frequencia: "mensal",
      parcelas: 3,
      valor: 1200,
      custo: null,
      modo: "total",
    });

    expect(ocorrencias).toEqual([
      { parcela_numero: 1, vencimento: "2026-09-10", valor: 400, custo: null },
      { parcela_numero: 2, vencimento: "2026-10-10", valor: 400, custo: null },
      { parcela_numero: 3, vencimento: "2026-11-10", valor: 400, custo: null },
    ]);
  });

  it("divide o custo do mesmo jeito que o valor, para a margem do DRE bater mês a mês", () => {
    const ocorrencias = montarOcorrencias({
      dataInicio: "2026-09-10",
      frequencia: "mensal",
      parcelas: 2,
      valor: 1000,
      custo: 600,
      modo: "total",
    });

    expect(ocorrencias.map((o) => o.custo)).toEqual([300, 300]);
  });
});

describe("ocorrenciasFaltantes", () => {
  const regra = {
    dataInicio: "2026-01-10",
    frequencia: "mensal" as const,
    hoje: "2026-09-01",
    horizonteMeses: 12,
  };

  it("completa a série até 12 meses à frente", () => {
    // Ordinais 0..7 (jan..ago) já existem; a próxima é set/2026.
    const faltantes = ocorrenciasFaltantes({ ...regra, ultimoOrdinal: 7 });

    expect(faltantes[0]).toEqual({ parcela_numero: 9, vencimento: "2026-09-10" });
    // Horizonte é 01/09/2027, então 10/09/2027 já fica de fora.
    expect(faltantes[faltantes.length - 1]).toEqual({
      parcela_numero: 20,
      vencimento: "2027-08-10",
    });
  });

  it("é idempotente: rodar de novo com o horizonte coberto não gera nada", () => {
    const primeira = ocorrenciasFaltantes({ ...regra, ultimoOrdinal: 7 });
    const ultimoOrdinal = primeira[primeira.length - 1].parcela_numero - 1;

    expect(ocorrenciasFaltantes({ ...regra, ultimoOrdinal })).toEqual([]);
  });

  it("não ressuscita o passado quando a série ficou sem nenhum lançamento", () => {
    const faltantes = ocorrenciasFaltantes({ ...regra, ultimoOrdinal: -1 });

    expect(faltantes.length).toBeGreaterThan(0);
    expect(faltantes.every((o) => o.vencimento >= "2026-09-01")).toBe(true);
  });
});
