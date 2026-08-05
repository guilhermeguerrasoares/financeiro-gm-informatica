"use server";

import { revalidatePath } from "next/cache";
import { registrarPagamento, estornarPagamento } from "@/lib/queries/pagamentos";

export async function registrarPagamentoAction(formData: FormData) {
  const taxaRaw = formData.get("taxa") as string;

  await registrarPagamento({
    lancamento_id: formData.get("lancamento_id") as string,
    valor: Number(formData.get("valor")),
    taxa: taxaRaw ? Number(taxaRaw) : null,
    forma_pagamento: (formData.get("forma_pagamento") as string) || null,
    data_pagamento: formData.get("data_pagamento") as string,
    comprovante_url: null,
    observacao: null,
  });

  revalidatePath("/lancamentos");
}

export async function estornarPagamentoAction(id: string) {
  await estornarPagamento(id);
  revalidatePath("/lancamentos");
}
