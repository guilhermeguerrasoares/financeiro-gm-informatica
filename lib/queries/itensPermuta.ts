import { createClient } from "@/lib/supabase/server";

export type ItemPermuta = {
  id: string;
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: "em_estoque" | "revendido" | "usado_em_conserto" | "descartado";
  observacao: string | null;
  created_at: string;
  data_venda: string | null;
  valor_venda: number | null;
  lancamento_venda_id: string | null;
};

export async function listarItensPermuta() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itens_permuta")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ItemPermuta[];
}

export async function buscarItemPermutaPorPagamento(pagamentoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itens_permuta")
    .select("*")
    .eq("pagamento_id", pagamentoId)
    .maybeSingle();
  if (error) throw error;
  return data as ItemPermuta | null;
}

// Pega os itens de permuta que nasceram de algum pagamento DESTE lançamento
// (não confundir com reverterItemPermutaPorLancamento, que trata o caso
// inverso: este lançamento sendo a venda de um item de OUTRA origem).
export async function buscarItensPermutaPorLancamentoOrigem(lancamentoId: string) {
  const supabase = await createClient();
  const { data: pagamentos, error: pagamentosError } = await supabase
    .from("pagamentos")
    .select("id")
    .eq("lancamento_id", lancamentoId);
  if (pagamentosError) throw pagamentosError;
  if (!pagamentos || pagamentos.length === 0) return [];

  const { data, error } = await supabase
    .from("itens_permuta")
    .select("*")
    .in(
      "pagamento_id",
      pagamentos.map((p) => p.id)
    );
  if (error) throw error;
  return data as ItemPermuta[];
}

export async function criarItemPermuta(input: {
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("itens_permuta").insert(input);
  if (error) throw error;
}

// Chama a função vender_item_permuta (supabase/migrations/0008), que cria o
// lançamento + pagamento e dá baixa no item numa única transação no banco -
// evita deixar lançamento órfão ou vender o mesmo item duas vezes.
export async function venderItemPermuta(input: {
  item_id: string;
  descricao: string;
  valor: number;
  custo: number | null;
  data: string;
  forma_pagamento: string | null;
  conta_financeira_id: string | null;
  categoria_id: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vender_item_permuta", {
    p_item_id: input.item_id,
    p_descricao: input.descricao,
    p_valor: input.valor,
    p_custo: input.custo,
    p_data: input.data,
    p_forma: input.forma_pagamento,
    p_conta_financeira_id: input.conta_financeira_id,
    p_categoria_id: input.categoria_id,
  });
  if (error) throw error;
  return data as string;
}

export async function reverterItemPermutaPorLancamento(lancamentoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("itens_permuta")
    .update({ status: "em_estoque", data_venda: null, valor_venda: null, lancamento_venda_id: null })
    .eq("lancamento_venda_id", lancamentoId);
  if (error) throw error;
}
