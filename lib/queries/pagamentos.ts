import { createClient } from "@/lib/supabase/server";
import type { PagamentoRow } from "@/lib/types";

export async function listarPagamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .select("*")
    .order("data_pagamento", { ascending: false });

  if (error) throw error;
  return data as PagamentoRow[];
}

export async function registrarPagamento(
  input: Omit<PagamentoRow, "id" | "valor_liquido">
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as PagamentoRow;
}

export async function estornarPagamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos").delete().eq("id", id);
  if (error) throw error;
}

export async function atualizarComprovantePagamento(id: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos").update({ comprovante_url: path }).eq("id", id);
  if (error) throw error;
}
