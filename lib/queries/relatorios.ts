import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarCategorias } from "./categorias";
import { agruparPorFrenteNegocio } from "@/lib/relatorios-calc";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { hoje } from "@/lib/format";

export async function relatorioPorCategoria() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);

  const hojeStr = hoje();
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));

  const acumulado = new Map<string, { total: number; pago: number; vencido: number }>();

  for (const l of lancamentos) {
    const nome = l.categoria_id ? nomeCategoria.get(l.categoria_id) ?? "Outros" : "Outros";
    const atual = acumulado.get(nome) ?? { total: 0, pago: 0, vencido: 0 };
    atual.total += l.valor;
    atual.pago += totalPago(pagamentos, l.id);
    if (calcStatus(l, pagamentos, hojeStr) === "atrasado") atual.vencido += saldo(l, pagamentos);
    acumulado.set(nome, atual);
  }

  return Array.from(acumulado.entries()).map(([categoria, dados]) => ({ categoria, ...dados }));
}

export async function relatorioPorFrenteNegocio() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);
  return agruparPorFrenteNegocio(lancamentos, categorias, pagamentos);
}
