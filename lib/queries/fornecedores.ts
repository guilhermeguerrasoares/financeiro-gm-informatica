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

export async function excluirFornecedor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) throw error;
}
