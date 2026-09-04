import { createClient } from "@/lib/supabase/server";

export type ItemPermuta = {
  id: string;
  // Nulo em item cadastrado avulso na tela /permutas: não houve venda por
  // trás dele (supabase/migrations/0020).
  pagamento_id: string | null;
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

// Chama desmembrar_item_permuta (supabase/migrations/0020): tira parte do
// valor de um item em estoque e cria um segundo item com esse valor, no mesmo
// pagamento de origem. Feito no banco para que o total em estoque nunca fique
// nem duplicado nem a menos por uma falha no meio.
export async function desmembrarItemPermuta(input: {
  item_id: string;
  descricao_original: string;
  nova_descricao: string;
  novo_valor: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("desmembrar_item_permuta", {
    p_item_id: input.item_id,
    p_descricao_original: input.descricao_original,
    p_nova_descricao: input.nova_descricao,
    p_novo_valor: input.novo_valor,
  });
  if (error) throw error;
  return data as string;
}

// Chama criar_item_permuta_avulso (supabase/migrations/0020): item que entrou
// fora de uma venda. Com valor_pago > 0 a função cria também a despesa
// quitada na conta escolhida, na mesma transação.
export async function criarItemPermutaAvulso(input: {
  descricao: string;
  valor_estimado: number;
  data_entrada: string;
  observacao: string | null;
  valor_pago: number;
  conta_financeira_id: string | null;
  categoria_id: string | null;
  forma_pagamento: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_item_permuta_avulso", {
    p_descricao: input.descricao,
    p_valor_estimado: input.valor_estimado,
    p_data_entrada: input.data_entrada,
    p_observacao: input.observacao,
    p_valor_pago: input.valor_pago,
    p_conta_financeira_id: input.conta_financeira_id,
    p_categoria_id: input.categoria_id,
    p_forma_pagamento: input.forma_pagamento,
  });
  if (error) throw error;
  return data as string;
}
