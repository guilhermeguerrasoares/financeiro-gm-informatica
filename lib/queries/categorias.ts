import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";

export async function listarCategorias() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) throw error;
  return data as Categoria[];
}
