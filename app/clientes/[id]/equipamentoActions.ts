"use server";

import { revalidatePath } from "next/cache";
import { criarEquipamento } from "@/lib/queries/equipamentos";

export async function criarEquipamentoAction(formData: FormData) {
  const clienteId = formData.get("cliente_id") as string;

  await criarEquipamento({
    cliente_id: clienteId,
    tipo: formData.get("tipo") as string,
    marca_modelo: (formData.get("marca_modelo") as string) || null,
    numero_serie: (formData.get("numero_serie") as string) || null,
    observacao: (formData.get("observacao") as string) || null,
  });

  revalidatePath(`/clientes/${clienteId}`);
}
