"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarPagamento, estornarPagamento, atualizarComprovantePagamento } from "@/lib/queries/pagamentos";
import { criarItemPermuta } from "@/lib/queries/itensPermuta";
import { revalidarPaginasFinanceiras } from "./revalidate";

export async function registrarPagamentoAction(formData: FormData) {
  const taxaRaw = formData.get("taxa") as string;

  const pagamento = await registrarPagamento({
    lancamento_id: formData.get("lancamento_id") as string,
    valor: Number(formData.get("valor")),
    taxa: taxaRaw ? Number(taxaRaw) : null,
    forma_pagamento: (formData.get("forma_pagamento") as string) || null,
    data_pagamento: formData.get("data_pagamento") as string,
    comprovante_url: (formData.get("comprovante_path") as string) || null,
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

  revalidarPaginasFinanceiras();
  revalidatePath("/permutas");
}

export async function estornarPagamentoAction(id: string) {
  await estornarPagamento(id);
  revalidarPaginasFinanceiras();
}

export async function anexarComprovanteAction(pagamentoId: string, path: string) {
  await atualizarComprovantePagamento(pagamentoId, path);
  revalidarPaginasFinanceiras();
}

export async function getComprovanteUrlAction(path: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
