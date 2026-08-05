import { round2 } from "./calculations";
import type { LancamentoRow, Categoria, PagamentoRow } from "./types";

export type LinhaFrenteNegocio = {
  frente: "pecas_acessorios" | "computadores" | "assistencia_tecnica" | "outros";
  receita: number;
  custo: number;
  margem: number;
};

export function agruparPorFrenteNegocio(
  lancamentos: LancamentoRow[],
  categorias: Categoria[],
  _pagamentos: PagamentoRow[]
): LinhaFrenteNegocio[] {
  const frenteDaCategoria = new Map(categorias.map((c) => [c.id, c.frente_negocio]));

  const acumulado = new Map<string, { receita: number; custo: number }>();

  for (const l of lancamentos) {
    if (l.tipo !== "receita") continue;
    const frente = l.categoria_id ? frenteDaCategoria.get(l.categoria_id) : null;
    if (!frente) continue;

    const atual = acumulado.get(frente) ?? { receita: 0, custo: 0 };
    atual.receita += l.valor;
    atual.custo += l.custo ?? 0;
    acumulado.set(frente, atual);
  }

  return Array.from(acumulado.entries()).map(([frente, { receita, custo }]) => ({
    frente: frente as LinhaFrenteNegocio["frente"],
    receita: round2(receita),
    custo: round2(custo),
    margem: round2(receita - custo),
  }));
}
