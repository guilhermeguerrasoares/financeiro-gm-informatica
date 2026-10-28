import { createClient } from "@/lib/supabase/server";
import type { LancamentoRow } from "@/lib/types";
import { buscarTodasAsPaginas } from "./paginar";

export async function listarLancamentos() {
  const supabase = await createClient();
  return buscarTodasAsPaginas<LancamentoRow>((de, ate) =>
    supabase
      .from("lancamentos")
      .select("*")
      .order("vencimento", { ascending: true, nullsFirst: false })
      // Desempate: sem ele, a ordem entre lançamentos do mesmo vencimento fica
      // por conta do banco e muda sem aviso. O que foi digitado por último
      // aparece no topo do seu dia, que é onde quem acabou de lançar procura.
      .order("created_at", { ascending: false })
      // `id` como terceiro critério para a ordenação ser total: com dois
      // lançamentos de mesmo vencimento e mesmo created_at, a ordem entre
      // páginas ficaria indefinida e uma linha poderia aparecer duas vezes
      // (ou nenhuma) na junção das páginas.
      .order("id", { ascending: true })
      .range(de, ate)
  );
}

// `conta_financeira_id` fica de fora de propósito: a conta é escolhida na
// baixa (pagamentos.conta_financeira_id), não no lançamento. Incluí-la aqui
// era o que zerava a conta de um lançamento a cada edição.
// `ajuste_saldo` também: quem marca é a RPC registrar_ajuste_saldo, e um
// lançamento criado à mão nunca é uma conciliação.
// `transferencia_id` idem: quem preenche é a RPC registrar_transferencia, que
// grava as duas pernas juntas. Um lançamento avulso nunca é meia transferência.
// `serie_id`/`parcela_numero` idem: quem preenche é criar_serie_lancamentos.
// Um lançamento avulso nunca pertence a uma série, e uma edição normal não
// pode arrancar uma parcela da série dela.
// `recorrencia` é a marcação herdada do sistema antigo, congelada: o
// formulário não a escreve, para não apagá-la a cada edição.
export async function criarLancamento(
  input: Omit<
    LancamentoRow,
    | "id"
    | "conta_financeira_id"
    | "ajuste_saldo"
    | "transferencia_id"
    | "recorrencia"
    | "serie_id"
    | "parcela_numero"
    | "created_at"
  >
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .insert(input)
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation. Com `idempotency_key` preenchida, só o índice
    // da migração 0021 pode disparar isso aqui, e significa uma coisa só: o
    // mesmo preenchimento do formulário chegou duas vezes. O lançamento já
    // existe, então devolvê-lo é a resposta certa - reenvio é no-op, não erro.
    if (error.code === "23505" && input.idempotency_key) {
      const existente = await buscarPorIdempotencyKey(input.idempotency_key);
      if (existente) return existente;
    }
    throw error;
  }
  return data as LancamentoRow;
}

async function buscarPorIdempotencyKey(chave: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("idempotency_key", chave)
    .maybeSingle();

  if (error) throw error;
  return data as LancamentoRow | null;
}

export async function atualizarLancamento(
  id: string,
  input: Partial<Omit<LancamentoRow, "id">>
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as LancamentoRow;
}

export async function excluirLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}
