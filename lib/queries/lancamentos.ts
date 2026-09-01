import { createClient } from "@/lib/supabase/server";
import type { LancamentoRow } from "@/lib/types";

export async function listarLancamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .order("vencimento", { ascending: true, nullsFirst: false })
    // Desempate: sem ele, a ordem entre lançamentos do mesmo vencimento fica
    // por conta do banco e muda sem aviso. O que foi digitado por último
    // aparece no topo do seu dia, que é onde quem acabou de lançar procura.
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as LancamentoRow[];
}

// `conta_financeira_id` fica de fora de propósito: a conta é escolhida na
// baixa (pagamentos.conta_financeira_id), não no lançamento. Incluí-la aqui
// era o que zerava a conta de um lançamento a cada edição.
// `ajuste_saldo` também: quem marca é a RPC registrar_ajuste_saldo, e um
// lançamento criado à mão nunca é uma conciliação.
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

  if (error) throw error;
  return data as LancamentoRow;
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
