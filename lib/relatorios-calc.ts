import { round2, saldo, status as calcStatus, totalPago } from "./calculations";
import type { LancamentoRow, Categoria, PagamentoRow } from "./types";

export type LinhaFrenteNegocio = {
  frente: "pecas_acessorios" | "computadores" | "assistencia_tecnica" | "outros";
  receita: number;
  custo: number;
  margem: number;
};

export function agruparPorFrenteNegocio(
  lancamentos: LancamentoRow[],
  categorias: Categoria[]
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

export type LinhaCategoria = {
  categoria: string;
  total: number;
  pago: number;
  vencido: number;
};

// Despesas only: receita already has its own breakdown in
// agruparPorFrenteNegocio, so mixing tipos into one "total" per categoria
// here would let e.g. a despesa filed under a receita category net against
// it silently - nothing in the schema stops that combination today.
export function agruparPorCategoria(
  lancamentos: LancamentoRow[],
  categorias: Categoria[],
  pagamentos: PagamentoRow[],
  hoje: string
): LinhaCategoria[] {
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));

  const acumulado = new Map<string, { total: number; pago: number; vencido: number }>();

  for (const l of lancamentos) {
    if (l.tipo !== "despesa") continue;
    const nome = l.categoria_id ? nomeCategoria.get(l.categoria_id) ?? "Outros" : "Outros";
    const atual = acumulado.get(nome) ?? { total: 0, pago: 0, vencido: 0 };
    atual.total += l.valor;
    atual.pago += totalPago(pagamentos, l.id);
    if (calcStatus(l, pagamentos, hoje) === "atrasado") atual.vencido += saldo(l, pagamentos);
    acumulado.set(nome, atual);
  }

  return Array.from(acumulado.entries()).map(([categoria, dados]) => ({
    categoria,
    total: round2(dados.total),
    pago: round2(dados.pago),
    vencido: round2(dados.vencido),
  }));
}
