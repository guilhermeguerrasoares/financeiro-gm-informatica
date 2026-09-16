import { createClient } from "@/lib/supabase/server";
import type { ContaFinanceira } from "@/lib/types";

export async function listarContasFinanceiras() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_financeiras")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data as ContaFinanceira[];
}

// Grava a diferença entre o saldo do sistema e o saldo real como um
// lançamento datado (RPC registrar_ajuste_saldo, migração 0013), para a
// correção ficar rastreável em vez de o saldo mudar sozinho.
export async function registrarAjusteSaldo(input: {
  conta_financeira_id: string;
  data: string;
  diferenca: number;
  observacao: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_ajuste_saldo", {
    p_conta_financeira_id: input.conta_financeira_id,
    p_data: input.data,
    p_diferenca: input.diferenca,
    p_observacao: input.observacao,
  });
  if (error) throw error;
}

export async function criarContaFinanceira(input: {
  nome: string;
  tipo: "caixa" | "banco" | "cartao";
  saldo_inicial: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("contas_financeiras").insert(input);
  if (error) throw error;
}

export async function contarPagamentosDaConta(id: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("conta_financeira_id", id);
  if (error) throw error;
  return count ?? 0;
}

// Delete de verdade, não `ativo = false`: só é chamado para conta sem nenhum
// pagamento, então não há histórico a preservar. O count detecta o caso em
// que a RLS (só dono/gerente apaga) filtra a linha sem devolver erro.
export async function excluirContaFinanceira(id: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("contas_financeiras")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("A conta não foi excluída: seu usuário não tem permissão para isso.");
}
