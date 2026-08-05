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

export async function registrarPagamento(input: {
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  forma_pagamento: string | null;
  data_pagamento: string;
  comprovante_url: string | null;
  observacao: string | null;
}) {
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
