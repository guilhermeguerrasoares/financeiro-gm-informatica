"use server";

import { revalidatePath } from "next/cache";
import { criarCliente, atualizarCliente } from "@/lib/queries/clientes";

export async function salvarClienteAction(formData: FormData) {
  const id = formData.get("id") as string | null;

  const input = {
    nome: formData.get("nome") as string,
    contato: (formData.get("contato") as string) || null,
    // O formulário não pede mais o documento (CPF/CNPJ) do cliente. Fica
    // explicitamente nulo em vez de sumir: a coluna continua existindo, e o
    // tipo `Omit<Cliente, "id">` exige o campo. Para voltar a coletar, é ler
    // do formulário de novo aqui e reintroduzir o input no ClienteModal.
    documento: null,
    classificacao: formData.get("classificacao") as "padrao" | "vip" | "recorrente" | "inadimplente",
    observacao: (formData.get("observacao") as string) || null,
  };

  if (id) {
    await atualizarCliente(id, input);
    revalidatePath(`/clientes/${id}`);
  } else {
    await criarCliente(input);
  }

  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}
