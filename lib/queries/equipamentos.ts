import { createClient } from "@/lib/supabase/server";

export type EquipamentoCliente = {
  id: string;
  cliente_id: string;
  tipo: string;
  marca_modelo: string | null;
  numero_serie: string | null;
  observacao: string | null;
};

export async function listarEquipamentosDoCliente(clienteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamentos_cliente")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EquipamentoCliente[];
}

export async function criarEquipamento(input: Omit<EquipamentoCliente, "id">) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipamentos_cliente").insert(input);
  if (error) throw error;
}
