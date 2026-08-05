import { createClient } from "@/lib/supabase/server";
import type { Fornecedor } from "@/lib/types";

export async function listarFornecedores() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
  if (error) throw error;
  return data as Fornecedor[];
}

export async function criarFornecedor(input: Omit<Fornecedor, "id">) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert(input);
  if (error) throw error;
}
