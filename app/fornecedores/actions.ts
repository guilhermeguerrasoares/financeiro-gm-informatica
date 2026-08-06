"use server";

import { revalidatePath } from "next/cache";
import { criarFornecedor } from "@/lib/queries/fornecedores";

export async function criarFornecedorAction(formData: FormData) {
  await criarFornecedor({
    nome: formData.get("nome") as string,
    contato: (formData.get("contato") as string) || null,
    documento: (formData.get("documento") as string) || null,
    tipo: (formData.get("tipo") as string) || null,
  });
  revalidatePath("/fornecedores");
}
