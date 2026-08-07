"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarPagamento, estornarPagamento, atualizarComprovantePagamento } from "@/lib/queries/pagamentos";
import { criarItemPermuta } from "@/lib/queries/itensPermuta";
import { round2 } from "@/lib/calculations";
import { revalidarPaginasFinanceiras } from "./revalidate";

export async function registrarPagamentoAction(formData: FormData) {
  const lancamentoId = formData.get("lancamento_id") as string;
  const dataPagamento = formData.get("data_pagamento") as string;
  const valorTotal = Number(formData.get("valor"));
  const permutaDescricao = formData.get("permuta_descricao") as string;
  // Mesma divisão do fluxo de criação (actions.ts): o pagamento de um saldo
  // em aberto pode vir parte em dinheiro/cartão, parte em permuta.
  const valorPermuta = permutaDescricao ? round2(Number(formData.get("permuta_valor")) || 0) : 0;
  const valorCaixa = round2(valorTotal - valorPermuta);

  if (valorCaixa > 0.004) {
    const taxaRaw = formData.get("taxa") as string;
    await registrarPagamento({
      lancamento_id: lancamentoId,
      valor: valorCaixa,
      taxa: taxaRaw ? Number(taxaRaw) : null,
      forma_pagamento: (formData.get("forma_pagamento") as string) || null,
      data_pagamento: dataPagamento,
      comprovante_url: (formData.get("comprovante_path") as string) || null,
      observacao: null,
    });
  }

  // Not wrapped in a DB transaction: pagamento e itens_permuta são duas
  // gravações separadas. Se a segunda falhar depois da primeira, o
  // pagamento fica registrado mas o item de permuta não - aceito como
  // trade-off de v1 (uma RPC no Postgres fecharia essa brecha depois).
  if (valorPermuta > 0.004 && permutaDescricao) {
    const pagamentoPermuta = await registrarPagamento({
      lancamento_id: lancamentoId,
      valor: valorPermuta,
      taxa: null,
      forma_pagamento: "permuta",
      data_pagamento: dataPagamento,
      comprovante_url: null,
      observacao: null,
    });
    const valorEstimadoRaw = formData.get("permuta_valor_estimado") as string;
    await criarItemPermuta({
      pagamento_id: pagamentoPermuta.id,
      descricao: permutaDescricao,
      valor_estimado: valorEstimadoRaw ? Number(valorEstimadoRaw) : valorPermuta,
      status: "em_estoque",
    });
  }

  revalidarPaginasFinanceiras();
  revalidatePath("/permutas");
}

export async function estornarPagamentoAction(id: string) {
  // itens_permuta.pagamento_id tem "on delete cascade" - excluir um
  // pagamento em permuta apaga o item de estoque junto.
  await estornarPagamento(id);
  revalidarPaginasFinanceiras();
  revalidatePath("/permutas");
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
