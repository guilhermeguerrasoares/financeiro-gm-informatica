"use server";

import { revalidatePath } from "next/cache";
import { registrarPagamento, estornarPagamento } from "@/lib/queries/pagamentos";
import { criarItemPermuta } from "@/lib/queries/itensPermuta";

export async function registrarPagamentoAction(formData: FormData) {
  const taxaRaw = formData.get("taxa") as string;

  const pagamento = await registrarPagamento({
    lancamento_id: formData.get("lancamento_id") as string,
    valor: Number(formData.get("valor")),
    taxa: taxaRaw ? Number(taxaRaw) : null,
    forma_pagamento: (formData.get("forma_pagamento") as string) || null,
    data_pagamento: formData.get("data_pagamento") as string,
    comprovante_url: null,
    observacao: null,
  });

  // Not wrapped in a DB transaction: pagamento and itens_permuta are two
  // separate requests. If this second insert fails after the first
  // succeeds, the payment is recorded but the barter item isn't - accepted
  // as a v1 tradeoff (no easy cross-request transaction from a server
  // action against PostgREST); a Postgres RPC would close this gap later.
  const permutaDescricao = formData.get("permuta_descricao") as string;
  if (formData.get("forma_pagamento") === "permuta" && permutaDescricao) {
    const valorEstimadoRaw = formData.get("permuta_valor_estimado") as string;
    await criarItemPermuta({
      pagamento_id: pagamento.id,
      descricao: permutaDescricao,
      valor_estimado: valorEstimadoRaw ? Number(valorEstimadoRaw) : null,
      status: "em_estoque",
    });
  }

  revalidatePath("/lancamentos");
  revalidatePath("/permutas");
}

export async function estornarPagamentoAction(id: string) {
  await estornarPagamento(id);
  revalidatePath("/lancamentos");
}
