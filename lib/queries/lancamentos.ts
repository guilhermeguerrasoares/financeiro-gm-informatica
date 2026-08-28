import { createClient } from "@/lib/supabase/server";
import type { LancamentoRow } from "@/lib/types";

export async function listarLancamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .order("vencimento", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as LancamentoRow[];
}

// `conta_financeira_id` fica de fora de propósito: a conta é escolhida na
// baixa (pagamentos.conta_financeira_id), não no lançamento. Incluí-la aqui
// era o que zerava a conta de um lançamento a cada edição.
export async function criarLancamento(
  input: Omit<LancamentoRow, "id" | "conta_financeira_id">
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
