"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "@/lib/queries/lancamentos";
import { registrarPagamento } from "@/lib/queries/pagamentos";
import { criarItemPermuta, reverterItemPermutaPorLancamento } from "@/lib/queries/itensPermuta";
import { revalidarPaginasFinanceiras } from "./revalidate";

async function uploadComprovanteServidor(arquivo: File, lancamentoId: string): Promise<string | null> {
  if (arquivo.size === 0) return null;
  const supabase = await createClient();
  const path = `${lancamentoId}/${Date.now()}-${arquivo.name}`;
  const { error } = await supabase.storage.from("comprovantes").upload(path, arquivo);
  if (error) throw error;
  return path;
}

export async function salvarLancamentoAction(formData: FormData) {
  const id = formData.get("id") as string | null;

  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: null,
    fornecedor_id: null,
    conta_financeira_id: (formData.get("conta_financeira_id") as string) || null,
    equipamento_id: null,
    valor: Number(formData.get("valor")),
    custo: formData.get("custo") ? Number(formData.get("custo")) : null,
    vencimento: (formData.get("vencimento") as string) || null,
    competencia: (formData.get("vencimento") as string)?.slice(0, 7) || null,
    recorrencia: null,
    observacao: (formData.get("observacao") as string) || null,
  };

  const lancamento = id ? await atualizarLancamento(id, input) : await criarLancamento(input);

  // Pagamento inline só se aplica à criação (o botão "Pagar" da tabela cobre
  // lançamentos já existentes, que têm seu próprio fluxo em PagamentoModal).
  if (!id && formData.get("registrar_pagamento") === "on") {
    const arquivo = formData.get("comprovante") as File | null;
    const comprovantePath = arquivo ? await uploadComprovanteServidor(arquivo, lancamento.id) : null;

    const taxaRaw = formData.get("taxa") as string;
    const formaPagamento = (formData.get("forma_pagamento") as string) || null;
    const pagamento = await registrarPagamento({
      lancamento_id: lancamento.id,
      valor: Number(formData.get("pagamento_valor")),
      taxa: taxaRaw ? Number(taxaRaw) : null,
      forma_pagamento: formaPagamento,
      data_pagamento: formData.get("data_pagamento") as string,
      comprovante_url: comprovantePath,
      observacao: null,
    });

    // Mesmo trade-off não-transacional do fluxo de pagamento avulso: se a
    // criação do item de permuta falhar aqui, o pagamento já foi gravado.
    const permutaDescricao = formData.get("permuta_descricao") as string;
    if (formaPagamento === "permuta" && permutaDescricao) {
      const valorEstimadoRaw = formData.get("permuta_valor_estimado") as string;
      await criarItemPermuta({
        pagamento_id: pagamento.id,
        descricao: permutaDescricao,
        valor_estimado: valorEstimadoRaw ? Number(valorEstimadoRaw) : null,
        status: "em_estoque",
      });
      revalidatePath("/permutas");
    }
  }

  revalidarPaginasFinanceiras();
  return lancamento;
}

export async function excluirLancamentoAction(id: string) {
  // Se este lançamento veio de uma venda de permuta, devolve o item pro
  // estoque antes de apagar - senão ele fica preso em "vendido" pra sempre,
  // sem lançamento nenhum por trás.
  await reverterItemPermutaPorLancamento(id);
  await excluirLancamento(id);
  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}
