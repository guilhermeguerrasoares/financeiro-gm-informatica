"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "@/lib/queries/lancamentos";
import { reverterItemPermutaPorLancamento } from "@/lib/queries/itensPermuta";
import { registrarPagamentoComPermuta } from "./permutaPagamento";
import { round2 } from "@/lib/calculations";
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
  const registrandoPagamento = !id && formData.get("registrar_pagamento") === "on";

  // Validado antes de criar o lançamento: se deixarmos passar e
  // registrarPagamentoComPermuta rejeitar só depois, o lançamento já teria
  // sido criado sem nenhum pagamento, e reenviar o formulário (que não tem
  // um `id` pra reaproveitar) criaria um lançamento duplicado.
  if (registrandoPagamento) {
    const permutaDescricao = (formData.get("permuta_descricao") as string) || "";
    const valorCaixa = round2(Number(formData.get("pagamento_valor")) || 0);
    const valorPermuta = permutaDescricao ? round2(Number(formData.get("permuta_valor")) || 0) : 0;
    if (valorCaixa <= 0.004 && valorPermuta <= 0.004) {
      throw new Error("Informe um valor pago (em dinheiro/outro e/ou em permuta) maior que zero.");
    }
  }

  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: (formData.get("cliente_id") as string) || null,
    fornecedor_id: (formData.get("fornecedor_id") as string) || null,
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
  if (registrandoPagamento) {
    const dataPagamento = formData.get("data_pagamento") as string;
    const permutaDescricao = (formData.get("permuta_descricao") as string) || "";
    const arquivo = formData.get("comprovante") as File | null;
    const comprovantePath = arquivo ? await uploadComprovanteServidor(arquivo, lancamento.id) : null;
    const taxaRaw = formData.get("taxa") as string;

    const { criouPermuta } = await registrarPagamentoComPermuta({
      lancamentoId: lancamento.id,
      dataPagamento,
      valorCaixa: Number(formData.get("pagamento_valor")) || 0,
      taxa: taxaRaw ? Number(taxaRaw) : null,
      formaPagamento: (formData.get("forma_pagamento") as string) || null,
      comprovanteUrl: comprovantePath,
      permutaDescricao,
      valorPermuta: Number(formData.get("permuta_valor")) || 0,
    });
    if (criouPermuta) revalidatePath("/permutas");
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
