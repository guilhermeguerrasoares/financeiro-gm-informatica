import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";

export async function listarClientes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw error;
  return data as Cliente[];
}

export async function buscarCliente(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Cliente;
}

export async function criarCliente(input: Omit<Cliente, "id">) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").insert(input).select().single();
  if (error) throw error;
  return data as Cliente;
}

export async function atualizarCliente(id: string, input: Partial<Omit<Cliente, "id">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(input).eq("id", id);
  if (error) throw error;
}
