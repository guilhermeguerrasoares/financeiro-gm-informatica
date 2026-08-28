"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { estornarPagamento, atualizarComprovantePagamento, atualizarContaPagamento } from "@/lib/queries/pagamentos";
import { buscarItemPermutaPorPagamento } from "@/lib/queries/itensPermuta";
import { registrarPagamentoComPermuta } from "./permutaPagamento";
import { revalidarPaginasFinanceiras } from "./revalidate";

export async function registrarPagamentoAction(formData: FormData) {
  const lancamentoId = formData.get("lancamento_id") as string;
  const dataPagamento = formData.get("data_pagamento") as string;
  const taxaRaw = formData.get("taxa") as string;

  await registrarPagamentoComPermuta({
    lancamentoId,
    dataPagamento,
    valorCaixa: Number(formData.get("valor")) || 0,
    taxa: taxaRaw ? Number(taxaRaw) : null,
    formaPagamento: (formData.get("forma_pagamento") as string) || null,
    comprovanteUrl: (formData.get("comprovante_path") as string) || null,
    permutaDescricao: (formData.get("permuta_descricao") as string) || "",
    valorPermuta: Number(formData.get("permuta_valor")) || 0,
    contaFinanceiraId: (formData.get("conta_financeira_id") as string) || null,
  });

  revalidarPaginasFinanceiras();
  revalidatePath("/permutas");
}

export async function estornarPagamentoAction(id: string) {
  // itens_permuta.pagamento_id tem "on delete cascade" - excluir um
  // pagamento em permuta apaga o item de estoque junto. Se o item já foi
  // vendido (ou baixado de outra forma), isso deixaria a venda - e o lucro
  // dela - órfã, sem nenhum item de permuta por trás. Por isso bloqueamos.
  const item = await buscarItemPermutaPorPagamento(id);
  if (item && item.status !== "em_estoque") {
    throw new Error(
      "Este pagamento gerou um item de permuta que já foi vendido (ou baixado). Reverta isso antes de excluir o pagamento."
    );
  }
  await estornarPagamento(id);
  revalidarPaginasFinanceiras();
  revalidatePath("/permutas");
}

export async function alterarContaPagamentoAction(pagamentoId: string, contaFinanceiraId: string | null) {
  await atualizarContaPagamento(pagamentoId, contaFinanceiraId);
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
