import { createClient } from "@/lib/supabase/server";

// As duas pernas e as duas baixas numa transação só (RPC
// registrar_transferencia, migração 0022): meia transferência gravada sumiria
// com dinheiro do saldo consolidado.
export async function registrarTransferencia(input: {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  data: string;
  observacao: string | null;
  idempotency_key: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_transferencia", {
    p_conta_origem_id: input.conta_origem_id,
    p_conta_destino_id: input.conta_destino_id,
    p_valor: input.valor,
    p_data: input.data,
    p_observacao: input.observacao,
    p_idempotency_key: input.idempotency_key,
  });

  if (error) {
    // 23505 = unique_violation. Com a chave preenchida, só o índice da 0021
    // dispara isso aqui, e significa uma coisa só: o mesmo preenchimento do
    // formulário chegou duas vezes. A primeira já gravou a transferência
    // inteira, então reenvio é no-op - mesma leitura que criarLancamento faz.
    if (error.code === "23505" && input.idempotency_key) return;
    throw error;
  }
}

export async function estornarTransferencia(transferenciaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("estornar_transferencia", {
    p_transferencia_id: transferenciaId,
  });
  if (error) throw error;
}
