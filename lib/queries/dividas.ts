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
  // Any categoria in this grupo_dre counts as a "dívida da loja" (e.g. o
  // seed "Empréstimos e Financiamentos" e qualquer categoria de permuta que
  // o usuário cadastrar em /categorias) - não fica preso a um nome fixo.
  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias")
    .select("id")
    .eq("grupo_dre", "Despesas Financeiras");
  if (categoriasError) throw categoriasError;
  if (!categorias || categorias.length === 0) return [];

  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("tipo", "despesa")
    .in("categoria_id", categorias.map((c) => c.id))
    .order("vencimento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as LancamentoRow[];
}
