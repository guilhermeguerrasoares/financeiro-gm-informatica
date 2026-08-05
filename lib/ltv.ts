import { round2, totalPago } from "./calculations";
import type { LancamentoRow, PagamentoRow } from "./types";

export type MetricasCliente = {
  ltv: number;
  ticketMedio: number;
  frequencia: number;
};

// A lancamento counts toward frequencia/ltv as soon as it has any payment
// (totalPago > 0), even if only partially paid - so a still-open partial
// payment lowers ticketMedio the same as a fully settled sale of that size.
// This favors "activity so far" over "only completed sales"; revisit if the
// store wants LTV to reflect settled revenue exclusively.
export function metricasCliente(
  clienteId: string,
  lancamentos: LancamentoRow[],
  pagamentos: PagamentoRow[]
): MetricasCliente {
  const doCliente = lancamentos.filter((l) => l.tipo === "receita" && l.cliente_id === clienteId);

  const pagos = doCliente.filter((l) => totalPago(pagamentos, l.id) > 0);

  const ltv = round2(pagos.reduce((acc, l) => acc + totalPago(pagamentos, l.id), 0));
  const frequencia = pagos.length;
  const ticketMedio = frequencia > 0 ? round2(ltv / frequencia) : 0;

  return { ltv, ticketMedio, frequencia };
}
