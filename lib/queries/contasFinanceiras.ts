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
