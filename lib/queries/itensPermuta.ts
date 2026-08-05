import { createClient } from "@/lib/supabase/server";

export type ItemPermuta = {
  id: string;
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: "em_estoque" | "revendido" | "usado_em_conserto" | "descartado";
  observacao: string | null;
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
