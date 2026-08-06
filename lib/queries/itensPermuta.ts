import { createClient } from "@/lib/supabase/server";

export type ItemPermuta = {
  id: string;
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: "em_estoque" | "revendido" | "usado_em_conserto" | "descartado";
  observacao: string | null;
  created_at: string;
  data_venda: string | null;
  valor_venda: number | null;
  lancamento_venda_id: string | null;
};

export async function listarItensPermuta() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itens_permuta")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ItemPermuta[];
}

export async function criarItemPermuta(input: {
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("itens_permuta").insert(input);
  if (error) throw error;
}

export async function marcarItemPermutaVendido(
  id: string,
  input: { data_venda: string; valor_venda: number; lancamento_venda_id: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("itens_permuta")
    .update({ status: "revendido", ...input })
    .eq("id", id);
  if (error) throw error;
}
