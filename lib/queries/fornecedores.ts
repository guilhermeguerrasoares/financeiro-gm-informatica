import { createClient } from "@/lib/supabase/server";
import type { Fornecedor } from "@/lib/types";

export async function listarFornecedores() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
  if (error) throw error;
  return data as Fornecedor[];
}

export async function buscarFornecedor(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedores").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Fornecedor;
}

export async function criarFornecedor(input: Omit<Fornecedor, "id">) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert(input);
  if (error) throw error;
}

export async function atualizarFornecedor(id: string, input: Partial<Omit<Fornecedor, "id">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update(input).eq("id", id);
  if (error) throw error;
}

// Grava a diferença entre a dívida que o sistema calcula e a que o dono
// informa, como um lançamento datado sem pagamento nenhum (RPC
// registrar_ajuste_divida_fornecedor, migração 0023). Reconhecer dívida não é
// gastar: nada disso toca em saldo de conta, DRE, metas ou fluxo.
export async function registrarAjusteDivida(input: {
  fornecedor_id: string;
  data: string;
  diferenca: number;
  observacao: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_ajuste_divida_fornecedor", {
    p_fornecedor_id: input.fornecedor_id,
    p_data: input.data,
    p_diferenca: input.diferenca,
    p_observacao: input.observacao,
  });
  if (error) throw error;
}

// Pagamento de dívida informada: lançamento de despesa + baixa, numa
// transação só (RPC registrar_quitacao_divida_fornecedor, migração 0023). A
// própria RPC recusa quando há compra lançada em aberto - aí o certo é dar
// baixa nela, senão a mesma despesa conta duas vezes.
export async function registrarQuitacaoDivida(input: {
  fornecedor_id: string;
  data: string;
  valor: number;
  conta_financeira_id: string;
  categoria_id: string | null;
  forma_pagamento: string | null;
  observacao: string | null;
  idempotency_key: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_quitacao_divida_fornecedor", {
    p_fornecedor_id: input.fornecedor_id,
    p_data: input.data,
    p_valor: input.valor,
    p_conta_financeira_id: input.conta_financeira_id,
    p_categoria_id: input.categoria_id,
    p_forma_pagamento: input.forma_pagamento,
    p_observacao: input.observacao,
    p_idempotency_key: input.idempotency_key,
  });

  if (error) {
    // Mesmo no-op de criarLancamento: com a chave preenchida, 23505 só pode
    // ser o índice da 0021, e significa que o mesmo preenchimento chegou duas
    // vezes. A primeira já gravou tudo.
    if (error.code === "23505" && input.idempotency_key) return;
    throw error;
  }
}

export async function excluirFornecedor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) throw error;
}
