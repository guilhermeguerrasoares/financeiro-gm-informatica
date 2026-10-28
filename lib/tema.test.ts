import { describe, it, expect } from "vitest";
import { temaInicial } from "./tema";

describe("temaInicial", () => {
  it("usa escuro quando não há nada guardado", () => {
    expect(temaInicial(null)).toBe("escuro");
  });

  it("usa escuro quando o valor guardado é lixo", () => {
    expect(temaInicial("roxo")).toBe("escuro");
  });

  it("respeita o tema guardado", () => {
    expect(temaInicial("claro")).toBe("claro");
    expect(temaInicial("escuro")).toBe("escuro");
  });
});
