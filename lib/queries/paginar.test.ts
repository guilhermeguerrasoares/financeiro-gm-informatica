import { describe, it, expect } from "vitest";
import { buscarTodasAsPaginas, TAMANHO_PAGINA, MAX_PAGINAS } from "./paginar";

// Simula o PostgREST: uma tabela com `total` linhas, respondendo por faixa.
function servidorCom(total: number) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: i }));
  const chamadas: [number, number][] = [];

  const consulta = async (de: number, ate: number) => {
    chamadas.push([de, ate]);
    return { data: linhas.slice(de, ate + 1), error: null };
  };

  return { consulta, chamadas };
}

describe("buscarTodasAsPaginas", () => {
  it("devolve tudo quando cabe numa página só", async () => {
    const { consulta, chamadas } = servidorCom(42);
    const linhas = await buscarTodasAsPaginas(consulta);

    expect(linhas).toHaveLength(42);
    // Página incompleta já é fim: não vale gastar uma segunda ida ao banco.
    expect(chamadas).toHaveLength(1);
  });

  it("junta as páginas quando passa do limite", async () => {
    const { consulta, chamadas } = servidorCom(TAMANHO_PAGINA * 2 + 7);
    const linhas = await buscarTodasAsPaginas(consulta);

    expect(linhas).toHaveLength(TAMANHO_PAGINA * 2 + 7);
    expect(chamadas).toHaveLength(3);
    // Sem sobreposição nem buraco entre as faixas pedidas.
    expect(chamadas[0]).toEqual([0, TAMANHO_PAGINA - 1]);
    expect(chamadas[1]).toEqual([TAMANHO_PAGINA, TAMANHO_PAGINA * 2 - 1]);
  });

  it("preserva a ordem em que o servidor devolveu", async () => {
    const { consulta } = servidorCom(TAMANHO_PAGINA + 3);
    const linhas = await buscarTodasAsPaginas<{ id: number }>(consulta);

    expect(linhas.map((l) => l.id)).toEqual(
      Array.from({ length: TAMANHO_PAGINA + 3 }, (_, i) => i)
    );
  });

  it("faz uma busca a mais quando o total é múltiplo exato da página", async () => {
    const { consulta, chamadas } = servidorCom(TAMANHO_PAGINA);
    const linhas = await buscarTodasAsPaginas(consulta);

    expect(linhas).toHaveLength(TAMANHO_PAGINA);
    // A primeira página veio cheia, e cheia é indistinguível de "tem mais":
    // só a segunda, vazia, prova que acabou. É o preço de não confiar num
    // count separado, que pode mudar entre as duas consultas.
    expect(chamadas).toHaveLength(2);
  });

  it("propaga o erro em vez de devolver resultado parcial", async () => {
    const consulta = async (de: number) =>
      de === 0
        ? { data: Array.from({ length: TAMANHO_PAGINA }, (_, i) => ({ id: i })), error: null }
        : { data: null, error: new Error("conexão caiu") };

    // Devolver as 1000 primeiras aqui seria repetir o bug que este módulo
    // existe para matar: número incompleto passando por número completo.
    await expect(buscarTodasAsPaginas(consulta)).rejects.toThrow("conexão caiu");
  });

  it("para no teto de páginas em vez de girar para sempre", async () => {
    // Servidor que nunca acaba: toda página volta cheia.
    const chamadas: number[] = [];
    const consulta = async (de: number) => {
      chamadas.push(de);
      return { data: Array.from({ length: TAMANHO_PAGINA }, (_, i) => ({ id: de + i })), error: null };
    };

    const linhas = await buscarTodasAsPaginas(consulta);

    expect(chamadas).toHaveLength(MAX_PAGINAS);
    expect(linhas).toHaveLength(MAX_PAGINAS * TAMANHO_PAGINA);
  });
});
