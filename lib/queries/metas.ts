import { createClient } from "@/lib/supabase/server";
import type { Meta } from "@/lib/types";

export async function listarMetas() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("metas").select("*").order("nome");
  if (error) throw error;
  return data as Meta[];
}

export async function criarMeta(input: Omit<Meta, "id">) {
  const supabase = await createClient();
  const { error } = await supabase.from("metas").insert(input);
  if (error) throw error;
}

export async function atualizarMeta(id: string, input: Partial<Omit<Meta, "id">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("metas").update(input).eq("id", id);
  if (error) throw error;
}

export async function excluirMeta(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("metas").delete().eq("id", id);
  if (error) throw error;
}
