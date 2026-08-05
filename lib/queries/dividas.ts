import { createClient } from "@/lib/supabase/server";
import type { LancamentoRow } from "@/lib/types";

export async function listarDividasClientes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("tipo", "receita")
    .not("cliente_id", "is", null)
    .order("vencimento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as LancamentoRow[];
}

export async function listarDividasLoja() {
  const supabase = await createClient();
  // maybeSingle (not single): if this seeded category is ever renamed or
  // deleted, show an empty list instead of throwing and taking down the
  // whole /dividas page over what's otherwise just a missing row.
  const { data: categoria, error: categoriaError } = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", "Empréstimos e Financiamentos")
    .maybeSingle();
  if (categoriaError) throw categoriaError;
  if (!categoria) return [];

  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("tipo", "despesa")
    .eq("categoria_id", categoria.id)
    .order("vencimento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as LancamentoRow[];
}
