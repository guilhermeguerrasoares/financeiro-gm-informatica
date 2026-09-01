"use server";

import { hoje } from "@/lib/format";
import { ocorrenciasFaltantes } from "@/lib/series";
import {
  listarSeriesFixasAtivas,
  ultimoOrdinalPorSerie,
  inserirOcorrencias,
} from "@/lib/queries/series";
import { revalidarPaginasFinanceiras } from "./revalidate";

// Mantém toda conta fixa ativa com 12 meses de lançamentos à frente.
//
// Idempotente de propósito: `ocorrenciasFaltantes` só acrescenta o que vem
// depois da última ocorrência existente, então chamar isto a cada abertura da
// tela não duplica nada. É o que permite dispensar um agendador no servidor.
export async function reabastecerSeriesFixasAction(): Promise<number> {
  const series = await listarSeriesFixasAtivas();
  if (series.length === 0) return 0;

  const ultimos = await ultimoOrdinalPorSerie(series.map((s) => s.id));
  const hojeStr = hoje();
  let criadas = 0;

  for (const serie of series) {
    const faltantes = ocorrenciasFaltantes({
      dataInicio: serie.data_inicio,
      frequencia: serie.frequencia,
      ultimoOrdinal: ultimos.get(serie.id) ?? -1,
      hoje: hojeStr,
    });
    if (faltantes.length === 0) continue;
    criadas += await inserirOcorrencias(serie.id, faltantes);
  }

  if (criadas > 0) revalidarPaginasFinanceiras();
  return criadas;
}
