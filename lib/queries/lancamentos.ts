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

export async function criarLancamento(
  input: Omit<LancamentoRow, "id">
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
