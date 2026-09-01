import { createClient } from "@/lib/supabase/server";
import type { SerieLancamento } from "@/lib/types";
import type { Ocorrencia } from "@/lib/series";

export type CamposSerie = {
  tipo_serie: "parcelada" | "fixa";
  frequencia: "semanal" | "quinzenal" | "mensal";
  data_inicio: string;
  total_parcelas: number | null;
  descricao: string;
  tipo: "despesa" | "receita";
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  valor: number;
  custo: number | null;
  observacao: string | null;
};

export async function listarSeries() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("series_lancamentos").select("*");
  if (error) throw error;
  return data as SerieLancamento[];
}

export async function listarSeriesFixasAtivas() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series_lancamentos")
    .select("*")
    .eq("tipo_serie", "fixa")
    .eq("ativa", true);
  if (error) throw error;
  return data as SerieLancamento[];
}

// Maior `parcela_numero` já gravado em cada série fixa ativa. É o ponto de
// partida do reabastecimento: ele só acrescenta ocorrências depois da última.
export async function ultimoOrdinalPorSerie(serieIds: string[]) {
  if (serieIds.length === 0) return new Map<string, number>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("serie_id, parcela_numero")
    .in("serie_id", serieIds);
  if (error) throw error;

  const ultimos = new Map<string, number>();
  for (const linha of data as { serie_id: string; parcela_numero: number | null }[]) {
    const ordinal = (linha.parcela_numero ?? 0) - 1;
    ultimos.set(linha.serie_id, Math.max(ultimos.get(linha.serie_id) ?? -1, ordinal));
  }
  return ultimos;
}

export async function criarSerie(serie: CamposSerie, ocorrencias: Ocorrencia[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_serie_lancamentos", {
    p_serie: serie,
    p_ocorrencias: ocorrencias,
  });
  if (error) throw error;
  return data as string;
}

export async function inserirOcorrencias(
  serieId: string,
  ocorrencias: { parcela_numero: number; vencimento: string }[]
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inserir_ocorrencias_serie", {
    p_serie_id: serieId,
    p_ocorrencias: ocorrencias,
  });
  if (error) throw error;
  return data as number;
}

export type ResultadoPropagacao = { alterados: number; pulados_pagos: number };

export async function atualizarSerie(
  lancamentoId: string,
  alcance: "proximos" | "todos",
  campos: Partial<CamposSerie>
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("atualizar_serie_lancamentos", {
    p_lancamento_id: lancamentoId,
    p_alcance: alcance,
    p_campos: campos,
  });
  if (error) throw error;
  return data as ResultadoPropagacao;
}

export async function excluirSerie(lancamentoId: string, alcance: "proximos" | "todos") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("excluir_serie_lancamentos", {
    p_lancamento_id: lancamentoId,
    p_alcance: alcance,
  });
  if (error) throw error;
  return data as { excluidos: number; pulados_pagos: number };
}
