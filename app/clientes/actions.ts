"use server";

import { revalidatePath } from "next/cache";
import { criarCliente, atualizarCliente } from "@/lib/queries/clientes";

export async function salvarClienteAction(formData: FormData) {
  const id = formData.get("id") as string | null;

  const input = {
    nome: formData.get("nome") as string,
    contato: (formData.get("contato") as string) || null,
    documento: (formData.get("documento") as string) || null,
    classificacao: formData.get("classificacao") as "padrao" | "vip" | "recorrente" | "inadimplente",
    observacao: (formData.get("observacao") as string) || null,
  };

  if (id) {
    await atualizarCliente(id, input);
  } else {
    await criarCliente(input);
  }

  revalidatePath("/clientes");
}
