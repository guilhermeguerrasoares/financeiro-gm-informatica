import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarCategorias } from "./categorias";
import { agruparPorFrenteNegocio, agruparPorCategoria } from "@/lib/relatorios-calc";
import { hoje } from "@/lib/format";

export async function dadosRelatorios() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);

  return {
    porFrente: agruparPorFrenteNegocio(lancamentos, categorias),
    porCategoria: agruparPorCategoria(lancamentos, categorias, pagamentos, hoje()),
  };
}
