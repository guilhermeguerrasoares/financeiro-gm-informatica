"use server";

import { revalidatePath } from "next/cache";
import { criarFornecedor, atualizarFornecedor, excluirFornecedor } from "@/lib/queries/fornecedores";

function revalidarPaginasComFornecedores(id?: string) {
  revalidatePath("/fornecedores");
  if (id) revalidatePath(`/fornecedores/${id}`);
}

export async function salvarFornecedorAction(formData: FormData) {
  const input = {
    nome: formData.get("nome") as string,
    contato: (formData.get("contato") as string) || null,
    documento: (formData.get("documento") as string) || null,
    tipo: (formData.get("tipo") as string) || null,
  };

  const id = formData.get("id") as string;
  if (id) {
    await atualizarFornecedor(id, input);
  } else {
    await criarFornecedor(input);
  }

  revalidarPaginasComFornecedores(id);
}

export async function excluirFornecedorAction(id: string) {
  await excluirFornecedor(id);
  revalidarPaginasComFornecedores();
}
