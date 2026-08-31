import { describe, it, expect } from "vitest";
import { ordenarLinhas } from "./calculations";
import type { StatusLancamento } from "./calculations";

function linha(descricao: string, vencimento: string | null, created_at: string, status: StatusLancamento = "quitado") {
  return { lancamento: { descricao, vencimento, created_at }, status };
}

// Os três lançamentos de 28/08 que aparecem em "Só entradas", com as datas
// de registro reais: o do Kaio foi digitado três dias depois dos outros.
const felipe = linha("venda felipe celedonio", "2026-08-28", "2026-08-25T19:05:14Z");
const cartao = linha("vendas na maquina de cartão", "2026-08-28", "2026-08-28T17:50:00Z");
const kaio = linha("KAIO CESAR - TECLADO MECANICO", "2026-08-28", "2026-08-31T12:23:51Z");

const nomes = (linhas: ReturnType<typeof linha>[]) => linhas.map((l) => l.lancamento.descricao);

describe("ordenarLinhas", () => {
  it("põe o registrado por último no topo do seu dia", () => {
    const ordenado = ordenarLinhas([felipe, cartao, kaio], "data", "desc");
    expect(nomes(ordenado)[0]).toBe("KAIO CESAR - TECLADO MECANICO");
    expect(nomes(ordenado)).toEqual([
      "KAIO CESAR - TECLADO MECANICO",
      "vendas na maquina de cartão",
      "venda felipe celedonio",
    ]);
  });

  it("mantém o mesmo desempate ao inverter a direção", () => {
    // A direção troca a ordem entre dias diferentes, não a de dentro do dia:
    // o recém-lançado continua encabeçando o seu grupo.
    const ordenado = ordenarLinhas([felipe, cartao, kaio], "data", "asc");
    expect(nomes(ordenado)[0]).toBe("KAIO CESAR - TECLADO MECANICO");
  });

  it("ordena por vencimento antes de desempatar", () => {
    const dia27 = linha("venda 27", "2026-08-27", "2026-08-31T13:00:00Z");
    const ordenado = ordenarLinhas([dia27, felipe, kaio], "data", "desc");
    expect(nomes(ordenado)).toEqual([
      "KAIO CESAR - TECLADO MECANICO",
      "venda felipe celedonio",
      "venda 27",
    ]);
  });

  it("não embaralha quando nenhuma coluna foi escolhida", () => {
    const original = [cartao, kaio, felipe];
    expect(ordenarLinhas(original, null, "asc")).toBe(original);
  });

  it("desempata também na ordenação por situação", () => {
    const antigo = linha("antigo", "2026-08-01", "2026-08-01T10:00:00Z", "atrasado");
    const novo = linha("novo", "2026-08-02", "2026-08-31T10:00:00Z", "atrasado");
    expect(nomes(ordenarLinhas([antigo, novo], "situacao", "asc"))).toEqual(["novo", "antigo"]);
  });

  it("é determinística: a ordem de entrada não muda o resultado", () => {
    const a = nomes(ordenarLinhas([felipe, cartao, kaio], "data", "desc"));
    const b = nomes(ordenarLinhas([kaio, felipe, cartao], "data", "desc"));
    const c = nomes(ordenarLinhas([cartao, kaio, felipe], "data", "desc"));
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("joga lançamento sem vencimento para o fim quando a ordem é decrescente", () => {
    const semData = linha("sem vencimento", null, "2026-08-31T14:00:00Z");
    expect(nomes(ordenarLinhas([semData, kaio], "data", "desc"))).toEqual([
      "KAIO CESAR - TECLADO MECANICO",
      "sem vencimento",
    ]);
  });
});
