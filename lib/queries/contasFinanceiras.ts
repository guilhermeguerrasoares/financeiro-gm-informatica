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

export async function criarContaFinanceira(input: {
  nome: string;
  tipo: "caixa" | "banco" | "cartao";
  saldo_inicial: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("contas_financeiras").insert(input);
  if (error) throw error;
}
