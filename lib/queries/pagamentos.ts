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

export async function estornarPagamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos").delete().eq("id", id);
  if (error) throw error;
}

// Trocar a conta de um pagamento já registrado. Sem isso, corrigir uma conta
// escolhida por engano exigiria estornar e lançar de novo - e estornar apaga
// junto o item de permuta vinculado, quando existe.
export async function atualizarContaPagamento(id: string, contaFinanceiraId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos")
    .update({ conta_financeira_id: contaFinanceiraId })
    .eq("id", id);
  if (error) throw error;
}

export async function atualizarComprovantePagamento(id: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos").update({ comprovante_url: path }).eq("id", id);
  if (error) throw error;
}

// Chama registrar_pagamento_com_permuta (supabase/migrations/0010), que
// grava o pagamento em caixa e/ou em permuta + o item de permuta numa
// única transação no banco - evita deixar um pagamento "permuta" sem item
// de estoque correspondente caso um dos dois inserts falhe.
// Requer a migração 0010 aplicada no banco ANTES do deploy deste código -
// esta função é chamada para todo pagamento (não só em permuta), então sem
// a função no banco, todo registro de pagamento passa a falhar.
export async function registrarPagamentoComPermutaTransacional(input: {
  lancamento_id: string;
  data_pagamento: string;
  valor_caixa: number;
  taxa: number | null;
  forma_pagamento: string | null;
  comprovante_url: string | null;
  permuta_descricao: string;
  valor_permuta: number;
  conta_financeira_id: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_pagamento_com_permuta", {
    p_lancamento_id: input.lancamento_id,
    p_data_pagamento: input.data_pagamento,
    p_valor_caixa: input.valor_caixa,
    p_taxa: input.taxa,
    p_forma_pagamento: input.forma_pagamento,
    p_comprovante_url: input.comprovante_url,
    p_permuta_descricao: input.permuta_descricao,
    p_valor_permuta: input.valor_permuta,
    p_conta_financeira_id: input.conta_financeira_id,
  });
  if (error) throw error;
}
