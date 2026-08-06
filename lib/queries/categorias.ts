import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";

export async function listarCategorias() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) throw error;
  return data as Categoria[];
}

export async function criarCategoria(input: {
  nome: string;
  grupo_dre: string;
  frente_negocio: Categoria["frente_negocio"];
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("categorias").insert(input);
  if (error) throw error;
}

export async function atualizarCategoria(
  id: string,
  input: { nome: string; grupo_dre: string; frente_negocio: Categoria["frente_negocio"] }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("categorias").update(input).eq("id", id);
  if (error) throw error;
}
